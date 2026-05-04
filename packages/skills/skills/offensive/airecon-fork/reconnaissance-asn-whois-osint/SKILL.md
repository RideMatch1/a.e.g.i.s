<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: asn-whois-osint
description: ASN/CIDR discovery, WHOIS lookups, BGP enumeration, IP range mapping, and OSINT passive reconnaissance to map the full attack surface of an organization without active scanning
---

# ASN / CIDR / WHOIS / OSINT Reconnaissance

Passive infrastructure mapping: find ALL IP ranges owned by a target using ASN lookups, WHOIS, BGP data, and OSINT — before any active scanning. Goal: build a complete picture of the organization's internet-facing assets.

---

## WHOIS

### Domain WHOIS

    whois target.com
    # Key fields to extract:
    # Registrar, Registrant Org, Registrant Email, Name Servers, Admin Email
    # Admin email → pivot to find other domains registered by same person/org

    # Bulk domain WHOIS via web_search:
    web_search("whois target.com")
    web_search("site:whois.domaintools.com target.com")

### IP WHOIS (find IP owner and CIDR block)

    whois 1.2.3.4
    # Key fields: netname, org, CIDR, route, abuse email
    # CIDR block revealed = scan entire range if in scope

    # Example output:
    # NetRange: 192.0.2.0 - 192.0.2.255
    # CIDR: 192.0.2.0/24
    # NetName: TARGET-CORP-NET
    # Organization: Target Corp (TC-1234)

---

## ASN Lookup

ASN (Autonomous System Number) = organization's routing identity. One ASN = all their IP ranges.

    # Find ASN by organization name:
    whois -h whois.radb.net '!gAS<ASN>'
    # Or use amass:
    amass intel -org "Target Corp"
    # Returns: ASN numbers associated with that org name

    # Find ASN by IP:
    whois -h whois.cymru.com " -v 1.2.3.4"
    # Returns: ASN | IP | BGP Prefix | CC | Registry | Allocated | AS Name

    # Bulk IPs:
    whois -h whois.cymru.com " -v -f" << EOF
    1.2.3.4
    5.6.7.8
    EOF

    # Online alternatives (via web_search):
    web_search("ASN lookup Target Corp site:bgp.he.net")
    web_search("site:ipinfo.io \"Target Corp\" ASN")

---

## CIDR / IP Range Discovery

### From ASN → All IP ranges

    # Once you have the ASN (e.g., AS12345):
    whois -h whois.radb.net -- '-i origin AS12345' | grep -E "^route:"
    # Lists all IP prefixes announced by that ASN

    # Using amass:
    amass intel -asn 12345
    # Returns all CIDR blocks for that ASN

    # asnmap (ProjectDiscovery — no API key needed):
    asnmap -a AS12345                        # CIDR blocks for ASN
    asnmap -org "Target Corp"               # Find ASN by org name + get CIDRs
    asnmap -d target.com                    # ASN lookup via domain
    asnmap -a AS12345 -json > output/asn_ranges.json
    # Install: go install github.com/projectdiscovery/asnmap/cmd/asnmap@latest

    # Pipe to nrich for passive enrichment (no active scan):
    asnmap -a AS12345 | mapcidr -silent | nrich -
    # → gets all known open ports/CVEs for every IP in the ASN range from Shodan InternetDB

    # mapcidr — expand CIDR to individual IPs:
    echo "192.0.2.0/24" | mapcidr -silent
    # Install: go install github.com/projectdiscovery/mapcidr/cmd/mapcidr@latest

---

## BGP / Routing Intelligence

    # Hurricane Electric BGP Toolkit (via web_search):
    web_search("site:bgp.he.net \"Target Corp\"")
    # Reveals: ASN, all prefixes, peer ASNs, routing table

    # BGPView (via web_search):
    web_search("site:bgpview.io \"Target Corp\"")

    # RIPE NCC (for European orgs):
    web_search("site:stat.ripe.net \"Target Corp\"")

    # PeeringDB (find network presence):
    web_search("site:peeringdb.com \"Target Corp\"")

---

## IP Enrichment with nrich (no API key)

nrich queries Shodan InternetDB — passive, no active scan:

    # Single IP enrichment:
    echo "1.2.3.4" | nrich -

    # Bulk IPs from file:
    cat output/live_ips.txt | nrich -

    # JSON output:
    cat output/live_ips.txt | nrich - -json > output/nrich_enriched.json

    # nrich returns per IP (from Shodan InternetDB):
    # - open_ports: [80, 443, 22, 3306]
    # - cves: ["CVE-2021-44228", "CVE-2023-38408"]
    # - cpes: ["cpe:/a:apache:http_server:2.4.49"]
    # - tags: ["self-signed", "starttls"]

    # Workflow: ASN → CIDR → IPs → nrich (passive pre-check) → nmap (targeted active scan)
    asnmap -a AS12345 | mapcidr -silent | nrich - -json | tee output/nrich_results.json

---

## Subdomain / DNS OSINT

    # Passive DNS — find all subdomains without active brute force:

    # amass (comprehensive passive):
    amass enum -passive -d target.com -o output/amass_passive.txt

    # subfinder (ProjectDiscovery — multi-source passive):
    subfinder -d target.com -o output/subfinder.txt
    subfinder -d target.com -all -recursive -o output/subfinder_full.txt

    # Certificate transparency (crt.sh):
    curl -s "https://crt.sh/?q=%.target.com&output=json" | \
      jq -r '.[].name_value' | sort -u > output/crtsh_subdomains.txt

    # Or via web_search:
    web_search("site:crt.sh %.target.com")

    # dnsx — DNS resolution + validation:
    cat output/subfinder.txt | dnsx -a -resp -o output/resolved.txt

---

## Reverse WHOIS / Email Pivot

Find all domains registered by the same organization:

    # Via web_search:
    web_search("reverse whois \"Target Corp\" site:viewdns.info")
    web_search("reverse whois \"admin@target.com\" site:viewdns.info")

    # DomainTools reverse WHOIS (via web_search):
    web_search("site:domaintools.com \"Target Corp\" reverse whois")

    # Find other domains registered with same email:
    web_search("\"registrant@target.com\" whois domains")

---

## IP Geolocation & ISP Info

    # ipinfo.io (no API key for basic use):
    curl ipinfo.io/1.2.3.4
    # Returns: ip, city, region, country, org (ISP/ASN), postal, loc (coordinates)

    # Bulk lookup via web_search:
    web_search("site:ipinfo.io 1.2.3.4")

---

## Full Passive Recon Workflow

    # Step 1: Domain → IP → WHOIS
    whois target.com                         # Registrant info, name servers
    host target.com                          # A record → main IP
    whois <IP>                               # CIDR block + org name

    # Step 2: Org name → ASN → all CIDRs
    asnmap -org "Target Corp"               # Or: amass intel -org "Target Corp"

    # Step 3: CIDRs → all IPs → passive enrichment
    asnmap -a AS12345 | mapcidr -silent > output/all_ips.txt
    cat output/all_ips.txt | nrich - -json > output/nrich_results.json
    # Review: CVEs, open ports, interesting services — without touching a single IP

    # Step 4: Subdomain enumeration
    subfinder -d target.com -o output/subdomains.txt
    cat output/subdomains.txt | dnsx -a -resp -o output/resolved.txt

    # Step 5: Enrich resolved IPs
    cat output/resolved.txt | grep -oE '[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}' | \
      sort -u | nrich - -json >> output/nrich_results.json

    # Step 6: Google dork (see dorking.md)
    web_search("site:target.com")
    web_search("site:target.com filetype:env")

---

## Pro Tips

1. `asnmap -org "Target Corp"` often finds IP ranges the org doesn't publicize — shadow IT
2. `nrich` is completely passive — queries Shodan's pre-built InternetDB, no active probing
3. WHOIS admin email pivot often reveals subsidiary domains not linked from main site
4. Certificate transparency (crt.sh) finds internal/staging subdomains using wildcard certs
5. BGP data from bgp.he.net shows peering relationships → find CDN/cloud providers used
6. Always run nrich BEFORE nmap — filter targets by known CVEs to prioritize scanning

## Summary

Passive infrastructure mapping order:
1. `whois target.com` → registrant info, name servers
2. `whois <IP>` → CIDR block, org name
3. `asnmap -org "Target Corp"` → all ASNs + CIDRs
4. `mapcidr` + `nrich` → all IPs enriched with CVEs/ports from Shodan InternetDB (no API key)
5. `subfinder` + `dnsx` → all subdomains resolved
6. `crt.sh` → certificate transparency for hidden subdomains
7. Reverse WHOIS on admin email → find related domains

Full picture built without sending a single packet to the target.
