<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# CTF Challenge Methodology — Thinking + Execution Framework

How to approach Capture The Flag challenges. This covers both methodology AND execution
discipline to prevent common mistakes.

---

## Understanding CTF

CTF challenges are designed puzzles where every element is intentional. Unlike bug bounty,
there are no false positives — if something looks strange, it IS the vulnerability.
The challenge author placed every component deliberately.

### CTF Categories

CTF is broad. The challenge type determines your approach:

- **Web** — Vulnerable web applications (the most common in pentest-style CTFs)
- **Crypto** — Cryptographic weaknesses, cipher breaking, key recovery
- **Forensics** — Analyzing files, memory dumps, packet captures, steganography
- **Pwn/Binary** — Buffer overflows, format strings, ROP chains, heap exploitation
- **Reverse Engineering** — Analyzing compiled binaries to understand hidden logic
- **Misc** — Anything goes: OSINT, scripting, puzzles, unconventional challenges

This skill focuses on **web CTF** since AIRecon's tools are web-focused, but the thinking
principles apply to all categories.

---

## CRITICAL: Execution Discipline

These rules prevent the most common failure modes. Follow them STRICTLY.

### Rule 1: Maintain Session State Across ALL Requests

Web applications use cookies to track sessions. If you don't persist cookies, the
application forgets who you are and every request starts from zero.

**EVERY curl command MUST include both `-c` and `-b` with the same cookie file in the output directory:**
- `-c output/cookies.txt` saves cookies from the response
- `-b output/cookies.txt` sends saved cookies with the request
- Use BOTH on EVERY request, not just the first one

If you see a 302 redirect back to a login page, it means your session was lost because
you forgot to send cookies.

### Rule 2: Never Repeat the Same Request

If you already fetched a URL and read its content, DO NOT fetch it again.
You already have the information. Use it.

If you need to reference earlier data, recall it from your conversation context.
The data is already in your memory from the previous tool output.

### Rule 3: Understand Exit Codes

When using `grep` or similar filtering commands:
- **Exit code 0** = matches were found (success)
- **Exit code 1** = NO matches were found (this is NOT an error — it means the pattern
  simply wasn't present in the data)
- **Exit code 2+** = actual error (syntax problem, file not found, etc.)

When the execute tool reports "ERROR: Command failed (exit code: 1)" after a grep,
it means the pattern was NOT found. This is useful information — the flag is not in
that response. Move to the next endpoint.

### Rule 4: Use the Correct Workspace Paths

Your workspace follows a strict structure based on the target:
```
/workspace/<target>/
    command/        ← command execution logs (auto-saved)
    output/         ← YOUR output files go here
    tools/          ← custom scripts you create
    vulnerabilities/ ← vulnerability reports (auto-saved)
```

For example, if the target is `localhost:8080`:
- Save curl output to: `/workspace/localhost:8080/output/main_page.html`
- Save scripts to: `/workspace/localhost:8080/tools/exploit.py`

**Never use** `/workspace/output/` (missing target) or `output/` (relative).

### Rule 5: Don't Use read_file for Files You Haven't Saved

The `read_file` tool reads files from the workspace. If you haven't explicitly saved
a curl response to a file, the file doesn't exist. Either:
- Save it: `curl -s URL > output/filename.html`
- Or just read the curl output directly — it's already in your conversation context

### Rule 6: Handle Redirects With Session

A 302 redirect after login means the login succeeded and the app wants to redirect you.
But a redirect changes POST to GET and may drop cookies. To handle multi-step flows:

1. Make each request separately (don't use `-L` for POST requests)
2. Read the `Location` header from the response
3. Make a NEW GET request to that location, with cookies

### Rule 7: Read the Full Response Before Acting

Don't pipe curl through `head -100` or `grep` on the first request. Read the ENTIRE
response first. After you understand the full page, use grep for specific searches.

### Rule 8: Track Your Discoveries

As you test, keep a mental inventory of what you've found:
- **Credentials discovered**: (from comments, config files, error messages)
- **Endpoints discovered**: (from HTML links, JavaScript, form actions)
- **Hidden fields discovered**: (from form analysis)
- **Session state**: (are you logged in? which user?)

Every new piece of information should inform your next action.

---

## Core Principle: Read Before You Act

The single most important skill in CTF is **reading carefully**.

### Read HTML Completely

Every line matters. The flag or the path to it is hidden in the response:
- Comments that developers "forgot" to remove
- Hidden form fields that reveal internal structure
- JavaScript code that shows how the application ACTUALLY works
- Error messages that leak implementation details
- HTTP headers that reveal the technology stack

### Read JavaScript Completely

JavaScript is the map of the application. It shows you:
- Every API endpoint the frontend communicates with
- The exact URL patterns and parameter names
- How data flows between pages
- Authentication and authorization logic on the client side
- AJAX calls that reveal backend routes invisible in the HTML

**IMPORTANT:** JavaScript is often at the BOTTOM of the HTML page. If you only read the
first part of a response, you miss the most critical information.

### Read Error Messages

Errors are not failures — they are information:
- A 400 Bad Request tells you what the server EXPECTED
- A 404 tells you the URL pattern is wrong — re-examine the source
- A 405 tells you the HTTP method is wrong
- A 500 may leak stack traces, file paths, database queries
- A 302 redirect tells you WHERE the application wants you to go

---

## Methodology: Observe → Hypothesize → Test → Adapt

### Step 1: Observe

Fetch the application and absorb EVERYTHING. Don't rush to test.
- What does this application do? What is its purpose?
- What technology is it built with?
- What are all the routes, forms, and interactive elements?
- What does the JavaScript reveal about the backend?
- Are there HTML comments, hidden fields, or debug information?
- What does the HTTP response header tell you about the server?

### Step 2: Hypothesize

Based on your observations, form theories about where the vulnerability is:
- "This form has a multi-step flow — maybe the second step has weaker validation"
- "These numeric IDs in the URL suggest predictable identifiers"
- "This search parameter reflects input back — possible injection point"
- "The JavaScript reveals an endpoint not linked in the UI"
- "This hidden field contains a user ID — maybe I can change it"

### Step 3: Test

Test ONE hypothesis at a time. Use the right tool for the job:
- **curl / execute**: When you need to see raw HTTP responses, control exact headers,
  manage cookies manually, or chain multiple requests
- **browser_action**: When you need to interact with JavaScript-heavy applications,
  see rendered pages, click buttons, fill forms interactively
- **Caido proxy**: When you need to intercept and modify requests in-flight, replay
  requests with modifications, or analyze traffic patterns

### Step 4: Adapt

If your test fails, DON'T repeat it. Adapt:
- Analyze WHY it failed — what did the error tell you?
- Go back to the response and read it again more carefully
- Form a NEW hypothesis based on the error
- Try a different approach or a different part of the application

---

## Web CTF Thinking Patterns

### Pattern: Multi-Step Authentication

Many web apps split authentication across multiple pages. Each page has its own form
with its own fields. You MUST interact with each page separately, following the
application's intended flow but looking for weaknesses at each step.

**Think about:**
- What fields does this specific form expect?
- What happens when I submit? Where does it redirect?
- Can I manipulate the redirect destination?
- Can I skip a step entirely?
- Are there hidden fields I can modify?

### Pattern: Object References

When you see identifiers in URLs or responses (numbers, UUIDs, slugs), ask yourself:
- Who does this object belong to?
- Can I access objects that belong to other users?
- Is there a sequential pattern I can predict?
- What happens if I use an ID that shouldn't be accessible to me?

### Pattern: Client-Side Trust

Applications often trust client-side data. Think about:
- Hidden form fields that could be editable
- Cookie values that encode user information
- Client-side validation that can be bypassed
- Prices, permissions, or roles stored in the request

### Pattern: Information Leakage

Developers leave traces. Think about:
- HTML comments with development notes
- Backup files or configuration files accessible via URL
- Error messages that reveal code structure
- Response headers that leak technology information
- API endpoints that return more data than the UI shows

### Pattern: Injection Points

Wherever user input enters the application, think about:
- Is this input reflected in the response?
- Is this input used in a database query?
- Is this input used in a file path?
- Is this input used in a system command?
- Is this input used in a template?

### Pattern: Session and State

Think about how the application tracks who you are:
- How is your session maintained after login?
- Can you forge or modify session tokens?
- What happens if you perform actions without a valid session?
- Can you escalate permissions by manipulating session data?

---

## Tool Selection: Context Matters

There is no "best tool" — each tool has a purpose:

### Use curl (execute) when:
- You need to see the raw, unprocessed HTTP response
- You want full control over headers, cookies, and request body
- You're testing specific parameter values
- You need to chain multiple requests with shared cookies
- You want to automate testing with loops or scripts

### Use browser_action when:
- The application relies heavily on JavaScript for rendering
- You need to interact with dynamic elements (dropdowns, modals, AJAX)
- You need to fill forms that have client-side validation
- You want to see what a real user sees
- JavaScript execution is required to trigger certain behaviors

### Use Caido when:
- You want to intercept and modify requests between browser and server
- You need to replay a captured request with slight modifications
- You want to analyze the full traffic flow of a complex interaction
- You're testing race conditions or need precise request timing
- You need to compare responses across multiple modified requests

### Write custom scripts (execute with Python) when:
- You need to automate a specific testing pattern
- The vulnerability requires complex multi-step exploitation
- You need to brute-force a specific parameter space
- You want to parse and analyze large responses programmatically

---

## Common Mistakes in CTF

1. **Not reading the full response** — The answer is in the data you already received
2. **Repeating the same request** — If it failed, change your approach
3. **Guessing URL patterns** — Read the JavaScript to find exact endpoints
4. **Sending extra form fields** — Only send what the form expects
5. **Using the wrong HTTP method** — Check the form's method attribute
6. **Ignoring redirects** — Follow them to see where the app takes you
7. **Not managing cookies** — Authentication requires session persistence
8. **Running recon scanners** — CTF is a focused puzzle, not a wide-net hunt
9. **Over-automating** — Sometimes manually reading a response reveals the flag
10. **Not thinking about the challenge author's intent** — Ask "what did they WANT me to find?"

---

## Flag Detection Pattern

The flag is the proof that you solved the challenge. You must actively look for it
in EVERY response you receive.

### Flag Formats

Flags follow recognizable patterns, but the format varies by CTF:
- `FLAG{...}` — the most common format
- `flag{...}` — lowercase variant
- `CTF{...}` — competition-specific prefix
- Custom formats: `XBOW{...}`, `HTB{...}`, `picoCTF{...}`, etc.
- Sometimes the flag is a plain string described in the challenge instructions

**IMPORTANT:** Always check the challenge description for the expected flag format.
If the challenge says "the flag is in format FLAG{...}", that's what you search for.

### Where Flags Appear

Flags can be embedded ANYWHERE in the application's responses. Develop the habit of
scanning every response you receive:

- **In the HTTP response body** — embedded in HTML, JSON, or plain text
- **In HTTP response headers** — custom headers like `X-Flag:` or `X-Secret:`
- **In HTML comments** — `<!-- FLAG{...} -->`
- **In database records** — accessible through data access vulnerabilities
- **In files on the server** — accessible through file access vulnerabilities
- **In error messages** — verbose errors may include flag data
- **In cookies or tokens** — decoded JWT payloads, base64-encoded cookie values
- **In JavaScript variables** — hardcoded in client-side code
- **In API responses** — JSON fields you don't see in the UI

### Detection Approach

After EVERY significant interaction with the application:
1. Scan the full response for the expected flag pattern
2. Check if any new data was revealed that you haven't seen before
3. Look for base64-encoded strings and decode them — they may contain the flag
4. If you retrieve structured data (JSON, database rows), examine EVERY field

### When You Find the Flag

The moment you see a string matching the expected flag pattern:
1. Confirm it matches the expected format exactly
2. Report it immediately — don't continue testing

---

## CTF Reporting

CTF reports must be detailed and professional. Finding the flag is only half the work —
documenting the vulnerability, exploitation path, and evidence is equally important.

### When to Report

Call `create_vulnerability_report` immediately when you find the flag.
Do NOT continue testing after finding the flag.

### Report Quality Standard

Every field should demonstrate clear, evidence-based analysis. The report should read
like a professional penetration test finding.

### How to Fill Each Field

**title**: Specific vulnerability name with affected endpoint.
Describe WHAT vulnerability and WHERE it was found. Be precise.

**description**: Executive summary covering:
- What vulnerability was found
- How it was exploited
- What data was exposed
- The flag that was extracted
Write this as a clear paragraph explaining the full finding.

**target**: The full target URL (e.g., `http://localhost:8080`)

**impact**: What an attacker could do with this vulnerability:
- What data is exposed
- How many records or users are affected
- Business consequences

**technical_analysis**: Root cause analysis:
- WHY the vulnerability exists (what check or control is missing)
- What the expected secure behavior should be vs actual behavior
- How the authentication/session mechanism works (if relevant)

**poc_description**: Step-by-step exploitation walkthrough with HTTP evidence:
1. Initial interaction — show the first request and what was discovered
2. Exploitation — show the exact request that exploits the vulnerability
3. Flag extraction — show the exact response containing the flag
Include actual HTTP status codes for every step.

**poc_script_code**: A complete, automated exploitation script that reproduces the
finding end-to-end. Should be executable Python or a series of curl commands.
The script must:
- Handle authentication if needed
- Perform the exact exploit steps
- Search for and extract the flag
- Print the flag when found

**remediation_steps**: Concrete fix recommendations:
- Code-level fix (authorization check before returning data)
- Architecture-level fix (use opaque IDs, implement RBAC)
- Detection (access logging, rate limiting)

**flag**: The exact flag string: `FLAG{...}`

### Optional but Recommended

- **attack_vector** through **availability** (CVSS): Include if you can assess it accurately
- **endpoint**: The specific vulnerable endpoint
- **method**: The HTTP method used
- **suggested_fix**: A code snippet showing the fix

### Reporting Mindset

Think of the report as something that would be submitted to a client. Even though it's
a CTF, the quality should match professional penetration testing standards:
- Evidence-based (show actual HTTP requests and responses)
- Technically detailed (explain the root cause, not just the symptoms)
- Actionable (tell the developer exactly how to fix it)
- Complete (someone else should be able to reproduce this from your report alone)

---

## Summary

CTF is problem-solving, not tool-running. **Read carefully, think deeply, test precisely.**
Every element in a CTF is there for a reason. The flag is always reachable through the
vulnerability the author intended. Your job is to understand the application deeply enough
to find that path. Maintain session state, track your discoveries, and never repeat yourself.
When you find the flag, report it with the same quality as a professional pentest finding.
