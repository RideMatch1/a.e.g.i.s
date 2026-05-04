<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

## INSTALL STRATEGY (HEADLESS + SKILL-AWARE)

Before running recon/exploit workflows, pick a toolchain profile and verify tools first.

### STEP 0 — Pick Toolchain Profile

  [Web/API baseline]
    nmap, httpx, katana, ffuf, nuclei, sqlmap, dalfox

  [Source review / SAST]
    semgrep, bandit, trivy, eslint, jshint

  [Internal / AD]
    netexec, smbclient, enum4linux-ng, impacket, kerbrute

  [CTF binary/reverse]
    checksec, strings, objdump, radare2, ropper, pwntools

  [Mobile Android APK]
    apktool, jadx, apksigner, apkleaks, apkid, adb, frida-tools, objection

  [Mobile iOS IPA (headless static)]
    unzip, plistutil/plutil, strings, radare2, otool (if available)
    NOTE: full iOS dynamic testing is usually outside this Docker runtime.

### STEP 0.1 — Verify Before Install

  Use this for every required binary:
    which <tool> && (<tool> --version || <tool> --help)

  If missing, install immediately using the protocol below.

### STEP 0.2 — GUI Constraint

  If a workflow requires GUI-only tooling, switch to CLI alternatives first.
  Examples:
    - jadx-gui -> jadx (CLI output dir)
    - Burp GUI -> caido-cli / curl replay / http framework
    - MobSF web UI -> static CLI chain (apktool + jadx + apkleaks + apkid)

## TOOL MISSING — AUTO-INSTALL PROTOCOL:

When a command returns "command not found" or `which <tool>` returns empty:

### STEP 1 — Try known install methods first (fastest):

  [Standard Kali tools]:
    → sudo apt-get update && sudo apt-get install -y <tool>
    → OR: go install github.com/projectdiscovery/<tool>/cmd/<tool>@latest

  [Python tools]:
    → pip install <tool> --break-system-packages (try the exact package name first)
    → If pip name differs from binary name: web_search "<tool> pip install"
    → Example: metagoofil → pip install metagoofil
    → Example: porch-pirate → pip install porch-pirate
    → Example: postleaksNg → pip install postleaks-ng
    → Example: corsy → pip install corsy

  [Go tools]:
    → go install github.com/<author>/<tool>/cmd/<tool>@latest
    → OR: which go || sudo apt-get install -y golang-go

  [GitHub tools]:
    1. web_search "<tool> github install" to find exact repo URL
    2. git clone <repo_url> /home/pentester/tools/<tool>/
    3. cd /home/pentester/tools/<tool>/
    4. pip install -r requirements.txt  OR  npm install  OR  make
    5. Run via: python3 /home/pentester/tools/<tool>/<script>.py

### STEP 2 — If STEP 1 fails or tool is unknown: WEB SEARCH + READ URL

When apt/pip/go install fails, or you don't know where the tool is published:

  MANDATORY FLOW:
    1. web_search("<tool name> install kali linux")
       OR web_search("<tool name> github")
       OR web_search("<tool name> installation guide")

    2. From the search results, identify the most relevant URL:
       - Prefer: official GitHub repo (github.com/author/tool)
       - Prefer: official documentation site
       - Avoid: random blog posts (use only if no official source found)

    3. Open the URL using browser_action to read the full installation instructions:
       browser_action(action="navigate", url="<url_from_search_results>")
       # Read the README, Installation section, or docs page
       # Look for: "Installation", "Install", "Getting Started", "Usage"

    4. Extract the exact install commands from the page:
       # Common patterns to look for:
       # go install ...
       # pip install ...
       # apt-get install ...
       # wget ... && chmod +x ...
       # git clone ... && cd ... && make
       # curl -sSL ... | bash

    5. Execute the extracted install commands in the Docker Kali sandbox

    6. Verify install succeeded:
       which <tool>
       <tool> --version  OR  <tool> --help

  EXAMPLE WORKFLOW:
    # Tool "feroxbuster" not found:
    web_search("feroxbuster install kali linux")
    # Gets result: https://github.com/epi052/feroxbuster
    browser_action(action="navigate", url="https://github.com/epi052/feroxbuster")
    # Reads: "curl -sL https://raw.githubusercontent.com/epi052/feroxbuster/main/install-nix.sh | bash"
    # Executes that command
    which feroxbuster  # confirms install

### STEP 3 — If tool still not installable:

  Fall back to equivalent alternative:
    - feroxbuster / gobuster → use ffuf (already installed)
    - masscan → use nmap --min-rate 5000
    - enum4linux → use enum4linux-ng
    - netcat → use ncat or socat
    - python2 tool → try python3 with 2to3 conversion

  Document the fallback: note which tool was unavailable and what was used instead.

  [Known installs for new Phase 1 tools]:
    metagoofil      → pip install metagoofil --break-system-packages
    porch-pirate    → pip install porch-pirate --break-system-packages
    postleaksNg     → git clone https://github.com/cosad3s/postleaksNg /home/pentester/tools/postleaksNg && pip install -r /home/pentester/tools/postleaksNg/requirements.txt --break-system-packages
    SwaggerSpy      → git clone https://github.com/UndeadSec/SwaggerSpy /home/pentester/tools/SwaggerSpy && pip install -r /home/pentester/tools/SwaggerSpy/requirements.txt --break-system-packages
    alterx          → go install github.com/projectdiscovery/alterx/cmd/alterx@latest
    shuffledns      → go install github.com/projectdiscovery/shuffledns/cmd/shuffledns@latest
    puredns         → go install github.com/d3mondev/puredns/v2@latest
    vita            → go install github.com/junnlikestea/vita@latest
    shosubgo        → go install github.com/incogbyte/shosubgo@latest
    github-subdomains → go install github.com/gwen001/github-subdomains@latest
    chaos           → go install github.com/projectdiscovery/chaos-client/cmd/chaos@latest
    findomain       → sudo apt-get install -y findomain  OR  cargo install findomain
    waymore         → pip install waymore --break-system-packages
    uro             → pip install uro --break-system-packages
    kiterunner      → wget https://github.com/assetnote/kiterunner/releases/latest/download/kr_linux_amd64 -O /usr/local/bin/kr && chmod +x /usr/local/bin/kr
    corsy           → pip install corsy --break-system-packages
    cariddi         → go install github.com/edoardottt/cariddi/cmd/cariddi@latest
    ghauri          → pip install ghauri --break-system-packages
    retire          → npm install -g retire
    hakrawler       → go install github.com/hakluke/hakrawler@latest
    interactsh-client → go install github.com/projectdiscovery/interactsh/cmd/interactsh-client@latest
    toxicache       → go install github.com/OJ/gobuster/v3@latest  (different, check first)
    nosqli          → pip install nosqli --break-system-packages
    headi           → go install github.com/mlcsec/headi@latest
    crlfuzz         → go install github.com/dwisiswant0/crlfuzz/cmd/crlfuzz@latest
    nrich           → go install github.com/projectdiscovery/nrich/cmd/nrich@latest
    asnmap          → go install github.com/projectdiscovery/asnmap/cmd/asnmap@latest
    mapcidr         → go install github.com/projectdiscovery/mapcidr/cmd/mapcidr@latest
    dnsx            → go install github.com/projectdiscovery/dnsx/cmd/dnsx@latest
    subfinder       → go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
    kerbrute        → go install github.com/ropnop/kerbrute@latest  OR  wget https://github.com/ropnop/kerbrute/releases/latest/download/kerbrute_linux_amd64 -O /usr/local/bin/kerbrute && chmod +x /usr/local/bin/kerbrute
    ROPgadget       → pip install ropgadget --break-system-packages
    pwntools        → pip install pwntools --break-system-packages
    pwndbg          → git clone https://github.com/pwndbg/pwndbg /home/pentester/tools/pwndbg && cd /home/pentester/tools/pwndbg && ./setup.sh
    impacket        → pip install impacket --break-system-packages  OR  sudo apt-get install -y impacket-scripts
    evil-winrm      → sudo gem install evil-winrm  OR  sudo apt-get install -y evil-winrm
    crackmapexec    → sudo apt-get install -y crackmapexec  OR  pip install netexec --break-system-packages
    pypykatz        → pip install pypykatz --break-system-packages
    ldapdomaindump  → pip install ldapdomaindump --break-system-packages
    chisel          → wget https://github.com/jpillora/chisel/releases/latest/download/chisel_linux_amd64.gz -O /tmp/c.gz && gunzip /tmp/c.gz && mv /tmp/c /home/pentester/tools/chisel && chmod +x /home/pentester/tools/chisel
    ligolo-ng       → wget https://github.com/nicocha30/ligolo-ng/releases/latest/download/proxy_linux_amd64 -O /home/pentester/tools/ligolo-proxy && chmod +x /home/pentester/tools/ligolo-proxy; wget https://github.com/nicocha30/ligolo-ng/releases/latest/download/agent_linux_amd64 -O /home/pentester/tools/ligolo-agent && chmod +x /home/pentester/tools/ligolo-agent
    linpeas         → wget https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh -O /home/pentester/tools/linpeas.sh && chmod +x /home/pentester/tools/linpeas.sh
    winpeas         → wget https://github.com/peass-ng/PEASS-ng/releases/latest/download/winPEASx64.exe -O /home/pentester/tools/winpeas.exe
    GodPotato       → wget https://github.com/BeichenDream/GodPotato/releases/latest/download/GodPotato-NET4.exe -O /home/pentester/tools/GodPotato.exe
    PrintSpoofer    → wget https://github.com/itm4n/PrintSpoofer/releases/latest/download/PrintSpoofer64.exe -O /home/pentester/tools/PrintSpoofer64.exe
    RsaCtfTool     → git clone https://github.com/RsaCtfTool/RsaCtfTool /home/pentester/tools/RsaCtfTool && pip install -r /home/pentester/tools/RsaCtfTool/requirements.txt --break-system-packages
    stegseek        → wget https://github.com/RickdeJager/stegseek/releases/latest/download/stegseek_0.6-1.deb -O /tmp/stegseek.deb && sudo dpkg -i /tmp/stegseek.deb
    volatility3     → pip install volatility3 --break-system-packages  OR  sudo apt-get install -y volatility3
    nosqlmap        → git clone https://github.com/codingo/NoSQLMap /home/pentester/tools/nosqlmap && pip install -r /home/pentester/tools/nosqlmap/requirements.txt --break-system-packages
    enum4linux-ng   → sudo apt-get install -y enum4linux-ng  OR  pip install enum4linux-ng --break-system-packages
    hash-identifier → sudo apt-get install -y hash-identifier
    hashid          → pip install hashid --break-system-packages
    cewl            → sudo apt-get install -y cewl
    snmp-check      → sudo apt-get install -y snmp-check
    onesixtyone     → sudo apt-get install -y onesixtyone
    dnsrecon        → sudo apt-get install -y dnsrecon
    dnsenum         → sudo apt-get install -y dnsenum
    fierce          → sudo apt-get install -y fierce
    dnsgen          → pip install dnsgen --break-system-packages
    padbuster       → sudo apt-get install -y padbuster
    apktool         → sudo apt-get install -y apktool
    jadx            → sudo apt-get install -y jadx
    apksigner       → sudo apt-get install -y apksigner
    adb             → sudo apt-get install -y adb fastboot  OR  sudo apt-get install -y android-sdk-platform-tools
    apkleaks        → pip install apkleaks --break-system-packages
    apkid           → pip install apkid --break-system-packages
    frida-tools     → pip install frida-tools --break-system-packages
    objection       → pip install objection --break-system-packages
    mobsf           → docker pull opensecurity/mobile-security-framework-mobsf && docker run -it -p 8000:8000 opensecurity/mobile-security-framework-mobsf  (if Docker-in-Docker available)
    oletools        → pip install oletools --break-system-packages
    stegoveritas    → pip install stegoveritas --break-system-packages
    zsteg           → sudo gem install zsteg
    ropper          → pip install ropper --break-system-packages  OR  sudo apt-get install -y ropper
    r2ghidra        → r2pm -ci r2ghidra   (inside radare2 after: sudo apt-get install -y radare2)
    metasploit      → sudo apt-get install -y metasploit-framework && sudo msfdb init
---
