import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { existsSync } from 'fs';
import { join } from 'path';

function findLineNumber(content: string, matchIndex: number): number {
  const before = content.slice(0, matchIndex);
  return before.split('\n').length;
}

/** Build a global regex from a rule pattern, deduplicating flags */
function toGlobalRegex(pattern: RegExp): RegExp {
  const flags = new Set(pattern.flags.split(''));
  flags.add('g');
  return new RegExp(pattern.source, [...flags].join(''));
}

/**
 * v0.17.5 F6.1 — placeholder-default detection for Docker ARG.
 *
 * A "placeholder" default is one that the user is clearly expected to
 * override at build time (--build-arg). Common shapes:
 *  - empty string ('')
 *  - well-known dummy strings ("CAFEBABE", "DEADBEEF", "REPLACE_ME", …)
 *  - very short strings (< 16 chars) — too short to be real secrets
 */
function isPlaceholderDefault(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;

  const lower = trimmed.toLowerCase();
  const KNOWN_PLACEHOLDERS = new Set([
    'cafebabe', 'deadbeef', 'changeme', 'change_me', 'replaceme', 'replace_me',
    'your_key', 'your_secret', 'your_token', 'your_password', 'yourkey',
    'example', 'sample', 'test', 'placeholder', 'dummy', 'fake',
    'foo', 'bar', 'baz', 'todo', 'tbd', 'null', 'undefined',
    'secret', 'password', 'key', 'token', 'credential',
    '<your-key-here>', '<your-secret>', '<change-me>', '<placeholder>',
  ]);
  if (KNOWN_PLACEHOLDERS.has(lower)) return true;

  // Anything < 16 chars is too short to be a real cryptographic secret
  if (trimmed.length < 16) return true;

  return false;
}

/**
 * v0.17.5 F6.1 — ARG-rebind pattern recognition for Docker.
 *
 * Detects the canonical Docker build-arg-secret pattern:
 *   ARG MY_KEY[="default"]
 *   ENV MY_KEY="$MY_KEY"
 *
 * which is the documented BuildKit-pre / ARG-pre way to inject a
 * secret at build time. The ARG default ships ONLY when the user
 * forgets `--build-arg`, so:
 *  - placeholder default + ENV rebind = SAFE (the user is clearly
 *    expected to override; if they don't, the placeholder is obviously
 *    not a real secret) → SKIP the finding entirely
 *  - realistic default + ENV rebind = fragile (real-looking secret may
 *    bake into image if user forgets) → keep CRITICAL (current behavior)
 *  - no ARG within window = ENV is genuinely a baked secret → CRITICAL
 *
 * Returns:
 *  { skip: true }   — placeholder-rebind detected, suppress the finding
 *  { skip: false }  — finding stays (default rule behavior)
 */
function analyzeDockerEnvSecret(
  content: string,
  matchIndex: number,
): { skip: boolean } {
  // Extract the ENV line and the variable name on it
  const lineStart = content.lastIndexOf('\n', matchIndex - 1) + 1;
  const lineEndIdx = content.indexOf('\n', matchIndex);
  const lineEnd = lineEndIdx === -1 ? content.length : lineEndIdx;
  const envLine = content.slice(lineStart, lineEnd);

  // Match: ENV VARNAME = "$VARNAME" / "${VARNAME}" / $VARNAME (with or without quotes)
  // Var-name char-class is `[A-Za-z0-9_]+` (NOT `\S+`) — `\S+` was greedy
  // and would swallow the `="` into the captured name.
  const rebindMatch = /^ENV\s+([A-Za-z0-9_]+)\s*=\s*["']?\$\{?([A-Za-z0-9_]+)\}?["']?\s*$/.exec(envLine);
  if (!rebindMatch) return { skip: false };

  const envVar = rebindMatch[1];
  const refVar = rebindMatch[2];

  // The rebind only counts if the ENV var refers to ITSELF (the canonical
  // pattern). `ENV X="$Y"` where X !== Y is just env-var-aliasing, not the
  // ARG-rebind pattern, and may still be a real secret leak.
  if (envVar !== refVar) return { skip: false };

  // Look back up to 10 lines for `ARG <envVar>[="default"]`
  // (10-line window > 5-line per spec, to absorb common Dockerfile
  //  comment-and-blank-line interleaving).
  const lookbackStart = Math.max(0, lineStart - 600);
  const before = content.slice(lookbackStart, lineStart);
  const argRegex = new RegExp(
    `^ARG\\s+${envVar}(?:\\s*=\\s*["']?([^"'\\r\\n]*?)["']?)?\\s*$`,
    'm',
  );
  const argMatch = argRegex.exec(before);
  if (!argMatch) return { skip: false };

  const argDefault = argMatch[1] ?? '';
  if (isPlaceholderDefault(argDefault)) {
    return { skip: true };
  }
  return { skip: false };
}

const DOCKER_ENV_SECRET_TITLE = 'Secrets in Dockerfile ENV are baked into image layers';

interface ConfigRule {
  pattern: RegExp;
  severity: Finding['severity'];
  title: string;
  description: string;
  owasp?: string;
  cwe?: number;
  fix?: Finding['fix'];
}

const DOCKER_RULES: ConfigRule[] = [
  {
    pattern: /^FROM\s+\S+:latest\b/m,
    severity: 'high',
    title: 'Unpinned Docker image version (:latest)',
    description:
      'Docker FROM uses :latest tag. Pin Docker image versions (e.g., node:20.11-alpine) for reproducible builds and to avoid supply chain drift.',
    owasp: 'A05:2021',
    cwe: 1188,
    fix: {
      description:
        'Pin the base image to a specific digest or version tag — :latest lets an upstream push silently change your build output and supply-chain surface between runs. Prefer @sha256 digest-pinning for airtight reproducibility; a version-tag (node:20.11-alpine) is a looser but acceptable second-best.',
      code: 'FROM node:20.11-alpine@sha256:...',
      links: [
        'https://cwe.mitre.org/data/definitions/1188.html',
        'https://docs.docker.com/develop/develop-images/dockerfile_best-practices/',
      ],
    },
  },
  {
    pattern: /^ADD\s+https?:\/\//m,
    severity: 'high',
    title: 'ADD with remote URL is a supply chain risk',
    description:
      'Dockerfile ADD with a remote URL downloads content at build time without checksum verification. Use COPY with a prior curl/wget step and verify checksums.',
    owasp: 'A05:2021',
    cwe: 1188,
    fix: {
      description:
        'ADD with a remote URL runs at every build without integrity verification — if the remote changes, your image changes silently. Replace with a RUN step that downloads, verifies a known SHA, then unpacks; or vendor the asset into the repo and use COPY.',
      code: "RUN curl -fsSL https://example.com/file.tar.gz -o /tmp/file.tar.gz \\\n && echo 'abc123... /tmp/file.tar.gz' | sha256sum -c -",
      links: [
        'https://cwe.mitre.org/data/definitions/1188.html',
        'https://docs.docker.com/develop/develop-images/dockerfile_best-practices/',
      ],
    },
  },
  {
    pattern: /^ENV\s+(?!NEXT_PUBLIC_)\S*(SECRET|PASSWORD|KEY|TOKEN|CREDENTIAL)\S*\s*[=\s]/im,
    severity: 'critical',
    title: 'Secrets in Dockerfile ENV are baked into image layers',
    description:
      'Secrets defined via ENV in a Dockerfile are visible in every image layer and to anyone with image access. Use build-time secrets (--mount=type=secret) or runtime environment variables instead.',
    owasp: 'A05:2021',
    cwe: 1188,
    fix: {
      description:
        'Dockerfile ENV layers are readable by anyone who pulls the image (docker history -v). Rotate any secret that was built into an image, then switch the build to BuildKit secrets (--mount=type=secret) for build-time, and inject runtime secrets via the orchestrator (Kubernetes Secrets, Compose env_file, Docker Swarm secret).',
      code: '# syntax=docker/dockerfile:1.4\nRUN --mount=type=secret,id=api_key \\\n    API_KEY=$(cat /run/secrets/api_key) ./deploy.sh',
      links: [
        'https://cwe.mitre.org/data/definitions/1188.html',
        'https://docs.docker.com/build/building/secrets/',
      ],
    },
  },
];

const DOCKER_COMPOSE_RULES: ConfigRule[] = [
  {
    pattern: /--privileged|privileged:\s*true/,
    severity: 'critical',
    title: 'Privileged container can escape to host',
    description:
      'Privileged mode gives the container full access to the host kernel. This allows container escape and full host compromise. Remove --privileged and use specific capabilities (cap_add) instead.',
    owasp: 'A05:2021',
    cwe: 1188,
    fix: {
      description:
        'Privileged mode disables ALL container isolation — any RCE inside the container is a root RCE on the host. Identify the specific capability the workload needs (SYS_ADMIN, NET_ADMIN, etc.), drop privileged, and grant only that capability via cap_add. If you genuinely need full host access, use a hostPID/hostNetwork pod with an explicit SCC/PSA justification.',
      code: "services:\n  app:\n    image: app:latest\n    cap_add: ['NET_ADMIN']  # instead of privileged: true",
      links: [
        'https://cwe.mitre.org/data/definitions/1188.html',
        'https://docs.docker.com/engine/reference/run/#runtime-privilege-and-linux-capabilities',
      ],
    },
  },
];

const NEXTJS_RULES: ConfigRule[] = [
  {
    pattern: /remotePatterns\s*:\s*\[[\s\S]*?['"]?\*['"]?|domains\s*:\s*\[[\s\S]*?['"]?\*['"]?/,
    severity: 'high',
    title: 'Wildcard image domains enable SSRF',
    description:
      'Wildcard (*) in Next.js image remotePatterns/domains allows the image optimizer to fetch from any host, enabling SSRF. Restrict to specific, trusted domains.',
    owasp: 'A05:2021',
    cwe: 1188,
    fix: {
      description:
        'An unrestricted Next.js image optimizer turns your server into an open HTTP proxy — attackers pass an internal URL and exfiltrate the response through the /_next/image pipeline. List the exact hostnames you proxy from; prefer remotePatterns over the legacy domains field so you can also pin pathname and protocol.',
      code: "images: {\n  remotePatterns: [\n    { protocol: 'https', hostname: 'cdn.example.com', pathname: '/images/**' },\n  ],\n},",
      links: [
        'https://cwe.mitre.org/data/definitions/918.html',
        'https://nextjs.org/docs/app/api-reference/components/image#remotepatterns',
      ],
    },
  },
  {
    pattern: /poweredByHeader\s*:\s*true/,
    severity: 'medium',
    title: 'X-Powered-By header exposes framework',
    description:
      'poweredByHeader is explicitly enabled. The X-Powered-By header reveals the framework (Next.js) and version, aiding targeted attacks. Set poweredByHeader: false.',
    owasp: 'A05:2021',
    cwe: 1188,
    fix: {
      description:
        'X-Powered-By tells attackers exactly which framework you run, which pairs any CVE-feed with your stack for free. Disable it in next.config and audit the response for other fingerprinting headers (Server, X-AspNet-Version).',
      code: "module.exports = { poweredByHeader: false };",
      links: [
        'https://cwe.mitre.org/data/definitions/200.html',
        'https://nextjs.org/docs/app/api-reference/next-config-js/poweredByHeader',
      ],
    },
  },
  {
    pattern: /bodySizeLimit\s*:\s*['"](\d+)\s*mb['"]/i,
    severity: 'medium',
    title: 'Large Server Action body limit increases DoS risk',
    description:
      'Server Action bodySizeLimit is set above 10 MB. Large limits increase Denial-of-Service risk by allowing massive payloads. Keep the limit under 10 MB unless absolutely required.',
    owasp: 'A05:2021',
    cwe: 1188,
    fix: {
      description:
        'Every body-size increase multiplies the RAM cost of a single abusive request. Keep Server Action bodySizeLimit at the lowest value that serves the real use-case; for genuinely large uploads use a signed direct-to-storage upload (S3 / Supabase Storage) instead of routing bytes through the Server Action.',
      code: "experimental: { serverActions: { bodySizeLimit: '2mb' } }",
      links: [
        'https://cwe.mitre.org/data/definitions/400.html',
        'https://nextjs.org/docs/app/api-reference/next-config-js/serverActions',
      ],
    },
  },
];

const FIREBASE_RULES: ConfigRule[] = [
  {
    pattern: /allow\s+read\s*,\s*write\s*:\s*if\s+true|allow\s+read\s*:\s*if\s+true/,
    severity: 'critical',
    title: 'Firestore rules allow public access',
    description:
      'Firestore security rules allow public read/write access. Any user can read and modify data without authentication. Implement proper authentication and authorization rules.',
    owasp: 'A05:2021',
    cwe: 1188,
    fix: {
      description:
        '`allow read, write: if true` is a full data-exfiltration and tampering surface — anyone can read or overwrite any document. Gate access on request.auth.uid matching the document owner, then tighten further per-collection based on user roles or tenant membership.',
      code: "match /users/{uid} {\n  allow read, write: if request.auth != null && request.auth.uid == uid;\n}",
      links: [
        'https://cwe.mitre.org/data/definitions/285.html',
        'https://firebase.google.com/docs/rules/basics',
      ],
    },
  },
  {
    pattern: /[".']write['"]\s*:\s*true/,
    severity: 'critical',
    title: 'Realtime Database rules allow public writes',
    description:
      'Firebase Realtime Database rules allow public writes. Any user can modify data without authentication. Implement proper auth-based rules.',
    owasp: 'A05:2021',
    cwe: 1188,
    fix: {
      description:
        '"write": true lets any unauthenticated client overwrite the entire subtree. Replace with an auth-predicate that checks auth.uid against the path variable, and narrow write-scope to the specific nodes the authenticated user owns.',
      code: '"users": { "$uid": { ".write": "auth != null && auth.uid === $uid" } }',
      links: [
        'https://cwe.mitre.org/data/definitions/285.html',
        'https://firebase.google.com/docs/database/security/rules-conditions',
      ],
    },
  },
];

export const configAuditorScanner: Scanner = {
  name: 'config-auditor',
  description:
    'Audits configuration files for security issues: Docker, Next.js, Firebase rules, environment files',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;
    const defaultIgnore = ['node_modules', 'dist', '.next', '.git'];
    const ignore = [...new Set([...defaultIgnore, ...(config.ignore ?? [])])];

    function nextId(): string {
      return `CONFIG-${String(idCounter++).padStart(3, '0')}`;
    }

    // --- Docker checks ---
    const dockerfiles = walkFiles(projectPath, ignore, [])
      .filter((f) => {
        const name = f.split('/').pop() ?? '';
        return /^Dockerfile/i.test(name);
      });

    for (const file of dockerfiles) {
      const content = readFileSafe(file);
      if (content === null) continue;

      for (const rule of DOCKER_RULES) {
        let match: RegExpExecArray | null;
        const re = toGlobalRegex(rule.pattern);
        while ((match = re.exec(content)) !== null) {
          // v0.17.5 F6.1 — Docker ARG-rebind pattern recognition.
          // Suppresses the FP-storm where canonical ARG=default + ENV
          // rebind patterns (with placeholder defaults like "CAFEBABE",
          // "DEADBEEF", or empty) were spuriously flagged CRITICAL.
          if (rule.title === DOCKER_ENV_SECRET_TITLE) {
            const verdict = analyzeDockerEnvSecret(content, match.index);
            if (verdict.skip) continue;
          }

          findings.push({
            id: nextId(),
            scanner: 'config-auditor',
            severity: rule.severity,
            title: rule.title,
            description: rule.description,
            file,
            line: findLineNumber(content, match.index),
            category: 'security',
            ...(rule.owasp ? { owasp: rule.owasp } : {}),
            ...(rule.cwe ? { cwe: rule.cwe } : {}),
            ...(rule.fix ? { fix: rule.fix } : {}),
          });
        }
      }
    }

    // --- Docker Compose checks ---
    const composeFiles = walkFiles(projectPath, ignore, ['yml', 'yaml'])
      .filter((f) => {
        const name = f.split('/').pop() ?? '';
        return /docker-compose|compose\./i.test(name);
      });

    for (const file of composeFiles) {
      const content = readFileSafe(file);
      if (content === null) continue;

      for (const rule of DOCKER_COMPOSE_RULES) {
        const re = toGlobalRegex(rule.pattern);
        let match: RegExpExecArray | null;
        while ((match = re.exec(content)) !== null) {
          findings.push({
            id: nextId(),
            scanner: 'config-auditor',
            severity: rule.severity,
            title: rule.title,
            description: rule.description,
            file,
            line: findLineNumber(content, match.index),
            category: 'security',
            ...(rule.owasp ? { owasp: rule.owasp } : {}),
            ...(rule.cwe ? { cwe: rule.cwe } : {}),
            ...(rule.fix ? { fix: rule.fix } : {}),
          });
        }
      }
    }

    // --- Next.js config checks ---
    const nextConfigs = ['next.config.js', 'next.config.mjs', 'next.config.ts'].map((name) =>
      join(projectPath, name),
    );

    for (const configPath of nextConfigs) {
      if (!existsSync(configPath)) continue;
      const content = readFileSafe(configPath);
      if (content === null) continue;

      for (const rule of NEXTJS_RULES) {
        // Special handling for bodySizeLimit: only flag if > 10 MB
        if (rule.title.includes('body limit')) {
          const sizeMatch = /bodySizeLimit\s*:\s*['"](\d+)\s*mb['"]/i.exec(content);
          if (sizeMatch && parseInt(sizeMatch[1], 10) > 10) {
            findings.push({
              id: nextId(),
              scanner: 'config-auditor',
              severity: rule.severity,
              title: rule.title,
              description: rule.description,
              file: configPath,
              line: findLineNumber(content, sizeMatch.index),
              category: 'security',
              ...(rule.owasp ? { owasp: rule.owasp } : {}),
              ...(rule.cwe ? { cwe: rule.cwe } : {}),
              ...(rule.fix ? { fix: rule.fix } : {}),
            });
          }
          continue;
        }

        const re = toGlobalRegex(rule.pattern);
        let match: RegExpExecArray | null;
        while ((match = re.exec(content)) !== null) {
          findings.push({
            id: nextId(),
            scanner: 'config-auditor',
            severity: rule.severity,
            title: rule.title,
            description: rule.description,
            file: configPath,
            line: findLineNumber(content, match.index),
            category: 'security',
            ...(rule.owasp ? { owasp: rule.owasp } : {}),
            ...(rule.cwe ? { cwe: rule.cwe } : {}),
            ...(rule.fix ? { fix: rule.fix } : {}),
          });
        }
      }

      // Check for missing poweredByHeader setting (default is true in Next.js)
      if (!/poweredByHeader/.test(content)) {
        findings.push({
          id: nextId(),
          scanner: 'config-auditor',
          severity: 'medium',
          title: 'X-Powered-By header not disabled',
          description:
            'Next.js config does not set poweredByHeader: false. The X-Powered-By header is enabled by default, revealing the framework. Add poweredByHeader: false to next.config.',
          file: configPath,
          category: 'security',
          owasp: 'A05:2021',
          cwe: 1188,
          fix: {
            description:
              'Next.js ships X-Powered-By on every response by default, which pairs with any framework CVE for instant fingerprinting. Set poweredByHeader: false in next.config to silence it — one-line fix, zero runtime cost.',
            code: "module.exports = { poweredByHeader: false };",
            links: [
              'https://cwe.mitre.org/data/definitions/200.html',
              'https://nextjs.org/docs/app/api-reference/next-config-js/poweredByHeader',
            ],
          },
        });
      }
    }

    // --- Firebase rules checks ---
    const firebaseRuleFiles = [
      join(projectPath, 'firestore.rules'),
      join(projectPath, 'database.rules.json'),
      join(projectPath, 'storage.rules'),
    ];

    for (const rulePath of firebaseRuleFiles) {
      if (!existsSync(rulePath)) continue;
      const content = readFileSafe(rulePath);
      if (content === null) continue;

      for (const rule of FIREBASE_RULES) {
        const re = toGlobalRegex(rule.pattern);
        let match: RegExpExecArray | null;
        while ((match = re.exec(content)) !== null) {
          findings.push({
            id: nextId(),
            scanner: 'config-auditor',
            severity: rule.severity,
            title: rule.title,
            description: rule.description,
            file: rulePath,
            line: findLineNumber(content, match.index),
            category: 'security',
            ...(rule.owasp ? { owasp: rule.owasp } : {}),
            ...(rule.cwe ? { cwe: rule.cwe } : {}),
            ...(rule.fix ? { fix: rule.fix } : {}),
          });
        }
      }
    }

    // --- Environment file checks ---
    const gitignorePath = join(projectPath, '.gitignore');
    const gitignoreContent = readFileSafe(gitignorePath) ?? '';

    // Check if .env is in .gitignore
    const envInGitignore = /^\.env$/m.test(gitignoreContent) || /^\.env\s/m.test(gitignoreContent)
      || /^\*\.env$/m.test(gitignoreContent);

    if (!envInGitignore) {
      // Only flag if .env file actually exists
      if (existsSync(join(projectPath, '.env'))) {
        findings.push({
          id: nextId(),
          scanner: 'config-auditor',
          severity: 'critical',
          title: 'Environment files with secrets may be committed',
          description:
            '.env file exists but is not listed in .gitignore. Environment files typically contain secrets (API keys, database credentials) and must be excluded from version control.',
          file: join(projectPath, '.env'),
          category: 'security',
          owasp: 'A05:2021',
          cwe: 1188,
          fix: {
            description:
              'Add .env to .gitignore, then audit git history — if the file was ever committed, every value in it is compromised and must be rotated even after deletion. Use .env.example for documented non-secret defaults and load real values from the deployment environment.',
            code: "echo '.env\\n.env.local\\n.env.*.local' >> .gitignore\ngit rm --cached .env",
            links: [
              'https://cwe.mitre.org/data/definitions/798.html',
              'https://12factor.net/config',
            ],
          },
        });
      }
    }

    // Check for production env files that should not be tracked
    const sensitiveEnvFiles = ['.env.local', '.env.production', '.env.production.local'];
    for (const envFile of sensitiveEnvFiles) {
      const envPath = join(projectPath, envFile);
      if (!existsSync(envPath)) continue;

      // Check if this specific file is covered by .gitignore
      const escapedName = envFile.replace(/\./g, '\\.');
      const isCovered = new RegExp(`^${escapedName}$`, 'm').test(gitignoreContent)
        || /^\.env\*$/m.test(gitignoreContent)
        || /^\.env\.?\*$/m.test(gitignoreContent)
        || /^\.env\.local$/m.test(gitignoreContent) && envFile === '.env.local'
        || /^\.env\.production$/m.test(gitignoreContent) && envFile === '.env.production';

      if (!isCovered) {
        findings.push({
          id: nextId(),
          scanner: 'config-auditor',
          severity: 'high',
          title: `Production env file ${envFile} may be in version control`,
          description:
            `${envFile} exists but may not be excluded by .gitignore. Production environment files should not be in version control as they contain deployment secrets.`,
          file: envPath,
          category: 'security',
          owasp: 'A05:2021',
          cwe: 1188,
          fix: {
            description:
              'Production env files leak deployment secrets the moment the repo is public or shared. Add an umbrella ignore (.env*.local plus .env.production) to .gitignore, rotate any value that was already committed, and move the source-of-truth to a secrets manager (Vercel/Netlify env, AWS Secrets Manager, HashiCorp Vault).',
              code: "echo '.env*.local\\n.env.production' >> .gitignore\ngit rm --cached .env.local",
            links: [
              'https://cwe.mitre.org/data/definitions/798.html',
              'https://12factor.net/config',
            ],
          },
        });
      }
    }

    return {
      scanner: 'config-auditor',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
