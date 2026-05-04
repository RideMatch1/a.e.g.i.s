<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# sqlmap & ghauri — Usage Guide for AIRecon

sqlmap and ghauri are SQL injection testing tools. They are effective ONLY when pointed at a
specific, manually-confirmed injectable parameter. Running either against a root URL, an IP address,
or a randomly chosen endpoint without prior manual analysis is the definition of incompetent testing.
It produces false negatives, wastes time, and triggers WAF bans.

---

## MANDATORY PRE-CONDITIONS (All must be true before using sqlmap or ghauri)

  [ ] You have manually browsed the application and identified a specific feature that interacts
      with a database (e.g., search, login, product lookup, user profile, filter/sort functionality).
  [ ] You have manually confirmed a specific URL and parameter (or POST body field) that:
        a. Accepts user-controlled input
        b. Shows evidence of server-side database interaction (e.g., different results for different
           values, error messages mentioning SQL, response time anomalies on numeric inputs)
  [ ] You have manually tested that parameter with at least one basic probe:
        - A single quote: value'  — does the response change or error?
        - A boolean: value AND 1=1  vs  value AND 1=2  — are responses different?
        - A time probe: value; WAITFOR DELAY '0:0:5'-- or SLEEP(5)  — is there a delay?
  [ ] The specific URL+parameter combination is documented in your notes before running the tool.
  [ ] output/host_profiles.json contains an entry for this host with the parameter listed as
      a confirmed input vector.

Using sqlmap/ghauri against a bare URL with no parameter identified = TASK FAILURE.
Using sqlmap/ghauri as the FIRST tool run on a host = TASK FAILURE.

---

## How to Identify SQL Injection Candidates Manually

Before sqlmap touches anything, you must have found a candidate parameter. Methods:

  1. BROWSER + SOURCE INSPECTION:
     - Navigate the application as a user. Click everything. Fill every form.
     - Look for: search bars, login forms, ID-based URLs (/user?id=5, /item/123),
       filter parameters (?category=electronics&sort=price), report generators.
     - In page source: look for inline SQL fragments, database error messages, numeric IDs
       in hidden form fields or URL params.

  2. MANUAL PROBE WITH CURL:
     - For a parameter suspected to be SQL-backed, send:
         curl "http://host/search?q=test'"           (single quote — syntax error?)
         curl "http://host/search?q=test AND 1=1"    (tautology — same result as normal?)
         curl "http://host/search?q=test AND 1=2"    (contradiction — different/empty result?)
     - Compare response sizes, content, and timing across these three requests.
     - If behavior differs between AND 1=1 and AND 1=2: strong SQL injection signal.

  3. HISTORICAL URL ANALYSIS:
     - Parse output/historical_urls.txt for URLs with numeric or ID-style parameters.
     - Prioritize parameters named: id, uid, user_id, product_id, item, page, order, ref,
       category, sort, filter, q, search, query, token, hash.

  4. CRAWLER OUTPUT FILTERING:
     - Parse output/urls_all_deduped.txt for parameterized URLs.
     - Use pattern matching to extract URLs with parameters before ANY scanner touches them.

---

## Confirmed Candidate — Now Run sqlmap

Once you have a specific URL+parameter confirmed through manual probing:

  Basic detection (start here):
    sqlmap -u "http://host/path?param=VALUE" -p param --batch --level=1 --risk=1 \
      --output-dir output/sqlmap/

  If basic detection finds nothing, escalate carefully:
    sqlmap -u "http://host/path?param=VALUE" -p param --batch --level=3 --risk=2 \
      --output-dir output/sqlmap/

  For POST body parameters:
    sqlmap -u "http://host/login" --data "username=admin&password=test" -p username \
      --batch --level=2 --output-dir output/sqlmap/

  For JSON body parameters:
    sqlmap -u "http://host/api/search" --data '{"query":"test"}' \
      --headers "Content-Type: application/json" -p query --batch --output-dir output/sqlmap/

  For cookie-based injection:
    sqlmap -u "http://host/profile" --cookie "session=VALUE" -p session \
      --level=2 --batch --output-dir output/sqlmap/

  After confirming injection exists, extract database info:
    sqlmap -u "<confirmed_injectable_url>" --dbs --batch --output-dir output/sqlmap/

  ghauri (faster, WAF-evasive alternative — same pre-conditions apply):
    ghauri -u "http://host/path?param=VALUE" --dbs --batch

NEVER use these patterns:
  sqlmap -u "http://host/" --dbs               (no parameter identified)
  sqlmap -u "http://host:80" --dbs             (root URL, no parameter, no evidence)
  sqlmap -l output/live_hosts.txt              (list input, no parameter context)

---

## WAF Evasion (Only After Confirming Injection Exists)

If a confirmed injection is being blocked by a WAF:

  sqlmap -u "<url>" -p param --tamper=space2comment,randomcase --batch
  sqlmap -u "<url>" -p param --tamper=between,charencode --batch
  sqlmap -u "<url>" -p param --random-agent --delay=2 --batch

Use web_search "sqlmap tamper <WAF vendor>" to find vendor-specific tamper scripts.

---

## Interpreting Results

  "parameter appears to be injectable" — VERIFY MANUALLY before reporting.
    Reproduce the detection payload manually with curl. Confirm the behavioral difference.

  "fetched databases" or actual data returned — this is confirmed exploitation.
    Document the exact injectable URL, parameter, injection type, and database output.
    Write the reproduction curl command. THEN call create_vulnerability_report.

  Empty results — do NOT escalate blindly. Consider:
    - Is the parameter actually processed server-side (check response variance manually first)?
    - Is there a WAF? Test for WAF with wafw00f before running sqlmap.
    - Is the injection blind (time-based, OOB)? Requires --technique=T or --technique=U flags.

---

## Workflow Integration (Where sqlmap Fits)

  Phase 1 (Manual Profiling): DO NOT use sqlmap or ghauri.
  Phase 2 (Attack Surface Expansion): DO NOT use sqlmap or ghauri.
  Phase 3 (Business Logic & Auth Testing): sqlmap/ghauri valid ONLY if a specific parameter
    has been manually confirmed as a database-backed SQL input vector during Phase 1-2 analysis.
  Phase 4+ (Vulnerability Chaining): sqlmap/ghauri valid for confirmed candidates.

The correct sequence is always: observe -> identify candidate -> manually probe -> confirm -> then tool.
sqlmap confirms and exploits. It does not discover. Discovery is your job.
