<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: grpc
description: Exploitation techniques for gRPC services, targeting Protobuf serialization, HTTP/2 misconfigurations, and method enumeration.
---

# gRPC Vulnerabilities

gRPC is a high-performance, open-source universal RPC framework developed by Google. By default, it uses HTTP/2 for transport, Protocol Buffers (Protobuf) for the interface definition language (IDL) and data serialization, and provides features like bidirectional streaming. Because data is serialized in a binary format rather than plaintext (like JSON/XML), testing tools need specific support, and many standard Web Application Firewalls (WAFs) fail to inspect the payload accurately.

## Core Concepts & Structure

- **Protocol Buffers (Protobuf):** The schema definition language used by gRPC to define services, methods, and message types (`.proto` files). Data transmitted over the wire relies entirely on numerical field IDs and binary encoding, meaning the field names themselves are absent from the request payload.
- **HTTP/2 Transport:** gRPC requests are always POST requests over HTTP/2. The URI path dictates the method being invoked (`/{Service_Name}/{Method_Name}`).
- **Content-Type:** `application/grpc` or `application/grpc+proto`.
- **Server Reflection:** An optional extension that allows clients to query the server for its Protobuf definitions dynamically at runtime.

---

## 1. Reconnaissance & Enumeration

The biggest hurdle in testing gRPC is understanding the structure of the binary data. Without the `.proto` file, modifying payloads blindly usually corrupts the binary structure and results in a generic `INVALID_ARGUMENT` error.

### A. Server Reflection

If the developer left gRPC Server Reflection enabled (common in development/staging, critically bad in production), you can dump the entire API schema.

**Using `grpcurl`:**
```bash
# List all available services on the target
grpcurl -plaintext target.com:50051 list

# List all methods within a specific service
grpcurl -plaintext target.com:50051 list com.example.UserService

# Describe a specific method to see expected input/output message schemas
grpcurl -plaintext target.com:50051 describe com.example.UserService.GetUser
```

### B. Protobuf Extraction without Reflection

If reflection is disabled, you must extract the `.proto` definitions from the client-side binary or application.

- **Web Clients (gRPC-Web):** Analyze the minified JavaScript. Search for structural maps, object definitions, or embedded `.proto` definitions. Use tools like `protobuf-inspector` or `protoc-gen-js` logic to reverse-engineer field numbers to conceptual data structures.
- **Mobile Apps (Android/iOS):** the `.proto` structure is compiled directly into the binary. Use decompilers (e.g., `jadx-gui` for Android) to search for classes extending `com.google.protobuf.GeneratedMessageV3`. The class names and methods reveal the API structure.

---

## 2. Exploiting gRPC Endpoints

Once the schema is known (via reflection or extraction), gRPC endpoints can be tested similarly to standard REST APIs, albeit requiring different tools for payload delivery.

### A. Bypassing WAFs via Binary Serialization

Many WAFs completely fail to inspect the body of requests with `Content-Type: application/grpc`.

-   **SQL Injection:** Because the data is deserialized safely into typed objects by Protobuf, generic SQLi payloads *might* bypass the parsing phase, but if that data later constructs raw SQL queries dynamically on the backend (e.g., using Hibernate `createNativeQuery` or unsafe Go SQL drivers without parameterization), SQLi is still fully possible. Inject standard SQLi payloads (`' OR 1=1 --`) via gRPC clients.
-   **Command Injection / XSS:** Similar to SQLi, the transport layer is secure, but if the backend echoes strings to a database, command line, or returning HTML, injections are viable.

### B. Broken Object Level Authorization (BOLA/IDOR)

Protobuf relies heavily on structured identifiers.

1.  Use `grpcurl` or Burp Suite to capture a valid request.
2.  Identify ID fields (e.g., `user_id: 100`).
3.  Modify the ID field to target another user. Because the data structure strongly enforces types (an `int32` must remain an `int32`), simply incrementing numerical IDs is highly effective.
4.  Unlike HTTP where `?id=100&id=101` might cause parameter pollution, Protobuf handles duplicate fields based on the repeated modifier. Testing HPP requires understanding the schema.

### C. Type Confusion & Logic Flaws

Protobuf strongly types fields (int, string, bool).
- What happens if you submit a massive integer that causes an overflow on the backend service receiving the deserialized data?
- If an enum is defined (e.g., `USER = 0, ADMIN = 1`), manually craft a payload using `grpcurl` supplying an undocumented enum value (e.g., `2`) to test backend exception handling.

### D. Server-Side Request Forgery (SSRF)

If a gRPC method takes a string representing a URL or hostname (e.g., `FetchExternalImage(ImageRequest)`), test for SSRF. The backend execution is identical to standard web vulnerabilities; only the delivery mechanism is gRPC.

---

## 3. HTTP/2 Specific Flaws

Because gRPC mandates HTTP/2, all HTTP/2 vulnerabilities apply to the underlying connection handling.

### A. Denial of Service (DoS)

- **HTTP/2 Request Smuggling:** If there's a reverse proxy downgrading HTTP/2 gRPC traffic to internal HTTP/1.1 REST endpoints (e.g., using envoy or grpc-gateway), test for HTTP/2 desynchronization attacks.
- **Rapid Reset (CVE-2023-44487):** The client sends hundreds of `HEADERS` frames to initiate streams and immediately sends `RST_STREAM` frames. The server allocates resources for the request but the client abruptly cancels, exhausting server capabilities very quickly without triggering standard rate limiters.
- **Max Concurrent Streams Exhaustion:** Open multiple HTTP/2 connections and max out the allowed concurrent streams per connection.

---

## 4. Reverse Proxy and Gateway Issues

Often, developers use tools like `grpc-gateway` to provide a RESTful JSON API *alongside* the native gRPC API.

-   **Testing Both Interfaces:** If the main application consumes gRPC directly, you should *also* test the REST gateway (if exposed). Sometimes, access controls implemented correctly on the gRPC interceptors are missing entirely on the HTTP/JSON gateway routes, or vice versa.
-   **Header Leakage:** gRPC uses HTTP headers as "Metadata" (e.g., `grpc-metadata-authorization`). Reverse proxies might improperly forward internal metadata headers, allowing attackers to inject headers that assume administrative context.

## Tooling & Methodology

### Burp Suite Integration
You must install specific extensions to read and modify gRPC traffic effectively.
- **gRPC (Burp Extension):** Automatically decodes protobuf payloads if the server supports reflection, allowing you to edit values in standard JSON format within Repeater, and then reserializing it to binary before sending.
- **Black-box Protobuf editing:** If reflection is disabled, the `gRPC` extension will show field numbers (e.g., `1: "admin"`) instead of field names. You can still modify the values (e.g., changing "admin" to "root") without breaking the serialization.

### Command Line Tools

```bash
# grpcurl - Like cURL, but for gRPC
grpcurl -plaintext -d '{"user_id": "123"}' target.com:50051 com.example.UserService.DeleteUser

# ghz - A load testing tool for gRPC, excellent for testing DoS resilience
ghz --insecure --proto ./schema.proto --call com.example.UserService.GetUser -d '{"id": 1}' -c 50 -n 1000 target.com:50051
```

## Critical Pro Tips

1.  **gRPC Status Codes vs HTTP Status Codes:** A gRPC request that fails business logic (e.g., "Account not found") will usually return an HTTP status of `200 OK`, but the gRPC-specific header `grpc-status` will be set to `5 (NOT_FOUND)` and `grpc-message` will contain the error string. Always look at the trailers, not just the HTTP status.
2.  **Streaming Endpoints:** gRPC supports client-streaming, server-streaming, and bidirectional streaming. Tools like Burp Repeater struggle with streaming endpoints. You often need custom Python scripts using the `grpcio` library and the extracted `.proto` files to test stream-specific race conditions or logic flaws accurately.
3.  **Authentication Metadata:** Authentication tokens (JWTs, API Keys) are almost always passed in the `authorization` metadata header, which maps directly to the HTTP header.
4.  **Information Disclosure in Errors:** When gRPC services crash or fail validation gracefully, they tend to return highly verbose error messages in the `grpc-message` trailer, frequently leaking backend stack traces or database schema details.
