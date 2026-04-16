import { readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { existsSync } from 'fs';
import { join } from 'path';

interface HeaderSpec {
  name: string;
  description: string;
  patterns: RegExp[];
}

const SECURITY_HEADERS: HeaderSpec[] = [
  {
    name: 'Strict-Transport-Security',
    description:
      'HSTS forces browsers to use HTTPS. Without it, downgrade attacks are possible.',
    patterns: [/Strict-Transport-Security/i, /hsts/i],
  },
  {
    name: 'Content-Security-Policy',
    description:
      'CSP prevents XSS by restricting which resources the browser can load.',
    patterns: [/Content-Security-Policy/i, /\bCSP\b/],
  },
  {
    name: 'X-Frame-Options',
    description:
      'X-Frame-Options prevents clickjacking by controlling iframe embedding.',
    patterns: [/X-Frame-Options/i, /frameOptions/i],
  },
  {
    name: 'X-Content-Type-Options',
    description:
      'X-Content-Type-Options prevents MIME-type sniffing attacks.',
    patterns: [/X-Content-Type-Options/i, /contentTypeOptions/i, /nosniff/i],
  },
  {
    name: 'Referrer-Policy',
    description:
      'Referrer-Policy controls how much referrer information is sent with requests.',
    patterns: [/Referrer-Policy/i, /referrerPolicy/i],
  },
  {
    name: 'Permissions-Policy',
    description:
      'Permissions-Policy restricts access to browser APIs (camera, microphone, geolocation).',
    patterns: [/Permissions-Policy/i, /permissionsPolicy/i, /Feature-Policy/i],
  },
  {
    name: 'X-XSS-Protection',
    description:
      'X-XSS-Protection enables the browser\'s built-in XSS filter (legacy but still useful).',
    patterns: [/X-XSS-Protection/i, /xssProtection/i],
  },
  {
    name: 'Cross-Origin-Embedder-Policy',
    description:
      'COEP prevents loading cross-origin resources without explicit permission, mitigating Spectre-class side-channel attacks.',
    patterns: [/Cross-Origin-Embedder-Policy/i, /\bCOEP\b/, /embedderPolicy/i],
  },
  {
    name: 'Cross-Origin-Resource-Policy',
    description:
      'CORP controls which origins can embed or read a resource, hardening CORS protections.',
    patterns: [/Cross-Origin-Resource-Policy/i, /\bCORP\b/, /resourcePolicy/i],
  },
  {
    name: 'Cross-Origin-Opener-Policy',
    description:
      'COOP isolates the browsing context group, preventing cross-origin documents from sharing a process for site isolation.',
    patterns: [/Cross-Origin-Opener-Policy/i, /\bCOOP\b/, /openerPolicy/i],
  },
];

const CONFIG_FILENAMES = [
  'next.config.ts',
  'next.config.js',
  'next.config.mjs',
  'middleware.ts',
  'middleware.js',
];

/**
 * v0.8 Phase 8: header-checker is a Next.js-specific scanner. It looks
 * for CSP / HSTS / X-Frame-Options headers inside Next.js config entry
 * points. When the target project is NOT a Next.js app (scanner OSS,
 * pure library, non-web tooling) emitting 10 "missing header" findings
 * is a structural FP — the headers don't apply. Gate at isAvailable.
 */
function looksLikeNextJsProject(projectPath: string): boolean {
  const configCandidates = [
    'next.config.ts', 'next.config.js', 'next.config.mjs', 'next.config.cjs',
    'middleware.ts', 'middleware.js',
  ];
  for (const c of configCandidates) {
    if (existsSync(join(projectPath, c))) return true;
  }
  // Walk package.json at the project root for a `next` dep in any scope.
  try {
    const pkgPath = join(projectPath, 'package.json');
    if (!existsSync(pkgPath)) return false;
    const pkg = JSON.parse(readFileSafe(pkgPath) ?? '{}') as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const combined = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
    };
    return 'next' in combined;
  } catch {
    return false;
  }
}

export const headerCheckerScanner: Scanner = {
  name: 'header-checker',
  description:
    'Verifies that security response headers are configured in next.config or middleware',
  category: 'security',

  async isAvailable(projectPath: string): Promise<boolean> {
    return looksLikeNextJsProject(projectPath);
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;

    // Collect all content from config/middleware files
    let combinedContent = '';
    const foundFiles: string[] = [];

    for (const filename of CONFIG_FILENAMES) {
      const filePath = join(projectPath, filename);
      if (!existsSync(filePath)) continue;
      const content = readFileSafe(filePath);
      if (content !== null) {
        combinedContent += '\n' + content;
        foundFiles.push(filename);
      }
    }

    if (combinedContent.trim() === '') {
      // No config files found at all — report all headers as missing
      for (const header of SECURITY_HEADERS) {
        const id = `HDR-${String(idCounter++).padStart(3, '0')}`;
        findings.push({
          id,
          scanner: 'header-checker',
          severity: 'medium',
          title: `Missing security header: ${header.name}`,
          description: `${header.description} No next.config or middleware file was found to verify header configuration.`,
          category: 'security',
          owasp: 'A05:2021',
          cwe: 693,
        });
      }
      return {
        scanner: 'header-checker',
        category: 'security',
        findings,
        duration: Date.now() - start,
        available: true,
      };
    }

    for (const header of SECURITY_HEADERS) {
      const isPresent = header.patterns.some((p) => p.test(combinedContent));
      if (!isPresent) {
        const id = `HDR-${String(idCounter++).padStart(3, '0')}`;
        findings.push({
          id,
          scanner: 'header-checker',
          severity: 'medium',
          title: `Missing security header: ${header.name}`,
          description: `${header.description} Checked files: ${foundFiles.join(', ')}.`,
          file: join(projectPath, foundFiles[0] ?? 'next.config.ts'),
          line: 1,
          fileLevel: true,
          category: 'security',
          owasp: 'A05:2021',
          cwe: 693,
        });
      }
    }

    return {
      scanner: 'header-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
