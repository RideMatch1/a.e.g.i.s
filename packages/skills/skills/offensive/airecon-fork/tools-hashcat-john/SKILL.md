<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: hashcat-john
description: Password cracking with hashcat and John the Ripper — hash identification, attack modes, rules, wordlists, specific hash types for Windows NTLM, Linux shadow, web hashes, and Kerberos tickets
---

# Hashcat & John the Ripper

Password cracking = identify hash type → choose attack mode → use wordlist + rules → crack. hashcat = GPU-accelerated (faster). john = CPU-based (easier syntax, more built-in tools).

**Install:**
```
sudo apt-get install -y hashcat john hash-identifier
sudo apt-get install -y hashid
# wordlists:
sudo apt-get install -y wordlists
ls /usr/share/wordlists/   # rockyou.txt.gz → gunzip it
sudo gzip -d /usr/share/wordlists/rockyou.txt.gz
```

---

## Hash Identification

    # hash-identifier:
    hash-identifier '<hash_string>'

    # hashid:
    hashid '<hash>'
    hashid -m '<hash>'    # -m = show hashcat mode number

    # Identify by length and format:
    # 32 chars hex → MD5 ($1) or NTLM
    # 40 chars hex → SHA1
    # 60 chars $2y$ → bcrypt
    # 64 chars hex → SHA256
    # 128 chars hex → SHA512
    # $1$ → MD5crypt (Linux)
    # $5$ → SHA256crypt
    # $6$ → SHA512crypt
    # $apr1$ → Apache MD5
    # $y$ → yescrypt

    # hashcat example hashes (reference):
    # https://hashcat.net/wiki/doku.php?id=example_hashes

---

## Common Hash Modes (hashcat -m)

    | Mode  | Hash Type                    |
    |-------|------------------------------|
    | 0     | MD5                          |
    | 100   | SHA1                         |
    | 1000  | NTLM (Windows)               |
    | 1400  | SHA256                       |
    | 1700  | SHA512                       |
    | 1800  | SHA512crypt $6$ (Linux)      |
    | 500   | MD5crypt $1$ (Linux)         |
    | 3200  | bcrypt $2*$                  |
    | 13100 | Kerberoast TGS               |
    | 18200 | Kerberos AS-REP              |
    | 5600  | NetNTLMv2                    |
    | 5500  | NetNTLMv1                    |
    | 2500  | WPA/WPA2 PMKID               |
    | 13600 | WinZip (ZIP AES-256)         |
    | 22921 | RSA/DSA/EC SSH private key   |
    | 7100  | macOS PBKDF2-SHA512          |

---

## hashcat Attack Modes

### Wordlist Attack (-a 0)

    # Basic wordlist:
    hashcat -m 1000 hash.txt /usr/share/wordlists/rockyou.txt

    # With rules (BEST — adds 10x coverage):
    hashcat -m 1000 hash.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/best64.rule
    hashcat -m 1000 hash.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/rockyou-30000.rule
    hashcat -m 1000 hash.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/d3ad0ne.rule

    # Multiple wordlists:
    hashcat -m 1000 hash.txt wordlist1.txt wordlist2.txt

### Brute Force (-a 3)

    # Charset masks: ?l=lowercase, ?u=uppercase, ?d=digit, ?s=special, ?a=all
    hashcat -m 1000 hash.txt -a 3 ?u?l?l?l?l?d?d    # Aaaaaa00 pattern
    hashcat -m 1000 hash.txt -a 3 -i ?a?a?a?a?a?a    # Incremental 1-6 chars all charset
    hashcat -m 1000 hash.txt -a 3 Password?d?d?d      # Password + 3 digits

### Combination Attack (-a 1)

    # Combine two wordlists:
    hashcat -m 1000 hash.txt wordlist1.txt wordlist2.txt -a 1

### Hybrid Attack (-a 6/7)

    # Wordlist + mask:
    hashcat -m 1000 hash.txt -a 6 /usr/share/wordlists/rockyou.txt ?d?d?d?d   # word + 4 digits
    # Mask + wordlist:
    hashcat -m 1000 hash.txt -a 7 ?d?d /usr/share/wordlists/rockyou.txt       # 2 digits + word

---

## Common Cracking Scenarios

### Windows NTLM (from secretsdump, Responder)

    hashcat -m 1000 ntlm_hashes.txt /usr/share/wordlists/rockyou.txt
    hashcat -m 1000 ntlm_hashes.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/best64.rule
    # Hash format: username:RID:LM:NTLM:::
    # Extract NTLM only: cut -d: -f4 secretsdump_output.txt > ntlm_only.txt

### Linux Shadow (/etc/shadow)

    # Extract hash:
    sudo cat /etc/shadow | grep -v "!\|\*" > shadow_hashes.txt
    # Format: $6$salt$hash (SHA512crypt)
    hashcat -m 1800 shadow_hashes.txt /usr/share/wordlists/rockyou.txt

    # Unshadow (combine /etc/passwd + /etc/shadow for john):
    unshadow /etc/passwd /etc/shadow > combined.txt
    john combined.txt --wordlist=/usr/share/wordlists/rockyou.txt

### Kerberoast TGS Tickets

    hashcat -m 13100 kerberoast.txt /usr/share/wordlists/rockyou.txt
    hashcat -m 13100 kerberoast.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/best64.rule

### AS-REP Roasting

    hashcat -m 18200 asrep.txt /usr/share/wordlists/rockyou.txt

### NetNTLMv2 (from Responder)

    hashcat -m 5600 netntlmv2.txt /usr/share/wordlists/rockyou.txt
    hashcat -m 5600 netntlmv2.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/best64.rule

### Web Application Hashes

    # MD5: $0$, no prefix
    hashcat -m 0 web_hashes.txt /usr/share/wordlists/rockyou.txt

    # SHA256 (Django, etc.):
    hashcat -m 1400 sha256_hashes.txt /usr/share/wordlists/rockyou.txt

    # bcrypt (most web apps):
    hashcat -m 3200 bcrypt_hashes.txt /usr/share/wordlists/rockyou.txt
    # NOTE: bcrypt is slow — GPU helps but still slow; focus on weak passwords

    # WordPress (phpass $P$):
    hashcat -m 400 wp_hashes.txt /usr/share/wordlists/rockyou.txt

### SSH Private Key

    # Convert key to hash first:
    ssh2john id_rsa > id_rsa.hash
    john id_rsa.hash --wordlist=/usr/share/wordlists/rockyou.txt
    # OR:
    hashcat -m 22921 id_rsa.hash /usr/share/wordlists/rockyou.txt

### ZIP / Archive Password

    zip2john archive.zip > zip.hash
    john zip.hash --wordlist=/usr/share/wordlists/rockyou.txt

    rar2john archive.rar > rar.hash
    john rar.hash --wordlist=/usr/share/wordlists/rockyou.txt

    7z2john archive.7z > 7z.hash
    john 7z.hash --wordlist=/usr/share/wordlists/rockyou.txt

---

## John the Ripper

    # Auto-detect hash format and crack:
    john hash.txt --wordlist=/usr/share/wordlists/rockyou.txt

    # Show cracked passwords:
    john hash.txt --show

    # Specific format:
    john hash.txt --format=NT --wordlist=/usr/share/wordlists/rockyou.txt
    john hash.txt --format=sha512crypt --wordlist=/usr/share/wordlists/rockyou.txt
    john hash.txt --format=bcrypt --wordlist=/usr/share/wordlists/rockyou.txt

    # List all supported formats:
    john --list=formats

    # Rules:
    john hash.txt --wordlist=/usr/share/wordlists/rockyou.txt --rules=All
    john hash.txt --wordlist=/usr/share/wordlists/rockyou.txt --rules=Jumbo

    # Incremental brute force:
    john hash.txt --incremental=Digits       # digits only
    john hash.txt --incremental=Lower        # lowercase only
    john hash.txt --incremental=All          # all chars

---

## Wordlists & Rules

    # Best wordlists:
    /usr/share/wordlists/rockyou.txt          # 14M passwords (go-to)
    /usr/share/seclists/Passwords/darkweb2017-top10000.txt
    /usr/share/seclists/Passwords/probable-v2-top12000.txt

    # Custom wordlist for target (CeWL):
    sudo apt-get install -y cewl
    cewl http://target.com -d 3 -m 5 -w custom_wordlist.txt  # Crawl depth 3, min 5 chars

    # hashcat rules (apply to wordlist for mutations):
    /usr/share/hashcat/rules/best64.rule     # 64 most effective rules
    /usr/share/hashcat/rules/rockyou-30000.rule  # 30k rules
    /usr/share/hashcat/rules/d3ad0ne.rule    # Popular community rules
    /usr/share/hashcat/rules/T0XlC.rule

---

## hashcat Performance

    # Show GPU info:
    hashcat -I

    # Benchmark specific mode:
    hashcat -b -m 1000   # Benchmark NTLM

    # Docker without GPU (CPU mode):
    hashcat -m 1000 hash.txt /usr/share/wordlists/rockyou.txt --force
    # --force required in Docker/VM without native GPU

    # Status during run:
    # Press S for status, P to pause, R to resume, Q to quit

---

## Pro Tips

1. Always use `best64.rule` with rockyou — doubles coverage over plain wordlist for minimal cost
2. NTLM is fastest to crack — 0 iterations, GPU can do billions/sec — prioritize these
3. bcrypt is slowest — only crack with small, focused wordlist; common passwords first
4. `cewl` generates target-specific wordlist from their website — high hit rate for internal pentest
5. `hashid -m` gives hashcat mode directly — no manual lookup needed
6. Kerberoast: crack BEFORE demanding better wordlists — service account passwords are often weak

## Summary

Cracking workflow:
1. `hashid -m <hash>` → identify type and hashcat mode
2. `hashcat -m <mode> hash.txt rockyou.txt` → baseline
3. `hashcat -m <mode> hash.txt rockyou.txt -r best64.rule` → with mutations
4. If fails: `hashcat -a 3 -m <mode> hash.txt ?a?a?a?a?a?a?a?a` → brute force up to 8 chars
5. Kerberoast/NTLM: fast to crack → always attempt. bcrypt: expensive → targeted wordlist only.
