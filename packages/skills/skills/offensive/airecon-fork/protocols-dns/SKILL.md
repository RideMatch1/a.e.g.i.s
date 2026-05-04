<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: dns
description: DNS security testing — zone transfer, subdomain enumeration, DNS cache poisoning, DNS tunneling detection, DNSSEC bypass, and DNS-based information disclosure
---

# DNS Security Testing

DNS = domain to IP translation. Attack surface: zone transfer (full record dump), subdomain brute force, DNS cache poisoning, DNS tunneling (exfil), and misconfigured resolvers.

**Install:**
```
sudo apt-get install -y dnsutils bind9-dnsutils fierce dnsenum dnsrecon
go install github.com/projectdiscovery/dnsx/cmd/dnsx@latest
go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
pip install dnsgen --break-system-packages
sudo apt-get install -y amass
```

**Port:** 53/UDP (queries), 53/TCP (zone transfer)

---

## Reconnaissance

    nmap -p 53 <target> -sU --open -sV
    nmap -p 53 <target> -sV                # TCP DNS (zone transfer port)
    nmap -p 53 --script dns-zone-transfer --script-args dns-zone-transfer.domain=target.com <target>

    # Find name servers for domain:
    dig NS target.com
    dig NS target.com +short

    # Find mail servers:
    dig MX target.com +short

---

## Zone Transfer (AXFR)

Zone transfer leaks ALL DNS records — every hostname, IP, MX, TXT:

    # Direct zone transfer:
    dig axfr target.com @ns1.target.com
    dig axfr target.com @<nameserver_ip>

    # Try all nameservers:
    for ns in $(dig NS target.com +short); do
        echo "=== Trying $ns ===";
        dig axfr target.com @$ns;
    done

    # host command:
    host -t axfr target.com ns1.target.com

    # dnsrecon:
    dnsrecon -d target.com -t axfr

---

## Subdomain Enumeration

### Passive (no DNS queries to target)

    # subfinder — multi-source passive:
    subfinder -d target.com -o output/subdomains_passive.txt
    subfinder -d target.com -all -recursive -o output/subdomains_full.txt

    # amass passive:
    amass enum -passive -d target.com -o output/amass_passive.txt

    # Certificate transparency:
    curl -s "https://crt.sh/?q=%.target.com&output=json" | jq -r '.[].name_value' | sort -u

### Active Brute Force

    # fierce:
    fierce --domain target.com --wordlist /usr/share/seclists/Discovery/DNS/fierce-hostlist.txt

    # dnsenum:
    dnsenum target.com
    dnsenum --dnsserver <ns_ip> --enum -f /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt target.com

    # dnsrecon:
    dnsrecon -d target.com -t brt -D /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt

    # dnsx — fast resolver + brute:
    cat /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt | \
      dnsx -d target.com -o output/dnsx_subs.txt

### DNS Permutation/Alteration

    # dnsgen — generate permutations of known subdomains:
    cat output/subdomains.txt | dnsgen - | dnsx -silent > output/permutations.txt

---

## DNS Record Enumeration

    # All common record types:
    dig target.com A                 # IPv4 address
    dig target.com AAAA              # IPv6
    dig target.com MX                # Mail servers
    dig target.com TXT               # Text records (SPF, DKIM, verification tokens)
    dig target.com NS                # Name servers
    dig target.com SOA               # Start of Authority (serial, refresh, admin email)
    dig target.com CNAME             # Aliases
    dig target.com SRV               # Service locator (useful for internal services)
    dig target.com PTR               # Reverse DNS

    # TXT records often contain:
    # SPF: v=spf1 include:mailprovider.com ...
    # DKIM: v=DKIM1; k=rsa; p=<key>
    # Verification: google-site-verification=...
    # Admin contact email embedded in SOA record

    # Reverse DNS (IP → hostname):
    dig -x 1.2.3.4
    dig -x 1.2.3.4 +short

    # Internal DNS — try internal resolver:
    dig @<internal_dns_ip> internal.corp
    dig @<internal_dns_ip> AXFR corp.local   # Internal zone transfer

---

## DNS Cache Poisoning Detection

    # Check if resolver accepts forged responses:
    nmap -sU -p 53 --script dns-recursion <target>
    # Recursion allowed = can be used as open resolver (DoS amplification)

    # Check for DNSSEC:
    dig +dnssec target.com
    # Look for: AD flag (authenticated data) in response

---

## DNS Tunneling Detection

DNS tunneling = exfiltrating data via DNS queries (common C2 channel):

    # Signs of DNS tunneling in PCAP:
    tshark -r capture.pcap -Y "dns" -T fields -e dns.qry.name | \
      awk '{print length, $0}' | sort -rn | head -20
    # Long subdomains (>50 chars) = likely encoded data
    # High-entropy labels = base64/hex encoded

    # Detect via query frequency:
    tshark -r capture.pcap -Y "dns" -T fields -e dns.qry.name | \
      sed 's/[^.]*\.\(.*\)/\1/' | sort | uniq -c | sort -rn
    # One domain getting 1000s of queries = tunneling

    # iodine — DNS tunnel tool (for testing):
    # sudo apt-get install -y iodine
    # Server: iodined -f -c -P password 10.0.0.1 tunnel.target.com
    # Client: iodine -f -P password tunnel.target.com

---

## SPF / DMARC Analysis

    # Check email security posture:
    dig TXT target.com | grep spf
    # Weak SPF: "v=spf1 +all" = anyone can send mail as target.com!
    # Missing DMARC:
    dig TXT _dmarc.target.com
    # p=none = no enforcement (emails will be delivered even if forged)

---

## DNS Amplification (DDoS Vector)

    # Check if resolver is open (accepts queries from any source):
    dig @<target_dns> ANY isc.org
    # Large response = amplification possible

    # DO NOT EXPLOIT without authorization

---

## Wildcard DNS Detection

    # Wildcard = *.target.com resolves to some IP (causes false positives in brute force):
    dig random-nonexistent-sub123456.target.com
    # If it resolves → wildcard enabled → filter brute force results

---

## Pro Tips

1. Zone transfer succeeds on ~15% of real targets — always try all NS servers
2. `subfinder -all` uses 20+ passive sources — run before any active DNS brute force
3. SOA record contains admin email — use for social engineering or phishing
4. TXT records reveal tech stack: SPF shows email providers, v= shows marketing tools
5. Wildcard DNS breaks subdomain brute force — detect with random subdomain query first
6. Internal DNS servers often allow zone transfer from any IP — test from inside the network
7. dnsgen permutations find dev/staging/test subdomains not in wordlists

## Summary

DNS testing: `dig AXFR` on all NS servers → `subfinder -all` passive → `dnsrecon -t brt` brute force → `dnsgen` permutations → record analysis (TXT for SPF/DKIM, SOA for admin email, SRV for internal services). Zone transfer = full infrastructure map in one command. Always check for wildcard before brute force.
