import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { existsSync } from 'fs';
import { join } from 'path';

const DEFAULT_IGNORE = ['node_modules', 'dist', '.next', '.git'];

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

function findContentInFilesWithPath(
  projectPath: string,
  searchDirs: string[],
  contentPatterns: RegExp[],
  extensions: string[],
  ignoreList: string[] = DEFAULT_IGNORE,
): { file: string; content: string }[] {
  const matches: { file: string; content: string }[] = [];
  for (const dir of searchDirs) {
    const fullDir = dir.startsWith('/') ? dir : join(projectPath, dir);
    if (!existsSync(fullDir)) continue;
    try {
      const files = walkFiles(fullDir, ignoreList, extensions);
      for (const file of files) {
        const content = readFileSafe(file);
        if (content === null) continue;
        if (contentPatterns.some((p) => p.test(content))) {
          matches.push({ file, content });
        }
      }
    } catch {
      // skip
    }
  }
  return matches;
}

export const iso27001CheckerScanner: Scanner = {
  name: 'iso27001-checker',
  description:
    'Checks ISO 27001 Annex A controls: cryptography (A.8.24), configuration management (A.8.9), secure development lifecycle (A.8.25), secure coding (A.8.28), and privacy/PII (A.5.34)',
  category: 'compliance',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    // Only run when ISO 27001 compliance is explicitly requested
    if (!config.compliance?.includes('iso27001')) {
      return { scanner: 'iso27001-checker', category: 'compliance', findings: [], duration: Date.now() - start, available: true };
    }

    const findings: Finding[] = [];
    const ignore = [...new Set([...DEFAULT_IGNORE, ...(config.ignore ?? [])])];

    // --- A.8.24: Use of Cryptography ---

    // Check for weak crypto (MD5/SHA1)
    const weakCryptoFiles = findContentInFilesWithPath(
      projectPath,
      ['src', 'lib', 'utils', 'app', 'pages'],
      [/\bMD5\b/, /\bmd5\b/, /createHash\(['"]md5['"]\)/, /createHash\(['"]sha1['"]\)/, /\bSHA1\b/i],
      ['ts', 'js', 'tsx', 'jsx'],
      ignore,
    );

    for (const match of weakCryptoFiles) {
      findings.push({
        id: 'ISO-001',
        scanner: 'iso27001-checker',
        severity: 'high',
        title: 'A.8.24 — Weak cryptographic algorithm detected (MD5/SHA1)',
        description:
          'MD5 or SHA1 usage detected. ISO 27001 A.8.24 requires use of strong, approved cryptographic algorithms. Use SHA-256 or stronger.',
        file: match.file,
        category: 'compliance',
      });
      break; // one finding is enough
    }

    // Check for proper key management (no hardcoded keys)
    const hardcodedKeyPatterns = [
      /(?:const|let|var)\s+(?:secret|key|apiKey|api_key|SECRET|KEY)\s*=\s*['"][a-zA-Z0-9+/=]{16,}['"]/,
      /(?:password|passwd)\s*[:=]\s*['"][^'"]{8,}['"]/i,
    ];

    const hardcodedKeyFiles = findContentInFilesWithPath(
      projectPath,
      ['src', 'lib', 'utils', 'app', 'pages', 'config'],
      hardcodedKeyPatterns,
      ['ts', 'js', 'tsx', 'jsx'],
      ignore,
    );

    for (const match of hardcodedKeyFiles) {
      // Skip test files
      if (/\.test\.|\.spec\.|__tests__|__mocks__/.test(match.file)) continue;
      findings.push({
        id: 'ISO-002',
        scanner: 'iso27001-checker',
        severity: 'high',
        title: 'A.8.24 — Hardcoded cryptographic key or secret detected',
        description:
          'A hardcoded key, secret, or password was detected in source code. ISO 27001 A.8.24 requires proper key management. Use environment variables or a secrets manager.',
        file: match.file,
        category: 'compliance',
      });
      break;
    }

    // --- A.8.9: Configuration Management ---

    // Check if .env is excluded from git
    const hasGitignore = existsSync(join(projectPath, '.gitignore'));
    let envInGitignore = false;
    if (hasGitignore) {
      const gitignoreContent = readFileSafe(join(projectPath, '.gitignore'));
      if (gitignoreContent) {
        envInGitignore = /\.env/.test(gitignoreContent);
      }
    }

    if (!envInGitignore) {
      findings.push({
        id: 'ISO-003',
        scanner: 'iso27001-checker',
        severity: 'high',
        title: 'A.8.9 — .env not excluded in .gitignore',
        description:
          'The .gitignore file does not exclude .env files. ISO 27001 A.8.9 requires secure configuration management. Environment files containing secrets must not be committed to version control.',
        category: 'compliance',
      });
    }

    // Check that config uses environment variables
    const envVarPatterns = [
      /process\.env\./,
      /import\.meta\.env\./,
      /Deno\.env/,
    ];

    const hasEnvVarUsage = contentExistsInFiles(
      projectPath,
      ['src', 'lib', 'config', 'app'],
      envVarPatterns,
      ['ts', 'js', 'mjs'],
      ignore,
    );

    if (!hasEnvVarUsage) {
      findings.push({
        id: 'ISO-004',
        scanner: 'iso27001-checker',
        severity: 'medium',
        title: 'A.8.9 — No environment variable usage detected',
        description:
          'No environment variable usage (process.env, import.meta.env) was found in configuration code. ISO 27001 A.8.9 requires externalized configuration for secrets and environment-specific settings.',
        category: 'compliance',
      });
    }

    // --- A.8.25: Secure Development Lifecycle ---

    // Check for test files
    const hasTests = contentExistsInFiles(
      projectPath,
      ['src', '__tests__', 'tests', 'test', 'e2e'],
      [/\bdescribe\b/, /\bit\b\(/, /\btest\b\(/, /\bexpect\b/],
      ['ts', 'js', 'tsx', 'jsx'],
      ignore,
    );

    const hasTestDir =
      existsSync(join(projectPath, '__tests__')) ||
      existsSync(join(projectPath, 'tests')) ||
      existsSync(join(projectPath, 'test')) ||
      existsSync(join(projectPath, 'e2e')) ||
      existsSync(join(projectPath, 'cypress'));

    if (!hasTests && !hasTestDir) {
      findings.push({
        id: 'ISO-005',
        scanner: 'iso27001-checker',
        severity: 'medium',
        title: 'A.8.25 — No test infrastructure found',
        description:
          'No test files or test directories were found. ISO 27001 A.8.25 requires a secure development lifecycle including testing.',
        category: 'compliance',
      });
    }

    // Check for CI/CD pipeline
    const hasCiConfig =
      existsSync(join(projectPath, '.github', 'workflows')) ||
      existsSync(join(projectPath, '.gitlab-ci.yml')) ||
      existsSync(join(projectPath, '.circleci')) ||
      existsSync(join(projectPath, 'Jenkinsfile')) ||
      existsSync(join(projectPath, '.travis.yml'));

    if (!hasCiConfig) {
      findings.push({
        id: 'ISO-006',
        scanner: 'iso27001-checker',
        severity: 'medium',
        title: 'A.8.25 — No CI/CD pipeline configuration found',
        description:
          'No CI/CD configuration was found. ISO 27001 A.8.25 requires secure development practices including automated build and deployment pipelines.',
        category: 'compliance',
      });
    }

    // Check for linting configuration
    const hasLintConfig =
      existsSync(join(projectPath, '.eslintrc.json')) ||
      existsSync(join(projectPath, '.eslintrc.js')) ||
      existsSync(join(projectPath, '.eslintrc.cjs')) ||
      existsSync(join(projectPath, 'eslint.config.js')) ||
      existsSync(join(projectPath, 'eslint.config.mjs')) ||
      existsSync(join(projectPath, 'eslint.config.ts')) ||
      existsSync(join(projectPath, 'biome.json')) ||
      existsSync(join(projectPath, '.prettierrc')) ||
      existsSync(join(projectPath, '.prettierrc.json'));

    if (!hasLintConfig) {
      findings.push({
        id: 'ISO-007',
        scanner: 'iso27001-checker',
        severity: 'low',
        title: 'A.8.25 — No linting configuration found',
        description:
          'No linting configuration (ESLint, Biome, Prettier) was found. ISO 27001 A.8.25 recommends automated code quality enforcement as part of the development lifecycle.',
        category: 'compliance',
      });
    }

    // --- A.8.28: Secure Coding ---

    // Check for eval() usage
    const evalFiles = findContentInFilesWithPath(
      projectPath,
      ['src', 'lib', 'app', 'pages'],
      [/\beval\s*\(/, /new\s+Function\s*\(/],
      ['ts', 'js', 'tsx', 'jsx'],
      ignore,
    );

    for (const match of evalFiles) {
      if (/\.test\.|\.spec\.|__tests__|__mocks__/.test(match.file)) continue;
      findings.push({
        id: 'ISO-008',
        scanner: 'iso27001-checker',
        severity: 'high',
        title: 'A.8.28 — eval() or new Function() usage detected',
        description:
          'Usage of eval() or new Function() detected. ISO 27001 A.8.28 requires secure coding practices. These functions can execute arbitrary code and are a common injection vector.',
        file: match.file,
        category: 'compliance',
      });
      break;
    }

    // Check for dangerouslySetInnerHTML without sanitize
    const dangerousHtmlFiles = findContentInFilesWithPath(
      projectPath,
      ['src', 'app', 'pages', 'components'],
      [/dangerouslySetInnerHTML/],
      ['tsx', 'jsx'],
      ignore,
    );

    for (const match of dangerousHtmlFiles) {
      const hasSanitize = /sanitize|DOMPurify|dompurify|purify|xss/i.test(match.content);
      if (!hasSanitize) {
        findings.push({
          id: 'ISO-009',
          scanner: 'iso27001-checker',
          severity: 'high',
          title: 'A.8.28 — dangerouslySetInnerHTML without sanitization',
          description:
            'dangerouslySetInnerHTML used without visible sanitization (DOMPurify, sanitize). ISO 27001 A.8.28 requires secure coding practices to prevent XSS.',
          file: match.file,
          category: 'compliance',
        });
        break;
      }
    }

    // Check for input validation (Zod, joi, yup)
    const validationPatterns = [
      /\bzod\b/i,
      /z\.object/,
      /z\.string/,
      /\bjoi\b/,
      /Joi\.object/,
      /\byup\b/,
      /yup\.object/,
      /\bvalibot\b/i,
      /\barktype\b/i,
    ];

    const hasValidation = contentExistsInFiles(
      projectPath,
      ['src', 'lib', 'app', 'pages', 'utils'],
      validationPatterns,
      ['ts', 'js', 'tsx', 'jsx'],
      ignore,
    );

    if (!hasValidation) {
      findings.push({
        id: 'ISO-010',
        scanner: 'iso27001-checker',
        severity: 'medium',
        title: 'A.8.28 — No input validation library detected',
        description:
          'No input validation library (Zod, Joi, Yup, Valibot) was detected in the codebase. ISO 27001 A.8.28 requires secure coding practices including input validation to prevent injection attacks.',
        category: 'compliance',
      });
    }

    // --- A.5.34: Privacy & PII ---

    // Check for privacy/GDPR page
    const privacyPagePatterns = [
      /datenschutz/i,
      /privacy[-_]?policy/i,
      /privacy/i,
      /gdpr/i,
    ];

    const hasPrivacyPage = contentExistsInFiles(
      projectPath,
      ['src', 'app', 'pages'],
      privacyPagePatterns,
      ['ts', 'tsx', 'js', 'jsx'],
      ignore,
    );

    if (!hasPrivacyPage) {
      findings.push({
        id: 'ISO-011',
        scanner: 'iso27001-checker',
        severity: 'medium',
        title: 'A.5.34 — No privacy policy or GDPR page found',
        description:
          'No privacy policy or GDPR-related page was found. ISO 27001 A.5.34 requires privacy protection and handling of PII in compliance with applicable regulations.',
        category: 'compliance',
      });
    }

    // Check for consent mechanism
    const consentPatterns = [
      /consent/i,
      /cookie[-_]?consent/i,
      /opt[-_]?in/i,
    ];

    const hasConsent = contentExistsInFiles(
      projectPath,
      ['src', 'app', 'pages', 'components'],
      consentPatterns,
      ['ts', 'tsx', 'js', 'jsx'],
      ignore,
    );

    if (!hasConsent) {
      findings.push({
        id: 'ISO-012',
        scanner: 'iso27001-checker',
        severity: 'medium',
        title: 'A.5.34 — No consent mechanism found',
        description:
          'No consent mechanism (cookie consent, opt-in) was found. ISO 27001 A.5.34 requires mechanisms for obtaining and recording user consent for PII processing.',
        category: 'compliance',
      });
    }

    // Check for PII in logs
    const logPiiPatterns = [
      /console\.log\([^)]*(?:email|password|ssn|creditCard|credit_card|token)/i,
      /logger\.\w+\([^)]*(?:email|password|ssn|creditCard|credit_card)/i,
    ];

    const hasPiiInLogs = findContentInFilesWithPath(
      projectPath,
      ['src', 'lib', 'app', 'pages'],
      logPiiPatterns,
      ['ts', 'js', 'tsx', 'jsx'],
      ignore,
    );

    for (const match of hasPiiInLogs) {
      if (/\.test\.|\.spec\.|__tests__|__mocks__/.test(match.file)) continue;
      findings.push({
        id: 'ISO-013',
        scanner: 'iso27001-checker',
        severity: 'high',
        title: 'A.5.34 — Potential PII in log statements',
        description:
          'Log statements may contain PII (email, password, token). ISO 27001 A.5.34 requires that PII is not exposed in logs. Implement PII sanitization in logging.',
        file: match.file,
        category: 'compliance',
      });
      break;
    }

    return {
      scanner: 'iso27001-checker',
      category: 'compliance',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
