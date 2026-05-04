<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# semgrep — Usage Guide for AIRecon

semgrep is a static analysis tool that finds patterns in source code. It is fundamentally different
from network scanners — it reads code files and reports where specific patterns appear. This means
it is only useful when you have actual source code or client-side files to analyze. Running semgrep
on an empty directory or before code has been obtained produces nothing useful.

semgrep findings are NOT confirmed vulnerabilities. They are leads that require manual reading
and verification. Every semgrep hit must be manually inspected before any further action is taken.

---

## MANDATORY PRE-CONDITIONS (All must be true before using semgrep)

  [ ] You have actual source code, configuration files, or client-side assets to analyze.
      This means you have already obtained one or more of the following:
        - JavaScript bundles extracted from a live web application
        - Source code from an exposed git repository (via git-dumper, GitLab API, etc.)
        - Configuration files discovered during directory enumeration
        - Uploaded or leaked source archives found during OSINT
  [ ] The code is written to disk and accessible — semgrep cannot analyze remote URLs.
      Extracted files must be in the workspace before semgrep can read them.
  [ ] You have a specific hypothesis about what you are looking for.
      State it: "I extracted the JS bundle and want to find hardcoded API keys and secrets"
      or "I have the backend Python source and want to find SQL concatenation patterns."
      NOT: "I will run semgrep to find vulnerabilities" — this is too vague.
  [ ] You have selected a ruleset that matches the programming language of the code you found.
      Running a Java ruleset on JavaScript produces false negatives. Match language precisely.

Using semgrep before obtaining source code = produces zero output, wastes time.
Running semgrep without reading its findings manually = not security testing, it is checkbox theater.

---

## What semgrep Is Good At (When Code Is Available)

  STRONG USE CASES:
    - Finding hardcoded secrets, API keys, and tokens in JS bundles or config files
    - Detecting dangerous function calls: eval(), exec(), system(), unserialize(), etc.
    - Identifying SQL string concatenation patterns that suggest injection vulnerability
    - Finding insecure cryptographic usage (MD5, SHA1 for passwords, weak RNG)
    - Spotting prototype pollution sinks in JavaScript (obj[key] = value patterns)
    - Detecting SSTI-prone template rendering calls
    - Mapping all locations where user input touches dangerous sinks (DOM XSS sources/sinks)
    - Finding dangerously misconfigured security headers in framework config files

  WEAK USE CASES (manual reading is better):
    - Business logic flaws — patterns cannot capture intent
    - Authorization bypass — requires understanding of the full request flow
    - Race conditions — timing-dependent, not findable via static patterns
    - Complex chained vulnerabilities — semgrep sees one file at a time, not the full system

  semgrep finds WHERE code might be dangerous.
  You must determine IF it actually is dangerous by reading the surrounding context manually.

---

## Source Code Acquisition — Get This First

Before semgrep can be used, code must be obtained. Priority order:

  1. EXPOSED GIT REPOSITORY:
     If /.git/ is accessible: use git-dumper to reconstruct the full source tree.
     If GitLab/GitHub is linked in JS or robots.txt: clone or access the repo directly.
     Output: a full source directory you can analyze.

  2. JAVASCRIPT BUNDLE EXTRACTION:
     After browser profiling: collect all .js URLs from the page source.
     Download each bundle: curl -s <url> -o output/js/<filename>.js
     De-obfuscate if minified: js-beautify output/js/<filename>.js -o output/js/<filename>_clean.js
     Output: readable JS files for analysis.

  3. EXPOSED CONFIGURATION FILES:
     If directory enumeration found config files (.env, config.yml, settings.py, web.config, etc.):
     Download them: curl -s <url> -o output/configs/<filename>
     Output: configuration files for secret and misconfiguration analysis.

  4. SOURCE CODE ARCHIVE:
     If a .zip, .tar.gz, or backup file was found: download and extract it.
     Output: a source tree for analysis.

  DO NOT run semgrep until at least one of the above has produced files on disk.

---

## Ruleset Selection — Language and Context Must Match

  JAVASCRIPT / TYPESCRIPT (extracted from web app):
    Detect secrets and dangerous patterns:
      semgrep --config=p/javascript -l javascript output/js/ --json -o output/semgrep_js.json
    Detect prototype pollution and DOM XSS sinks:
      semgrep --config=p/xss output/js/ --json -o output/semgrep_xss.json
    Detect hardcoded secrets:
      semgrep --config=p/secrets output/js/ --json -o output/semgrep_secrets.json

  PYTHON (backend source if obtained):
    Detect injection patterns and insecure functions:
      semgrep --config=p/python output/src/ --json -o output/semgrep_python.json
    OWASP top 10 patterns:
      semgrep --config=p/owasp-top-ten output/src/ --json -o output/semgrep_owasp.json

  JAVA (if backend source is available):
      semgrep --config=p/java output/src/ --json -o output/semgrep_java.json

  PHP (if CMS or backend PHP source obtained):
      semgrep --config=p/php output/src/ --json -o output/semgrep_php.json

  CONFIGURATION FILES (any language — secret and credential detection):
      semgrep --config=p/secrets output/configs/ --json -o output/semgrep_config_secrets.json
      semgrep --config=p/trailofbits output/ --json -o output/semgrep_tob.json

  GENERIC PATTERNS (use when language is uncertain or mixed codebase):
      semgrep --config=p/security-audit output/ --json -o output/semgrep_audit.json

  NEVER use these patterns:
    semgrep --config=auto .         (auto config on empty or irrelevant directory)
    semgrep --config=p/java output/js/  (wrong language for the files you have)
    semgrep . --config=r/all        (all rules on all files = noise, not signal)

---

## Interpreting Results — Every Finding Requires Manual Reading

semgrep output is a list of pattern matches, not a list of vulnerabilities.

After semgrep completes, for EVERY finding:

  STEP 1: Open the flagged file at the flagged line.
    Read the surrounding 20-30 lines. Understand what the code is doing.
    Ask: "Is this actually dangerous in this specific context?"

  STEP 2: Trace the data flow.
    For injection findings: where does the input come from? Is it user-controlled?
    For secret findings: is this a real credential or a placeholder/example?
    For dangerous function findings: what data is passed to this function?

  STEP 3: Determine exploitability.
    Can you construct a request that reaches this code path with malicious input?
    If yes: manually craft the proof-of-concept. Test it.
    If no: discard the finding. Do not report unverified semgrep hits.

  STEP 4: Classify severity based on actual impact, not semgrep's severity label.
    semgrep's severity is based on the rule, not your specific target's context.
    A "HIGH" semgrep finding on dead code is not a vulnerability.
    A "LOW" semgrep finding on a critical authentication path may be critical.

  A semgrep finding is NOT a vulnerability report.
  Only call create_vulnerability_report after manual exploitation confirmation.

---

## Common High-Value Findings to Prioritize

When reading semgrep output, prioritize investigating these first:

  SECRETS (immediate action required):
    API keys, tokens, passwords, private keys found in code
    → Try to use them: verify they are real and active
    → Check scope: is the key for a service within the target's infrastructure?

  SQL CONCATENATION:
    String concatenation in database query construction
    → Trace the input source manually
    → Test the specific endpoint with manual injection probes first

  EVAL / EXEC PATTERNS:
    eval(), exec(), system(), shell_exec(), subprocess.call() with variable input
    → Trace what reaches these functions
    → Is it truly user-controlled? Which endpoint?

  DANGEROUS DESERIALIZATION:
    unserialize(), ObjectInputStream, pickle.loads() on untrusted data
    → Confirm the data source is user-controlled
    → Identify the deserialization library for gadget chain selection

  PROTOTYPE POLLUTION SINKS:
    obj[key] = value, Object.assign() with user input
    → Confirm which client-side functionality is affected
    → Verify if this leads to XSS or logic bypass

---

## Workflow Integration (Where semgrep Fits)

  Phase 1 STEP 4 (Front-End & API Schema Extraction):
    After JS bundle download and de-obfuscation: run semgrep on the cleaned JS files.
    Purpose: find hidden endpoints, secrets, and dangerous patterns in client-side code.

  Phase 2 (Attack Surface Expansion):
    After git repository exposure is confirmed: run semgrep on the extracted source.
    Purpose: map all injection sinks, dangerous function calls, and hardcoded credentials.

  Phase 3+ (Vulnerability Testing):
    semgrep findings from earlier phases guide which endpoints and parameters to test manually.
    The finding tells you WHERE to look. Manual testing tells you IF it is exploitable.

  NEVER:
    Run semgrep before any source code has been obtained.
    Report semgrep findings without manual verification.
    Run semgrep with a ruleset that does not match the language of the files you have.
