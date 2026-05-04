<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# WAF Detection and Bypass

## Overview
Before running any exploitation attempts, you MUST detect if a WAF (Web Application Firewall) is present. Failing to do so can lead to:
- IP blocking/banning
- False negatives (legitimate vulnerabilities missed)
- Rate limiting that stalls your testing

## Detection Tools

### 1. wafw00f (Primary)
```bash
wafw00f https://target.com
```

### 2. WhatWaf
```bash
whatwaf -u https://target.com
```

### 3. Manual Detection
Check for WAF indicators in response headers:
- `Server:`
- `X-Cdn:`
- `X-Sucuri-ID:`
- `X-Debug:`

Check response body for WAF block pages:
- "403 Forbidden"
- "Access Denied"
- "Security Check"
- "Attack Detected"

## Common WAF Signatures

| WAF | Detection Fingerprint |
|-----|----------------------|
| Cloudflare | `__cfduid`, `cf-ray`, server: `cloudflare` |
| AWS WAF | `X-Amzn-Trace-Id`, `aws-waf` |
| Azure WAF | `server: Microsoft-IIS` with `az` headers |
| Akamai | `AkamaiGHost`, `akamai-origin-hop` |
| Imperva | `X-CDN`, `X-Iinfo` |
| Sucuri | `X-Sucuri-ID`, `X-Sucuri-Block` |
| ModSecurity | `server: ModSecurity` |
| F5 ASM | `X-Correlation-ID`, `TS` cookie |

## Bypass Techniques

### HTTP Parameter Pollution
```
?id=1&id=2
```

### Case Variation
```
/Admin login
/admin Login
```

### Encoding
- URL encode special characters
- Double URL encode
- Unicode variations

### Protocol Switching
- HTTP/1.0 instead of 1.1
- Use Host header variations

### Timing Attacks
- Add delays between requests
- Slowloris to bypass rate limits

## Workflow

1. **RECON PHASE**: Run wafw00f before exploitation
2. **IF WAF DETECTED**: 
   - Note the WAF type
   - Select appropriate bypass payloads
   - Implement delays between requests
   - Consider using different IP/source
3. **DOCUMENT**: Save WAF results to output/waf_detection.txt

## Important Notes

- NEVER spam requests - you'll get blocked
- Use `httpx` or `curl` first to check response
- Some WAFs only block on specific attack patterns
- Cloudflare requires special handling (may need to bypass JS challenge)
