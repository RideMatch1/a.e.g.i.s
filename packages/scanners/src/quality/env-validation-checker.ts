import { walkFiles, readFileSafe, isTestFile } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { existsSync } from 'fs';
import { join } from 'path';

function findLineNumber(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

/** Paths where a central env validation file might live */
function getEnvValidationPaths(projectPath: string): string[] {
  return [
    join(projectPath, 'env.ts'),
    join(projectPath, 'env.js'),
    join(projectPath, 'src/env.ts'),
    join(projectPath, 'src/env.js'),
    join(projectPath, 'src/env.mts'),
    join(projectPath, 'src/env.mjs'),
    join(projectPath, 'lib/env.ts'),
    join(projectPath, 'lib/env.js'),
    join(projectPath, 'config/env.ts'),
    join(projectPath, 'config/env.js'),
  ];
}

/** Check whether any env validation file exists and contains actual validation */
function hasEnvValidation(projectPath: string): boolean {
  const validationPaths = getEnvValidationPaths(projectPath);

  for (const envPath of validationPaths) {
    if (!existsSync(envPath)) continue;
    const content = readFileSafe(envPath);
    if (content === null) continue;
    // Must contain actual Zod or t3-oss validation, not just process.env accesses
    if (
      /@t3-oss\/env/.test(content) ||
      /z\.(object|string|number|boolean|enum|url)\s*\(/.test(content) ||
      /zod/.test(content)
    ) {
      return true;
    }
  }

  // Also check if package.json has @t3-oss/env-nextjs or @t3-oss/env-core
  const pkgPath = join(projectPath, 'package.json');
  if (existsSync(pkgPath)) {
    const content = readFileSafe(pkgPath);
    if (content && (/@t3-oss\/env-nextjs/.test(content) || /@t3-oss\/env-core/.test(content))) {
      return true;
    }
  }

  return false;
}

export const envValidationCheckerScanner: Scanner = {
  name: 'env-validation-checker',
  description: 'Checks that environment variables are centrally validated and not silently defaulted to empty strings',
  category: 'quality',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const idCounter = { value: 1 };
    const defaultIgnore = ['node_modules', 'dist', '.next', '.git'];
    const ignore = [...new Set([...defaultIgnore, ...(config.ignore ?? [])])];

    // Collect all source files
    let allFiles: string[];
    const searchDirs = [
      join(projectPath, 'src'),
      join(projectPath, 'app'),
      join(projectPath, 'pages'),
      join(projectPath, 'lib'),
      join(projectPath, 'utils'),
      join(projectPath, 'services'),
    ];

    // Also include top-level files
    const topLevelFiles: string[] = [];
    try {
      const topLevel = walkFiles(projectPath, [...ignore, 'src', 'app', 'pages', 'lib', 'utils', 'services', 'node_modules', 'dist', '.next', '.git'], ['ts', 'js']);
      topLevelFiles.push(...topLevel.filter((f) => !isTestFile(f)));
    } catch {
      // ignore
    }

    allFiles = [...topLevelFiles];
    for (const dir of searchDirs) {
      try {
        const files = walkFiles(dir, ignore, ['ts', 'js', 'tsx', 'jsx']);
        allFiles.push(...files.filter((f) => !isTestFile(f)));
      } catch {
        continue;
      }
    }

    // Deduplicate
    allFiles = [...new Set(allFiles)];

    // --- Pass 1: Collect unique env var references ---
    const envVarSet = new Set<string>();
    const emptyDefaultOccurrences: Array<{ file: string; line: number; varName: string }> = [];
    const processEnvRe = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
    const emptyDefaultRe = /process\.env\.([A-Z_][A-Z0-9_]*)\s*(?:\|\||\?\?)\s*['"]{2}/g;

    for (const file of allFiles) {
      const content = readFileSafe(file);
      if (content === null) continue;

      // Collect all unique env vars
      let match: RegExpExecArray | null;
      const re = new RegExp(processEnvRe.source, 'g');
      while ((match = re.exec(content)) !== null) {
        envVarSet.add(match[1]);
      }

      // Collect empty-string defaults (process.env.FOO || '')
      const emptyRe = new RegExp(emptyDefaultRe.source, 'g');
      while ((match = emptyRe.exec(content)) !== null) {
        emptyDefaultOccurrences.push({
          file,
          line: findLineNumber(content, match.index),
          varName: match[1],
        });
      }
    }

    // --- Pass 2: Check for central validation ---
    const validated = hasEnvValidation(projectPath);

    // Finding: >5 unique env vars but no central validation
    if (envVarSet.size > 5 && !validated) {
      const sortedVars = [...envVarSet].sort();
      const id = `ENV-${String(idCounter.value++).padStart(3, '0')}`;
      findings.push({
        id,
        scanner: 'env-validation-checker',
        severity: 'medium',
        title: 'No central environment variable validation found',
        description:
          `${envVarSet.size} unique environment variables are used (${sortedVars.join(', ')}) but no central validation was detected. Missing or misconfigured env vars cause silent runtime failures. Use @t3-oss/env-nextjs or a Zod schema in env.ts to validate all env vars at startup.`,
        // No file field — env.ts doesn't exist yet (that's the point of this finding)
        category: 'quality',
        owasp: 'A05:2021',
        cwe: 1188,
        fix: {
          description:
            'Create env.ts at the project root with a Zod schema that defines every server + client env var, their types, and whether they are required. Import it once at the edge of the app (middleware, root layout, or instrumentation.ts) so a missing value fails-fast at boot instead of surfacing as undefined deep in a request handler. The @t3-oss/env-nextjs package is the standard Next.js wrapper over this pattern.',
          links: [
            'https://cwe.mitre.org/data/definitions/1188.html',
            'https://env.t3.gg/',
          ],
        },
      });
    }

    // Finding: per-occurrence empty string defaults
    for (const occ of emptyDefaultOccurrences) {
      const id = `ENV-${String(idCounter.value++).padStart(3, '0')}`;
      findings.push({
        id,
        scanner: 'env-validation-checker',
        severity: 'low',
        title: `Environment variable ${occ.varName} silently defaults to empty string`,
        description:
          `process.env.${occ.varName} || '' silently substitutes an empty string when the variable is not set. This masks misconfiguration and can cause subtle failures downstream. Validate required env vars at startup and fail fast with a clear error if they are missing.`,
        file: occ.file,
        line: occ.line,
        category: 'quality',
        owasp: 'A05:2021',
        cwe: 1188,
        fix: {
          description:
            'Replace the silent empty-string fallback with an explicit validation that throws on missing. A central env.ts with Zod surfaces the same error once at boot instead of every call-site re-implementing a silent fallback. Treat empty-string-as-default as a footgun — it makes misconfigured deploys look healthy until a request hits the undefined path.',
          links: [
            'https://cwe.mitre.org/data/definitions/1188.html',
            'https://env.t3.gg/',
          ],
        },
      });
    }

    return {
      scanner: 'env-validation-checker',
      category: 'quality',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
