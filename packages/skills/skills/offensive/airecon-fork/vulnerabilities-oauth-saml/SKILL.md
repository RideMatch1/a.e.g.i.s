<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: oauth-saml
description: Exploitation techniques for OAuth 2.0, OpenID Connect (OIDC), and SAML 2.0 implementations
---

# OAuth 2.0 and SAML 2.0 Vulnerabilities

OAuth 2.0 and SAML 2.0 are complex Single Sign-On (SSO) and authorization protocols. Due to their complexity, misconfigurations and implementation flaws are common, leading to critical vulnerabilities such as authentication bypass, account takeover (ATO), and privilege escalation.

## OAuth 2.0 & OpenID Connect (OIDC)

OAuth 2.0 is an authorization framework, while OpenID Connect is an authentication layer built on top of it. Typical flows include the Authorization Code flow, Implicit flow, and Client Credentials flow.

### Core OAuth 2.0 Attack Vectors

#### 1. Authorization Code Bypass & CSRF (Missing/Weak State)
If the `state` parameter is missing, predictable, or not properly validated bound to the user's session, attackers can perform CSRF to link their own external account (e.g., Google, Facebook) to the victim's application account.

**Detection:**
- Check if `state` is present in the initial `/authorize` request.
- Attempt to reuse a `state` token across different sessions.
- Send the callback `/callback?code=ATTACKER_CODE` without a state parameter.

**Exploit:**
```http
# Attacker initiates flow, intercepts their valid code
GET /auth/callback?code=ATTACKER_VALID_CODE&state=VICTIM_STATE HTTP/1.1
Host: target.com
```

#### 2. Pre-Account Takeover (Account Linking Flaws)
Occurs when an application allows users to sign up via OAuth, but fails to verify the email address or improperly links accounts based on unverified email claims.
- **Exploit:** Attacker registers a standard application account using the victim's email (if email verification is missing or bypassable). When the victim later logs in via OAuth (e.g., Sign in with Google), the application links the verified OAuth identity to the attacker-controlled account context, granting the attacker access to the victim's data.

#### 3. Flawed Redirect URI Validation (Open Redirects to Token Leakage)
If `redirect_uri` is loosely validated, authorization codes or access tokens can be leaked to attacker-controlled domains.
- **Path Traversal:** `redirect_uri=https://target.com/callback/../../attacker.com`
- **Subdomain Takeover:** `redirect_uri=https://sub.target.com/callback` (where `sub.target.com` is vulnerable)
- **Parameter Pollution:** `redirect_uri=https://target.com/callback&redirect_uri=https://attacker.com`
- **CRLF Injection:** Injecting new lines to bypass regex matching.
- **Open Redirect Chaining:** If the valid `redirect_uri` itself has an open redirect vulnerability, it can leak the fragment/query parameters: `redirect_uri=https://target.com/valid_callback?next=https://attacker.com`

#### 4. PKCE (Proof Key for Code Exchange) Downgrade & Bypass
PKCE prevents authorization code interception in public clients (mobile apps, SPAs).
- **Downgrade Attack:** If the server supports PKCE but doesn't *enforce* it, an attacker catching the `code` can exchange it without providing `code_verifier`.
- **Method Manipulation:** Dropping `code_challenge_method=S256` might cause the server to fall back to `plain`, making the challenge equal to the verifier.

#### 5. SSRF via OpenID Connect Dynamic Client Registration (DCR)
DCR allows applications to automatically register themselves as clients with an IdP.
- **logo_uri / policy_uri SSRF:** IdPs may fetch resources specified during registration.
- **request_uri SSRF:** In OIDC, a client can pass authentication parameters via a JWT hosted at a `request_uri`. The IdP fetches this URI, leading to SSRF.

```http
# Exploiting request_uri SSRF on IdP
GET /authorize?client_id=YOUR_CLIENT_ID&response_type=code&request_uri=http://internal-metadata-server/latest/meta-data/ HTTP/1.1
Host: idp.target.com
```

#### 6. JWT Attacks (OIDC Tokens)
Since OIDC relies heavily on JSON Web Tokens (ID Tokens), all JWT attacks apply to the SSO implementation:
- **`alg: None` bypass:** Changing the algorithm to `None` and stripping the signature.
- **HMAC/RSA Key Confusion:** Changing `alg` from `RS256` to `HS256` and signing the token with the public key as the secret.
- **JKU/JWK Header Injection:** Instructing the server to fetch the public key (to verify the token) from an attacker-controlled URL (`jku`) or embedding the attacker's public key directly within the header (`jwk`).
- **kid (Key ID) Path Traversal:** `kid: "../../public/dev_key.pem"` or SQL injection `kid: "key1' UNION SELECT 'attacker_key'--"`.

---

## SAML 2.0

Security Assertion Markup Language (SAML) uses XML-based assertions between an Identity Provider (IdP) and a Service Provider (SP).

### Core SAML 2.0 Attack Vectors

#### 1. XML Signature Wrapping (XSW)
SAML messages are digitally signed, but SPs often fail to validate *which* part of the XML is signed versus which part is processed for authentication. XSW involves manipulating the XML structure so the signature validates against an original, unmodified assertion, while the application logic parses a forged, injected assertion.
- **XSW1:** Clone the `Response` and wrap the legitimate assertion.
- **XSW2:** Wrap the forged assertion inside the legitimate assertion.
- **XSW3-8:** Various structural manipulations (changing IDs, duplicating `Assertion` blocks, wrapping the signature itself).
- **Tooling:** Use `SAML Raider` (Burp Extension) to automatically generate XSW 1-8 payloads.

#### 2. Signature Stripping
If the SP requires assertions to be signed but doesn't strictly enforce it, an attacker might simply remove the `<ds:Signature>` block entirely. If the SP falls back to unauthenticated parsing, ATO occurs.

#### 3. Certificate Faking / IdP Spoofing
If the SP doesn't explicitly check the thumbprint or issuer of the certificate signing the SAML response (relying solely on cryptographic validity), an attacker can sign a forged SAML response with their own self-signed certificate.

#### 4. SAML Comment Injection
If the XML parser behavior differs from the application logic string parsing, attackers can alter user identifiers.
- **Attack:** An attacker registers `admin<!-- test -->@target.com`.
- **Execution:** When authenticated, the SAML XML contains `<NameID>admin<!-- test -->@target.com</NameID>`.
- **Bypass:** The XML parser validates the signature. However, if the application extracts the text node and ignores comments, it might interpret the identity as `admin@target.com`, leading to ATO of the admin account.

#### 5. XML External Entity (XXE) Execution
Standard XXE attacks against the SAML SP endpoint. Since SAML is purely XML, injecting external entities into the `SAMLResponse` can result in LFI or SSRF.
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<samlp:Response ...>
   <saml:Issuer>&xxe;</saml:Issuer>
   ...
</samlp:Response>
```

#### 6. XSLT Injection
Some SAML implementations parse arbitrary XSLT stylesheets included within the XML Signature `<ds:Transforms>` block. Attackers can inject malicious XSLT to achieve RCE or file read.
```xml
<ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xslt-19991116">
  <xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
     ... malicious XSLT payloads ...
  </xsl:stylesheet>
</ds:Transform>
```

## Testing Methodology

### For OAuth 2.0 / OIDC
1. **Map the Implementation:** Identify `client_id`, `redirect_uri`, `response_type`, `state`, `code_challenge`.
2. **State & CSRF Testing:** Drop the `state` parameter or swap it with another session's state. Attempt an account linking CSRF.
3. **Redirect URI Fuzzing:** Test all variations of open redirects (`.`, `..`, `@`, `\`, encoded characters) on the `redirect_uri`.
4. **Token Replay & Modification:** Inspect access tokens and ID tokens. If JWT, attempt algorithm downgrade, key confusion, and signature bypass.
5. **SSRF Probes:** Check if DCR is enabled (`/.well-known/openid-configuration`). Test `logo_uri` and `request_uri` for SSRF.
6. **Pre-ATO Checks:** Register an account natively using a victim's email. Then attempt to SSO as the victim.

### For SAML 2.0
1. **Intercept SAMLResponse:** Base64 decode the SAML payload passed to the ACS (Assertion Consumer Service) URL.
2. **Signature Stripping:** Remove the signature block entirely, re-encode, and submit.
3. **SAML Raider Autotests:** Use the SAML Raider extension in Burp Suite to apply all XSW payloads to the intercepted request.
4. **XXE Probing:** Inject standard XXE payloads (OOB and error-based) into the assertion tags.
5. **Comment Injection:** Create accounts like `admin<!--X-->@domain.com` and test for username truncation during parsing.
6. **Time/Validity Tampering:** Modify `NotBefore` and `NotOnOrAfter` timestamps within the assertion.

## Detection Tools

```bash
# jwt_tool - Toolkit for testing JWTs (OIDC)
python3 jwt_tool.py <JWT> -M pb
python3 jwt_tool.py <JWT> -T

# SAML Provider assessment
# Use Burp Suite SAML Raider extension.
# It automatically intercepts SAML responses, decodes them, and provides 1-click XSW and certificate spoofing attacks.
```

## Indicators of Vulnerability

- **OAuth:** Predictable `state` parameters; acceptance of `redirect_uri` via Regex rather than strict allowlists; JWTs signed with symmetric algorithms (`HS256`) when relying on public endpoints.
- **SAML:** Missing constraints on XML signatures (e.g., signing the `Response` but not the `Assertion`); outdated XML parsers allowing DTD definitions (XXE); lack of assertion expiration enforcement.

## Impact

- **Account Takeover (ATO):** Full access to victim accounts (via XSW, signature stripping, CSRF, or flawed account linking).
- **Data Exfiltration:** Accessing sensitive user data (PII) via stolen or leaked Access Tokens.
- **SSRF/RCE:** Exploiting IdP infrastructure via XSLT injection or `request_uri` SSRF.
- **Bypass 2FA/MFA:** SAML assertions or OAuth tokens are often granted *after* MFA. Forging these tokens bypasses all primary and secondary authentication mechanisms.

## Pro Tips

1. **URL Encoding with SAML:** SAML bindings differ. HTTP-Redirect uses Deflate + Base64 + URL-encode. HTTP-POST uses just Base64 + URL-encode. Modifying SAML manually? Ensure proper re-encoding based on the binding type.
2. **Access Token vs ID Token:** In OIDC, the Access Token gives access to APIs (stateless or stateful), while the ID Token is meant for the client app to know *who* logged in. Don't confuse them.
3. **SAML Issuer Checking:** Just because an XSW attack works, the SP might still validate the `Issuer` field. Ensure you are modifying the correct assertion block that the SP uses for business logic.
4. **Implicit Flow is Dead:** The OAuth 2.0 Security Best Current Practice deprecates the Implicit Flow (`response_type=token`). If you see it, flag it as a finding and aggressively hunt for token leakage via Referer headers, Open Redirects, and browser histories.
