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

interface ConfigRule {
  pattern: RegExp;
  severity: Finding['severity'];
  title: string;
  description: string;
  owasp?: string;
  cwe?: number;
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
  },
  {
    pattern: /^ADD\s+https?:\/\//m,
    severity: 'high',
    title: 'ADD with remote URL is a supply chain risk',
    description:
      'Dockerfile ADD with a remote URL downloads content at build time without checksum verification. Use COPY with a prior curl/wget step and verify checksums.',
    owasp: 'A05:2021',
    cwe: 1188,
  },
  {
    pattern: /^ENV\s+(?!NEXT_PUBLIC_)\S*(SECRET|PASSWORD|KEY|TOKEN|CREDENTIAL)\S*\s*[=\s]/im,
    severity: 'critical',
    title: 'Secrets in Dockerfile ENV are baked into image layers',
    description:
      'Secrets defined via ENV in a Dockerfile are visible in every image layer and to anyone with image access. Use build-time secrets (--mount=type=secret) or runtime environment variables instead.',
    owasp: 'A05:2021',
    cwe: 1188,
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
  },
  {
    pattern: /poweredByHeader\s*:\s*true/,
    severity: 'medium',
    title: 'X-Powered-By header exposes framework',
    description:
      'poweredByHeader is explicitly enabled. The X-Powered-By header reveals the framework (Next.js) and version, aiding targeted attacks. Set poweredByHeader: false.',
    owasp: 'A05:2021',
    cwe: 1188,
  },
  {
    pattern: /bodySizeLimit\s*:\s*['"](\d+)\s*mb['"]/i,
    severity: 'medium',
    title: 'Large Server Action body limit increases DoS risk',
    description:
      'Server Action bodySizeLimit is set above 10 MB. Large limits increase Denial-of-Service risk by allowing massive payloads. Keep the limit under 10 MB unless absolutely required.',
    owasp: 'A05:2021',
    cwe: 1188,
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
  },
  {
    pattern: /[".']write['"]\s*:\s*true/,
    severity: 'critical',
    title: 'Realtime Database rules allow public writes',
    description:
      'Firebase Realtime Database rules allow public writes. Any user can modify data without authentication. Implement proper auth-based rules.',
    owasp: 'A05:2021',
    cwe: 1188,
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
