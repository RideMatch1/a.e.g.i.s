<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# source_audit — Source Code Security Analysis Guide

This skill covers how to find real security vulnerabilities in source code provided
via @/path references. It applies to any engagement where you have actual source files.

---

## WHEN THIS SKILL APPLIES

Load and follow this skill when:
- User provides source code via @/path (e.g. "find bug in @/home/user/project/")
- User asks to "audit", "review", "find bugs in", or "analyze" source code
- [FILE REFERENCE — DIRECTORY] or [FILE REFERENCE — TEXT] blocks appear in context
- User mentions a framework + source code (e.g. "find vulns in this Django app")

---

## STEP 0 — READ THE INJECTED CONTEXT FIRST (MANDATORY)

When a user attaches files/directories with @/path, the content is already injected into
your context. BEFORE running any tool:

  1. Read the [FILE REFERENCE] block(s) in the conversation context
  2. Identify the project language(s) from file extensions and imports
  3. Note the Docker path (shown in the FILE REFERENCE block) — use it for execute commands
  4. Map the overall project structure: entry points, routes, DB queries, auth logic, parsers

DO NOT run scanners blindly before reading the code. Static analysis confirms WHERE patterns
exist. Reading tells you IF they are exploitable.

---

## STEP 1 — LANGUAGE DETECTION

Determine the primary language from file extensions in the directory tree:

  .py           → Python
  .js / .ts     → JavaScript / TypeScript
  .go           → Go
  .php          → PHP
  .rb           → Ruby
  .java         → Java
  .cs           → C# / .NET
  .c / .cpp     → C / C++
  Gemfile       → Ruby (Rails likely)
  pom.xml       → Java (Maven)
  build.gradle  → Java / Kotlin (Gradle)
  composer.json → PHP
  package.json  → Node.js (JavaScript / TypeScript)
  go.mod        → Go
  Cargo.toml    → Rust
  requirements.txt / pyproject.toml → Python

Mixed codebases: run appropriate scanner for EACH language found.

---

## STEP 2 — STATIC ANALYSIS BY LANGUAGE

Run the correct scanner for the detected language. All scanners write output to
/workspace/<target>/output/. Replace <src_path> with the actual Docker path from the
FILE REFERENCE block.

### PYTHON
  # Bandit — SAST for common security flaws (injection, hardcoded secrets, weak crypto)
  bandit -r <src_path> -f json -o /workspace/<target>/output/bandit.json -ll
  # Semgrep — OWASP patterns + Python-specific rules
  semgrep --config=p/python --config=p/owasp-top-ten <src_path> --json -o /workspace/<target>/output/semgrep_py.json
  # Secrets
  semgrep --config=p/secrets <src_path> --json -o /workspace/<target>/output/semgrep_secrets.json
  # Trufflehog (git history secrets — only if .git exists)
  trufflehog filesystem <src_path> --json > /workspace/<target>/output/trufflehog.json 2>/dev/null

### JAVASCRIPT / TYPESCRIPT
  # Semgrep JS/TS
  semgrep --config=p/javascript --config=p/typescript <src_path> --json -o /workspace/<target>/output/semgrep_js.json
  # XSS sinks
  semgrep --config=p/xss <src_path> --json -o /workspace/<target>/output/semgrep_xss.json
  # Secrets in JS
  semgrep --config=p/secrets <src_path> --json -o /workspace/<target>/output/semgrep_secrets.json
  # npm audit (if package-lock.json exists)
  cd <src_path> && npm audit --json > /workspace/<target>/output/npm_audit.json 2>/dev/null

### GO
  # Gosec — Go security checker
  which gosec || go install github.com/securego/gosec/v2/cmd/gosec@latest
  gosec -fmt json -out /workspace/<target>/output/gosec.json ./... 2>/dev/null  # run from src dir
  # Semgrep Go
  semgrep --config=p/golang <src_path> --json -o /workspace/<target>/output/semgrep_go.json

### PHP
  # Semgrep PHP
  semgrep --config=p/php <src_path> --json -o /workspace/<target>/output/semgrep_php.json
  # Semgrep secrets
  semgrep --config=p/secrets <src_path> --json -o /workspace/<target>/output/semgrep_secrets.json

### RUBY / RAILS
  # Brakeman — Rails-specific SAST
  which brakeman || gem install brakeman
  brakeman <src_path> -f json -o /workspace/<target>/output/brakeman.json --no-pager 2>/dev/null
  # Semgrep Ruby
  semgrep --config=p/ruby <src_path> --json -o /workspace/<target>/output/semgrep_rb.json

### JAVA
  # Semgrep Java
  semgrep --config=p/java --config=p/owasp-top-ten <src_path> --json -o /workspace/<target>/output/semgrep_java.json
  # Secrets
  semgrep --config=p/secrets <src_path> --json -o /workspace/<target>/output/semgrep_secrets.json

### C# / .NET
  # Semgrep C#
  semgrep --config=p/csharp <src_path> --json -o /workspace/<target>/output/semgrep_cs.json

### C / C++
  # Flawfinder — C/C++ vulnerability scanner
  which flawfinder || pip3 install flawfinder --break-system-packages
  flawfinder --dataonly <src_path> > /workspace/<target>/output/flawfinder.txt
  # Semgrep C/C++
  semgrep --config=p/c <src_path> --json -o /workspace/<target>/output/semgrep_c.json

### GENERIC (any language, secrets focus)
  semgrep --config=p/secrets <src_path> --json -o /workspace/<target>/output/semgrep_secrets.json
  semgrep --config=p/security-audit <src_path> --json -o /workspace/<target>/output/semgrep_audit.json
  trufflehog filesystem <src_path> --json > /workspace/<target>/output/trufflehog.json 2>/dev/null

---

## STEP 3 — TRIAGE FINDINGS (MANDATORY — do not skip)

After scanners complete, parse and triage the output. Start with:

  python3 -c "
  import json, sys
  with open('/workspace/<target>/output/bandit.json') as f:
      d = json.load(f)
  findings = d.get('results', [])
  high = [r for r in findings if r['issue_severity'] in ('HIGH', 'MEDIUM')]
  for r in sorted(high, key=lambda x: x['issue_severity'])[:20]:
      print(f\"{r['issue_severity']:8} | {r['test_id']:20} | {r['filename']}:{r['line_number']} | {r['issue_text'][:80]}\")
  "

For semgrep JSON output:
  python3 -c "
  import json
  with open('/workspace/<target>/output/semgrep_py.json') as f:
      d = json.load(f)
  for r in d.get('results', [])[:30]:
      sev = r.get('extra', {}).get('severity', '?')
      msg = r.get('extra', {}).get('message', '')[:80]
      path = r['path']
      line = r['start']['line']
      print(f'{sev:8} | {path}:{line} | {msg}')
  "

PRIORITIZE (investigate first):
  1. Hardcoded secrets / API keys / passwords (immediate active credential test)
  2. SQL string concatenation → trace to user input → test endpoint
  3. eval() / exec() / system() / shell_exec() / subprocess with user input
  4. Unserialize / pickle.loads() / ObjectInputStream on untrusted data
  5. Path traversal: open() / file() with user-controlled path (no sanitization)
  6. SSRF: requests.get(user_input) / urllib.urlopen(user_input) patterns
  7. JWT without algorithm verification / weak secret
  8. Insecure cryptography: MD5/SHA1 for passwords, weak RNG

---

## STEP 4 — MANUAL CODE REVIEW (CRITICAL STEP)

For every high-priority finding from Step 3:

  1. Open the file at the flagged line: use read_file tool with the Docker path
  2. Read 30-50 lines around the finding
  3. Trace the data flow:
       - Where does the input ORIGINATE? (HTTP request parameter, file upload, environment var?)
       - Does it pass through any sanitization / validation? (Is it bypassable?)
       - Does it reach the dangerous sink UNMODIFIED?
  4. Identify the triggering HTTP endpoint or function call
  5. Determine exploitability: can you craft a payload that reaches this sink?

For web apps — find the routes file first:
  Python/Flask:   app.py, routes.py, views.py, blueprints/
  Django:         urls.py, views.py
  Express:        routes/, app.js, index.js, server.js
  Rails:          config/routes.rb, app/controllers/
  Laravel:        routes/web.php, routes/api.php, app/Http/Controllers/
  Spring Boot:    @RequestMapping / @GetMapping / @PostMapping annotations

For each dangerous function: grep for all callers to map the full attack surface:
  grep -rn "eval\|exec\|system\|shell_exec\|subprocess" <src_path> --include="*.py"

---

## STEP 5 — VULNERABILITY CLASSES TO PRIORITIZE IN SOURCE CODE

When reading code manually, look for these HIGH-IMPACT patterns:

INJECTION VULNERABILITIES:
  SQL: "SELECT ... " + user_input  OR  f"SELECT ... {var}"  (no parameterization)
  CMD: subprocess.call(f"cmd {input}", shell=True)  OR  os.system(user_input)
  SSTI: render_template_string(user_input)  OR  env.from_string(user_input)
  XXE: ElementTree.parse() without defusedxml, lxml etree without resolve_entities=False
  LDAP: ldap.search_s() with unsanitized user input

AUTHENTICATION & AUTHORIZATION:
  Hardcoded credentials in source or config files
  JWT: "algorithm": "none"  OR  jwt.decode() without algorithm verification
  Session tokens: predictable / non-random (time-based, sequential)
  IDOR: queries filtered only by user-supplied ID (no ownership check)
  Mass Assignment: Model(**request.json) with no field filtering

DESERIALIZATION:
  Python: pickle.loads(user_data)  OR  yaml.load(data, Loader=Loader)  (not SafeLoader)
  PHP: unserialize($_GET['data'])
  Java: ObjectInputStream.readObject()  OR  XStream.fromXML() on untrusted data
  Ruby: Marshal.load(user_data)

PATH TRAVERSAL:
  open(user_input)  without normalization and containment check
  send_file(user_input)  without path sanitization
  os.path.join(base, user_input)  when user_input starts with "/"

SSRF:
  requests.get(user_input)  OR  urllib.urlopen(user_input)  without URL validation
  Webhooks: storing user-provided URLs and fetching them server-side
  PDF/image generation from user-supplied URLs

CRYPTOGRAPHIC FAILURES:
  hashlib.md5(password)  OR  hashlib.sha1(password)  for password storage
  random.random()  OR  random.randint()  for tokens, nonces, reset codes (use secrets.token_hex)
  Hard-coded IV / symmetric keys in source

SECRETS IN CODE:
  API_KEY = "sk-..."  or  PASSWORD = "hunter2"  in any source file
  .env files committed to repo (check git log --all -p -- .env)
  AWS credentials, private keys, tokens in comments or config

---

## STEP 6 — CONFIRM AND EXPLOIT

A finding is only a vulnerability when exploited with evidence. For each confirmed path:

  [ ] Craft the minimum payload that reaches the sink
  [ ] Trigger it via the appropriate mechanism (HTTP request, file upload, CLI argument)
  [ ] Capture the concrete output (error, data exfiltrated, RCE output, blind timing)
  [ ] Document: vulnerable line → data flow → endpoint → payload → evidence

For web app source code: you can start the app in Docker if it is self-contained:
  cd /workspace/<target>
  # Python: pip install -r requirements.txt && python app.py &
  # Node.js: npm install && node server.js &
  # Then test with curl -x http://127.0.0.1:48080 against localhost

---

## STEP 7 — REPORT

Use create_vulnerability_report for EVERY confirmed, exploitable finding.

Required evidence:
  - poc_description: exact payload used + concrete output received
  - poc_script_code: working Python/curl/bash script demonstrating exploitation
  - technical_analysis: exact file path, line number, data flow description
  - suggested_fix: corrected code snippet (parameterized query, safe API, sanitization)

DO NOT report:
  - Unverified semgrep/bandit findings without manual confirmation
  - "Potential" or "possible" issues without demonstrated exploitation
  - Informational issues (version disclosure, missing headers) unless specifically requested

---

## COMMON MISTAKES — AVOID THESE

  WRONG: Run semgrep, copy its output as findings → REPORT ALL
  RIGHT: Run semgrep, read flagged lines manually, trace data flow, exploit, then report

  WRONG: "Found eval() at line 42 — this is RCE"
  RIGHT: "Found eval(user_param) at line 42. user_param = request.args['cmd'].
          Tested GET /?cmd=__import__('os').system('id') → returned 'uid=33(www-data)' in response body"

  WRONG: Try to open /home/pikpikcu/.../workspace/src/ in execute
  RIGHT: Use /workspace/<target>/uploads/ path (or whatever the FILE REFERENCE block shows)

  WRONG: Report every bandit LOW finding
  RIGHT: Focus on HIGH/MEDIUM severity + any hardcoded secrets

---

## DEPENDENCY VULNERABILITY SCAN (BONUS — run after main analysis)

  # Python
  pip-audit -r <src_path>/requirements.txt --format=json > /workspace/<target>/output/pip_audit.json 2>/dev/null
  safety check -r <src_path>/requirements.txt --json > /workspace/<target>/output/safety.json 2>/dev/null

  # Node.js
  cd <src_path> && npm audit --json > /workspace/<target>/output/npm_audit.json 2>/dev/null

  # Ruby
  cd <src_path> && bundle-audit check --update > /workspace/<target>/output/bundle_audit.txt 2>/dev/null

  # Java (Maven)
  cd <src_path> && mvn org.owasp:dependency-check-maven:check 2>/dev/null || true

Known CVEs in dependencies are worth reporting if the vulnerable functionality
is actually used in the codebase — confirm usage before reporting.
