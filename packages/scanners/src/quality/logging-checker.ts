import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * v0.9 polish: does any direct workspace child (pnpm-workspace packages
 * or npm / yarn workspaces field) declare a `bin`? A `true` result means
 * the monorepo ships a CLI tool, which suppresses the project-level
 * "no centralized logger" finding.
 *
 * Fail-open: any IO or JSON failure returns false (no suppression).
 */
function hasCliWorkspaceChild(projectPath: string): boolean {
  const globs: string[] = [];

  // pnpm-workspace.yaml — simple YAML `packages:` list
  const wsYaml = readFileSafe(join(projectPath, 'pnpm-workspace.yaml'));
  if (wsYaml !== null) {
    const lines = wsYaml.split('\n');
    let inPkg = false;
    for (const raw of lines) {
      const ln = raw.replace(/#.*$/, '');
      if (/^packages\s*:/.test(ln.trim())) { inPkg = true; continue; }
      if (inPkg) {
        if (/^\S/.test(ln) && ln.trim() !== '') break;
        const m = ln.match(/^\s*-\s*['"]?([^'"\s]+)['"]?/);
        if (m) globs.push(m[1]);
      }
    }
  }

  // package.json workspaces field
  const rootPkg = readFileSafe(join(projectPath, 'package.json'));
  if (rootPkg !== null) {
    try {
      const j = JSON.parse(rootPkg) as {
        workspaces?: string[] | { packages?: string[] };
      };
      if (Array.isArray(j.workspaces)) globs.push(...j.workspaces);
      else if (j.workspaces && Array.isArray(j.workspaces.packages)) {
        globs.push(...j.workspaces.packages);
      }
    } catch {
      // ignore
    }
  }

  for (const glob of globs) {
    const parts = glob.split('/');
    if (parts.length !== 2 || parts[1] !== '*') continue;
    const dir = join(projectPath, parts[0]);
    if (!existsSync(dir)) continue;
    try {
      for (const child of readdirSync(dir)) {
        const childPkgPath = join(dir, child, 'package.json');
        const content = readFileSafe(childPkgPath);
        if (content === null) continue;
        try {
          const parsed = JSON.parse(content) as { bin?: unknown };
          if (parsed.bin !== undefined) return true;
        } catch {
          // ignore malformed sub-package
        }
      }
    } catch {
      // ignore unreadable dir
    }
  }

  return false;
}

/** Test files — findings here are usually intentional patterns, not real issues */
function isTestFile(filePath: string): boolean {
  return /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(filePath)
    || filePath.includes('__tests__/')
    || filePath.includes('__mocks__/')
    || filePath.includes('/test/')
    || filePath.includes('/tests/');
}

/** Detect if a file looks like a route handler */
function isRouteFile(filePath: string): boolean {
  return (
    /\/route\.(ts|js)$/.test(filePath) ||
    /\/api\/.*\.(ts|js)$/.test(filePath) ||
    /\/routes\/.*\.(ts|js)$/.test(filePath) ||
    /\/controllers\/.*\.(ts|js)$/.test(filePath)
  );
}

/** Check if content represents a mutation (write) route */
function hasMutationMethod(content: string): boolean {
  return (
    /export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)\b/.test(content) ||
    /router\.(post|put|patch|delete)\s*\(/.test(content) ||
    /app\.(post|put|patch|delete)\s*\(/.test(content) ||
    /method\s*(?:===|==)\s*['"](?:POST|PUT|PATCH|DELETE)['"]/.test(content)
  );
}

/** Check if a file looks like an auth handler */
function isAuthFile(filePath: string): boolean {
  return (
    /\/(?:login|logout|signin|signout|auth|session|password)\b.*\.(ts|js)$/.test(filePath) ||
    filePath.includes('/auth/')
  );
}

/** Known centralized logger packages */
const LOGGER_PACKAGES = [
  'winston', 'pino', 'bunyan', 'log4js', 'signale',
  'loglevel', 'debug', 'consola', 'npmlog', 'morgan',
  '@nestjs/common', // contains Logger
];

/** Patterns indicating logging calls */
const LOG_CALL_PATTERNS = [
  /\blogger\s*\.\s*(?:info|warn|error|debug|log|audit)\s*\(/,
  /\bwinston\s*\.\s*(?:info|warn|error|debug|log)\s*\(/,
  /\bpino\s*\(\s*\)\s*\.\s*(?:info|warn|error|debug)\s*\(/,
  /\bconsole\.\s*(?:log|warn|error|info)\s*\(/,
  /\bLog\s*\.\s*(?:info|warn|error|debug)\s*\(/,
];

/** Patterns indicating sanitization near log calls */
const SANITIZE_PATTERNS = [
  /sanitize|redact|mask|PII|pii|scrub|censor|strip/i,
  /\breplace\s*\(.*password.*\)/i,
  /\breplace\s*\(.*token.*\)/i,
  /JSON\.stringify\s*\([^)]+,\s*\w+\)/, // JSON.stringify with replacer
];

function hasLogCall(content: string): boolean {
  return LOG_CALL_PATTERNS.some((p) => p.test(content));
}

function hasSanitizationNearLogs(content: string): boolean {
  if (!hasLogCall(content)) return false;
  return SANITIZE_PATTERNS.some((p) => p.test(content));
}

export const loggingCheckerScanner: Scanner = {
  name: 'logging-checker',
  description: 'Checks for proper security logging — centralized logger, audit trails for mutations, auth event logging, PII redaction',
  category: 'quality',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;

    function addFinding(
      severity: Finding['severity'],
      title: string,
      description: string,
      file?: string,
      line?: number,
      fix?: string,
    ): void {
      findings.push({
        id: `LOG-${String(idCounter++).padStart(3, '0')}`,
        scanner: 'logging-checker',
        severity,
        title,
        description,
        category: 'quality',
        owasp: 'A09:2021',
        cwe: 778,
        ...(file ? { file } : {}),
        ...(line ? { line } : {}),
        ...(fix ? { fix } : {}),
      });
    }

    const defaultIgnore = ['node_modules', 'dist', '.next', '.git', 'coverage'];
    const ignore = [...new Set([...defaultIgnore, ...(config.ignore ?? [])])];

    const files = walkFiles(projectPath, ignore, ['ts', 'tsx', 'js', 'jsx', 'mjs']);
    const nonTestFiles = files.filter((f) => {
      if (isTestFile(f)) return false;
      // Skip client components — security logging belongs on the server
      const content = readFileSafe(f);
      if (content && /^['"]use client['"]/.test(content.trim())) return false;
      return true;
    });

    // -------------------------------------------------------------------
    // Check 1: Does the project have a centralized logger?
    // -------------------------------------------------------------------
    let hasCentralizedLogger = false;
    let isCliTool = false;

    // Check package.json for logger dependencies
    const pkgContent = readFileSafe(join(projectPath, 'package.json'));
    if (pkgContent) {
      type PkgJsonShape = {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        bin?: string | Record<string, string>;
      };
      let pkgJson: PkgJsonShape | null = null;
      try {
        pkgJson = JSON.parse(pkgContent) as PkgJsonShape;
      } catch {
        pkgJson = null;
      }
      if (pkgJson) {
        const allDeps = {
          ...(pkgJson.dependencies ?? {}),
          ...(pkgJson.devDependencies ?? {}),
        };
        hasCentralizedLogger = LOGGER_PACKAGES.some((pkg) => pkg in allDeps);
        // v0.9 polish: a package that declares a `bin` is a CLI tool.
        // The "no centralized logger" finding does not apply — console
        // output is the CLI's user-facing control surface, not a debug
        // artifact. Suppress at the source rather than requiring users
        // to blanket-suppress in aegis.config.json. Also check for
        // workspace children that expose `bin` (monorepo root shape).
        isCliTool = pkgJson.bin !== undefined || hasCliWorkspaceChild(projectPath);
      }
    }

    // Check for a custom logger file if no package found
    if (!hasCentralizedLogger) {
      const loggerFileCandidates = [
        join(projectPath, 'lib', 'logger.ts'),
        join(projectPath, 'lib', 'logger.js'),
        join(projectPath, 'utils', 'logger.ts'),
        join(projectPath, 'utils', 'logger.js'),
        join(projectPath, 'src', 'lib', 'logger.ts'),
        join(projectPath, 'src', 'utils', 'logger.ts'),
        join(projectPath, 'src', 'logger.ts'),
        join(projectPath, 'logger.ts'),
        join(projectPath, 'logger.js'),
      ];

      hasCentralizedLogger = loggerFileCandidates.some((f) => existsSync(f));
    }

    // Also check if any source file imports a custom logger
    if (!hasCentralizedLogger) {
      const loggerImportRe = /(?:import|require)\s*(?:\{[^}]*\blogger\b[^}]*\}|['"][^'"]*logger['"]\s*\))/i;
      for (const file of nonTestFiles.slice(0, 100)) { // limit search for performance
        const content = readFileSafe(file);
        if (content && loggerImportRe.test(content)) {
          hasCentralizedLogger = true;
          break;
        }
      }
    }

    if (!hasCentralizedLogger && !isCliTool) {
      addFinding(
        'medium',
        'No centralized logging infrastructure detected',
        'The project does not appear to have a centralized logger (winston, pino, bunyan) or a custom logger module. Centralized logging is essential for security event correlation, incident response, and audit trails. Using console.log() directly makes it difficult to control log levels, format, retention, and PII redaction. Add a logger library and create a shared logger instance.',
        undefined,
        undefined,
        'Install winston or pino: `npm install winston`. Create a shared logger at `lib/logger.ts` and import it throughout the codebase.',
      );
    }

    // -------------------------------------------------------------------
    // Check 2: Are admin mutations logged?
    // -------------------------------------------------------------------
    const mutationRoutes: string[] = [];
    const mutationRoutesWithoutLogs: string[] = [];

    for (const file of nonTestFiles) {
      if (!isRouteFile(file)) continue;

      const content = readFileSafe(file);
      if (!content) continue;

      if (!hasMutationMethod(content)) continue;
      mutationRoutes.push(file);

      const hasAuditLog =
        /audit|log\s*\(|logger\s*\.\s*(?:info|warn|error|audit)/i.test(content) ||
        hasLogCall(content);

      if (!hasAuditLog) {
        mutationRoutesWithoutLogs.push(file);
      }
    }

    if (mutationRoutes.length > 0 && mutationRoutesWithoutLogs.length > 0) {
      const percentage = Math.round((mutationRoutesWithoutLogs.length / mutationRoutes.length) * 100);
      if (percentage > 50) {
        addFinding(
          'medium',
          `${mutationRoutesWithoutLogs.length} of ${mutationRoutes.length} mutation routes (${percentage}%) lack audit logging`,
          `Write operations (POST/PUT/PATCH/DELETE) should be audit-logged for security monitoring and forensic investigation. ${mutationRoutesWithoutLogs.length} route file(s) handle mutations but appear to contain no logging calls. Audit logs should record who did what, when, and from where (user ID, action type, resource ID, timestamp, IP address).`,
          undefined,
          undefined,
          'Add logger.info({ userId, action, resourceId, ip, timestamp }) to all mutation route handlers.',
        );
      } else {
        // Flag individual files that are missing logs
        for (const file of mutationRoutesWithoutLogs.slice(0, 5)) {
          addFinding(
            'low',
            'Mutation route missing audit logging',
            'This route handles write operations (POST/PUT/PATCH/DELETE) but does not appear to log the action. Audit logging is required for security accountability, forensic investigation, and compliance. Log the user ID, action, resource, and timestamp for all mutations.',
            file,
            1,
            'Add a logger call (e.g. logger.info({ action, userId, resourceId })) before returning from mutation handlers.',
          );
        }
      }
    }

    // -------------------------------------------------------------------
    // Check 3: Are auth events logged?
    // -------------------------------------------------------------------
    const authFiles = nonTestFiles.filter((f) => isAuthFile(f));
    const authFilesWithoutLogging: string[] = [];

    for (const file of authFiles) {
      const content = readFileSafe(file);
      if (!content) continue;

      // Auth files should log login/logout/failed attempts
      const hasAuthEventLog = hasLogCall(content) &&
        /login|logout|sign.?in|sign.?out|auth|fail|attempt|invalid/i.test(content);

      if (!hasAuthEventLog && hasLogCall(content) === false) {
        authFilesWithoutLogging.push(file);
      }
    }

    for (const file of authFilesWithoutLogging.slice(0, 3)) {
      addFinding(
        'medium',
        'Auth handler missing security event logging',
        'This authentication handler (login/logout/session management) does not appear to log auth events. Security best practices (OWASP A09, SOC 2, ISO 27001) require logging of all authentication events including successful logins, failed attempts, logouts, and password changes. These logs are essential for detecting brute-force attacks and investigating security incidents.',
        file,
        1,
        'Add logging for auth events: logger.info({ event: "login", userId, ip, success: true/false }).',
      );
    }

    // -------------------------------------------------------------------
    // Check 4: Is PII redacted in logs?
    // -------------------------------------------------------------------
    const filesWithLogs = nonTestFiles.filter((f) => {
      const content = readFileSafe(f);
      return content ? hasLogCall(content) : false;
    });

    if (filesWithLogs.length > 5) {
      // Project has meaningful logging — check if any PII redaction exists
      const anyFileHasSanitization = filesWithLogs.some((f) => {
        const content = readFileSafe(f);
        return content ? hasSanitizationNearLogs(content) : false;
      });

      if (!anyFileHasSanitization) {
        // Check for suspicious PII patterns near log calls
        const piiNearLogPatterns = [
          /(?:logger|console)\s*\.\s*\w+\s*\([^)]*(?:email|password|token|secret|card|ssn|birth)[^)]*\)/i,
          /(?:logger|console)\s*\.\s*\w+\s*\([^)]*(?:req\.body|user\.|profile\.)[^)]*\)/i,
        ];

        let piiInLogsFound = false;
        let piiLogFile: string | undefined;
        let piiLogLine: number | undefined;

        for (const file of filesWithLogs.slice(0, 50)) {
          const content = readFileSafe(file);
          if (!content) continue;
          for (const pattern of piiNearLogPatterns) {
            pattern.lastIndex = 0;
            const match = pattern.exec(content);
            if (match) {
              piiInLogsFound = true;
              piiLogFile = file;
              piiLogLine = content.slice(0, match.index).split('\n').length;
              break;
            }
          }
          if (piiInLogsFound) break;
        }

        if (piiInLogsFound) {
          addFinding(
            'high',
            'PII may be logged without redaction',
            'Log statements appear to include potentially sensitive data (email, password, token, user objects) without sanitization or redaction. Logging PII violates GDPR, CCPA, and other data protection regulations. Implement a log sanitizer that strips sensitive fields before logging (replace passwords with "[REDACTED]", truncate email to domain only, etc.).',
            piiLogFile,
            piiLogLine,
            'Use a PII-sanitizing logger wrapper that redacts sensitive fields. Example: logger.info(sanitize({ user, action })) where sanitize() removes/masks PII fields.',
          );
        } else {
          addFinding(
            'low',
            'No PII redaction detected in logging infrastructure',
            'The project has logging but no evidence of PII redaction patterns (sanitize, redact, mask). Without explicit PII redaction in logging, sensitive data like emails, tokens, and user details may inadvertently appear in log files. Implement a log sanitizer to prevent PII leakage into log storage.',
            undefined,
            undefined,
            'Add a PII-sanitizing wrapper to your logger. Redact fields like: email, password, token, secret, card, ssn, phone.',
          );
        }
      }
    }

    return {
      scanner: 'logging-checker',
      category: 'quality',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
