import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const DEFAULT_IGNORE = ['node_modules', 'dist', '.next', '.git'];

function fileExistsInDirs(projectPath: string, patterns: RegExp[]): boolean {
  const searchDirs = [
    join(projectPath, 'src', 'app'),
    join(projectPath, 'app'),
    join(projectPath, 'src', 'pages'),
    join(projectPath, 'pages'),
    join(projectPath, 'src'),
  ];

  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir, { recursive: true }) as string[];
      for (const entry of entries) {
        if (patterns.some((p) => p.test(entry))) return true;
      }
    } catch {
      // ignore unreadable dirs
    }
  }
  return false;
}

function contentExistsInFiles(
  projectPath: string,
  searchDirs: string[],
  patterns: RegExp[],
  extensions: string[],
  ignoreList: string[] = DEFAULT_IGNORE,
): boolean {
  for (const dir of searchDirs) {
    const fullDir = dir.startsWith('/') ? dir : join(projectPath, dir);
    if (!existsSync(fullDir)) continue;
    try {
      const files = walkFiles(fullDir, ignoreList, extensions);
      for (const file of files) {
        const content = readFileSafe(file);
        if (content === null) continue;
        if (patterns.some((p) => p.test(content))) return true;
      }
    } catch {
      // skip
    }
  }
  return false;
}

export const soc2CheckerScanner: Scanner = {
  name: 'soc2-checker',
  description:
    'Checks SOC 2 Type II Trust Service Criteria: logical access controls (CC6.1), encryption in transit (CC6.6) and at rest (CC6.7), monitoring (CC7.2), change management (CC8.1), and availability (A1.2)',
  category: 'compliance',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    // Only run when SOC2 compliance is explicitly requested
    if (!config.compliance?.includes('soc2')) {
      return { scanner: 'soc2-checker', category: 'compliance', findings: [], duration: Date.now() - start, available: true };
    }

    const findings: Finding[] = [];
    const ignore = [...new Set([...DEFAULT_IGNORE, ...(config.ignore ?? [])])];

    // --- CC6.1: Logical Access Controls ---

    // Check for auth guard patterns in code
    const authPatterns = [
      /secureApiRouteWithTenant/,
      /getServerSession/,
      /\bauth\(\)/,
      /getSession/,
      /requireAuth/,
      /\bauthenticate\b/,
      /verifyToken/,
      /verifySignature/,
      /withAuth/,
      /authGuard/,
    ];

    const hasAuth = contentExistsInFiles(
      projectPath,
      ['src', 'app', 'pages', 'lib', 'utils', 'middleware'],
      authPatterns,
      ['ts', 'js', 'tsx', 'jsx'],
      ignore,
    );

    if (!hasAuth) {
      findings.push({
        id: 'SOC2-001',
        scanner: 'soc2-checker',
        severity: 'high',
        title: 'CC6.1 — No authentication guards found',
        description:
          'No authentication guard patterns were detected in the codebase. SOC 2 CC6.1 requires logical access controls to restrict access to information assets. Implement authentication middleware on API routes.',
        category: 'compliance',
      });
    }

    // Check for RBAC patterns
    const rbacPatterns = [
      /requireRole/,
      /requireRoleOrSelf/,
      /checkRole/,
      /hasRole/,
      /isAdmin/,
      /isManager/,
      /authorize/,
      /rbac/i,
      /role[-_]?guard/i,
    ];

    const hasRbac = contentExistsInFiles(
      projectPath,
      ['src', 'app', 'pages', 'lib', 'utils', 'middleware'],
      rbacPatterns,
      ['ts', 'js', 'tsx', 'jsx'],
      ignore,
    );

    if (!hasRbac) {
      findings.push({
        id: 'SOC2-002',
        scanner: 'soc2-checker',
        severity: 'medium',
        title: 'CC6.1 — No RBAC patterns found',
        description:
          'No role-based access control patterns were detected. SOC 2 CC6.1 requires that access is restricted based on user roles and responsibilities.',
        category: 'compliance',
      });
    }

    // --- CC6.6: Encryption of Data in Transit ---

    // Check for HSTS header configuration
    const hstsPatterns = [
      /Strict-Transport-Security/,
      /hsts/i,
      /strictTransportSecurity/i,
    ];

    const hasHsts = contentExistsInFiles(
      projectPath,
      ['src', 'app', 'pages', 'lib', 'middleware', 'next.config'],
      hstsPatterns,
      ['ts', 'js', 'tsx', 'jsx', 'mjs'],
      ignore,
    );

    // Also check config files at root
    let hasHstsInConfig = false;
    for (const configFile of ['next.config.js', 'next.config.mjs', 'next.config.ts', 'vercel.json', 'nginx.conf']) {
      const filePath = join(projectPath, configFile);
      if (existsSync(filePath)) {
        const content = readFileSafe(filePath);
        if (content && hstsPatterns.some((p) => p.test(content))) {
          hasHstsInConfig = true;
          break;
        }
      }
    }

    if (!hasHsts && !hasHstsInConfig) {
      findings.push({
        id: 'SOC2-003',
        scanner: 'soc2-checker',
        severity: 'medium',
        title: 'CC6.6 — No HSTS header configuration found',
        description:
          'No Strict-Transport-Security header configuration was detected. SOC 2 CC6.6 requires encryption of data in transit. Configure HSTS to enforce HTTPS connections.',
        category: 'compliance',
      });
    }

    // Check for TLS/HTTPS references
    const tlsPatterns = [
      /https:\/\//,
      /testssl/i,
      /tls/i,
      /ssl/i,
    ];

    const hasTls = contentExistsInFiles(
      projectPath,
      ['src', 'lib', 'config'],
      tlsPatterns,
      ['ts', 'js', 'json'],
      ignore,
    );

    if (!hasTls && !hasHsts && !hasHstsInConfig) {
      findings.push({
        id: 'SOC2-004',
        scanner: 'soc2-checker',
        severity: 'high',
        title: 'CC6.6 — No TLS/HTTPS configuration found',
        description:
          'No TLS configuration or HTTPS references were found in the codebase. SOC 2 CC6.6 requires that data in transit is encrypted.',
        category: 'compliance',
      });
    }

    // --- CC6.7: Encryption of Data at Rest ---

    const encryptionPatterns = [
      /\bencrypt\b/i,
      /\bdecrypt\b/i,
      /AES/,
      /createCipheriv/,
      /createDecipheriv/,
      /crypto\.subtle/,
    ];

    const hasEncryption = contentExistsInFiles(
      projectPath,
      ['src', 'lib', 'utils'],
      encryptionPatterns,
      ['ts', 'js'],
      ignore,
    );

    if (!hasEncryption) {
      findings.push({
        id: 'SOC2-005',
        scanner: 'soc2-checker',
        severity: 'medium',
        title: 'CC6.7 — No encryption utility for data at rest',
        description:
          'No encryption utility (AES, createCipheriv, encrypt/decrypt) was found. SOC 2 CC6.7 requires encryption of sensitive data at rest.',
        category: 'compliance',
      });
    }

    // Check sensitive DB columns for encryption indicators
    const sensitiveColumnPatterns = [
      /password/i,
      /api[-_]?key/i,
      /secret/i,
      /token/i,
    ];
    const encryptionIndicatorPatterns = [
      /encrypted/i,
      /cipher/i,
      /pgp_sym_encrypt/i,
      /\biv\b/,
    ];

    let hasSensitiveWithoutEncryption = false;
    const migrationDirs = [
      join(projectPath, 'supabase', 'migrations'),
      join(projectPath, 'migrations'),
      join(projectPath, 'db', 'migrations'),
    ];

    for (const dir of migrationDirs) {
      if (!existsSync(dir)) continue;
      try {
        const files = walkFiles(dir, [], ['sql']);
        for (const file of files) {
          const content = readFileSafe(file);
          if (content === null) continue;
          if (
            sensitiveColumnPatterns.some((p) => p.test(content)) &&
            !encryptionIndicatorPatterns.some((p) => p.test(content))
          ) {
            hasSensitiveWithoutEncryption = true;
            break;
          }
        }
      } catch {
        // skip
      }
      if (hasSensitiveWithoutEncryption) break;
    }

    if (hasSensitiveWithoutEncryption) {
      findings.push({
        id: 'SOC2-006',
        scanner: 'soc2-checker',
        severity: 'medium',
        title: 'CC6.7 — Sensitive DB columns may lack encryption',
        description:
          'Database migrations contain sensitive columns (password, api_key, secret, token) without encryption indicators. SOC 2 CC6.7 requires encryption of sensitive data at rest.',
        category: 'compliance',
      });
    }

    // --- CC7.2: Monitoring and Detection ---

    const loggingPatterns = [
      /\blogger\b/,
      /\bwinston\b/,
      /\bpino\b/,
      /\bbunyan\b/,
      /\blog4js\b/,
      /\bsentry\b/i,
      /\bdatadog\b/i,
    ];

    const hasLogging = contentExistsInFiles(
      projectPath,
      ['src', 'lib', 'utils'],
      loggingPatterns,
      ['ts', 'js'],
      ignore,
    );

    if (!hasLogging) {
      findings.push({
        id: 'SOC2-007',
        scanner: 'soc2-checker',
        severity: 'medium',
        title: 'CC7.2 — No structured logging infrastructure found',
        description:
          'No structured logging framework (logger, winston, pino, sentry) was detected. SOC 2 CC7.2 requires monitoring and detection of anomalies.',
        category: 'compliance',
      });
    }

    // Check for audit log
    const auditLogPatterns = [
      /audit[-_]?log/i,
      /auditLog/,
      /audit[-_]?trail/i,
      /auditTrail/,
    ];

    const hasAuditLog = contentExistsInFiles(
      projectPath,
      ['src', 'lib', 'app', 'pages'],
      auditLogPatterns,
      ['ts', 'js'],
      ignore,
    );

    // Also check migrations
    let hasAuditTable = false;
    for (const dir of migrationDirs) {
      if (!existsSync(dir)) continue;
      try {
        const files = walkFiles(dir, [], ['sql', 'ts', 'js']);
        for (const file of files) {
          const content = readFileSafe(file);
          if (content === null) continue;
          if (/CREATE TABLE[^;]*audit/i.test(content) || /audit_log/i.test(content)) {
            hasAuditTable = true;
            break;
          }
        }
      } catch {
        // skip
      }
      if (hasAuditTable) break;
    }

    if (!hasAuditLog && !hasAuditTable) {
      findings.push({
        id: 'SOC2-008',
        scanner: 'soc2-checker',
        severity: 'medium',
        title: 'CC7.2 — No audit log table or API found',
        description:
          'No audit log table or API was detected. SOC 2 CC7.2 requires monitoring capabilities including audit trails for detecting and investigating anomalies.',
        category: 'compliance',
      });
    }

    // --- CC8.1: Change Management ---

    // Check for CI/CD configuration
    const hasCiConfig =
      existsSync(join(projectPath, '.github', 'workflows')) ||
      existsSync(join(projectPath, '.gitlab-ci.yml')) ||
      existsSync(join(projectPath, '.circleci')) ||
      existsSync(join(projectPath, 'Jenkinsfile')) ||
      existsSync(join(projectPath, '.travis.yml'));

    if (!hasCiConfig) {
      findings.push({
        id: 'SOC2-009',
        scanner: 'soc2-checker',
        severity: 'medium',
        title: 'CC8.1 — No CI/CD pipeline configuration found',
        description:
          'No CI/CD configuration (GitHub Actions, GitLab CI, CircleCI, Jenkins) was found. SOC 2 CC8.1 requires formal change management processes.',
        category: 'compliance',
      });
    }

    // Check for test files
    const hasTests = fileExistsInDirs(projectPath, [
      /\.test\./,
      /\.spec\./,
      /__tests__/,
    ]);

    // Also check common test directories
    const hasTestDir =
      existsSync(join(projectPath, '__tests__')) ||
      existsSync(join(projectPath, 'tests')) ||
      existsSync(join(projectPath, 'test')) ||
      existsSync(join(projectPath, 'e2e')) ||
      existsSync(join(projectPath, 'cypress'));

    if (!hasTests && !hasTestDir) {
      findings.push({
        id: 'SOC2-010',
        scanner: 'soc2-checker',
        severity: 'medium',
        title: 'CC8.1 — No test files found',
        description:
          'No test files (.test.*, .spec.*) or test directories were found. SOC 2 CC8.1 requires that changes are tested before deployment.',
        category: 'compliance',
      });
    }

    // --- A1.2: Availability (Backups/Recovery) ---

    const healthPatterns = [
      /\/health/,
      /\/status/,
      /\/readiness/,
      /\/liveness/,
      /healthCheck/i,
      /health[-_]?check/i,
    ];

    const hasHealthCheck = contentExistsInFiles(
      projectPath,
      ['src', 'app', 'pages'],
      healthPatterns,
      ['ts', 'js', 'tsx', 'jsx'],
      ignore,
    );

    // Also check for health route directories
    const hasHealthRoute =
      existsSync(join(projectPath, 'src', 'app', 'api', 'health')) ||
      existsSync(join(projectPath, 'app', 'api', 'health')) ||
      existsSync(join(projectPath, 'src', 'app', 'health')) ||
      existsSync(join(projectPath, 'pages', 'api', 'health'));

    if (!hasHealthCheck && !hasHealthRoute) {
      findings.push({
        id: 'SOC2-011',
        scanner: 'soc2-checker',
        severity: 'low',
        title: 'A1.2 — No health check endpoint found',
        description:
          'No health check endpoint (/health, /status, /readiness) was found. SOC 2 A1.2 (Availability) requires mechanisms to monitor system availability and enable recovery.',
        category: 'compliance',
      });
    }

    return {
      scanner: 'soc2-checker',
      category: 'compliance',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
