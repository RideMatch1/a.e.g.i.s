import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { existsSync } from 'fs';
import { join } from 'path';

const DEFAULT_IGNORE = ['node_modules', 'dist', '.next', '.git'];

const PAYMENT_DEPS = [
  'stripe',
  '@stripe/stripe-js',
  '@stripe/react-stripe-js',
  'braintree',
  'braintree-web',
  'adyen-web',
  '@adyen/adyen-web',
  'paypal-rest-sdk',
  '@paypal/react-paypal-js',
  '@paypal/checkout-server-sdk',
  'square',
  '@square/web-sdk',
];

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

function passesLuhn(digits: string): boolean {
  const nums = digits.replace(/[-\s]/g, '').split('').map(Number);
  if (nums.length < 13 || nums.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = nums.length - 1; i >= 0; i--) {
    let n = nums[i];
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/**
 * Check if the project has payment processing dependencies.
 * Reads package.json and checks for known payment provider packages.
 */
function hasPaymentProcessing(projectPath: string, config: AegisConfig): boolean {
  // Check stack detection first
  if (config.stack?.payment === 'stripe') return true;

  // Read package.json for payment deps
  const pkgPath = join(projectPath, 'package.json');
  if (!existsSync(pkgPath)) return false;

  try {
    const pkgContent = readFileSafe(pkgPath);
    if (!pkgContent) return false;

    const pkg = JSON.parse(pkgContent) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    return PAYMENT_DEPS.some((dep) => dep in allDeps);
  } catch {
    return false;
  }
}

export const pciDssCheckerScanner: Scanner = {
  name: 'pci-dss-checker',
  description:
    'Checks PCI-DSS v4.0 requirements: PAN storage (Req 3.4), secure development (Req 6.2), WAF/CSP (Req 6.4), strong authentication (Req 8.3), and penetration testing (Req 11.3). Only runs if payment processing dependencies are detected.',
  category: 'compliance',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const ignore = [...new Set([...DEFAULT_IGNORE, ...(config.ignore ?? [])])];

    // Check if PCI-DSS is applicable
    if (!hasPaymentProcessing(projectPath, config)) {
      return {
        scanner: 'pci-dss-checker',
        category: 'compliance',
        findings: [],
        duration: Date.now() - start,
        available: true,
      };
    }

    // --- Req 3.4: PAN Storage ---

    // Check for credit card number patterns in source code
    const ccNumberPattern = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/;
    const sourceFiles = walkFiles(projectPath, ignore, ['ts', 'js', 'tsx', 'jsx']);

    for (const file of sourceFiles) {
      // Skip package-lock, yarn.lock, etc.
      if (/lock\.json|lock\.yaml|\.lock$/.test(file)) continue;
      const content = readFileSafe(file);
      if (content === null) continue;
      const ccMatch = content.match(ccNumberPattern);
      if (ccMatch && passesLuhn(ccMatch[0])) {
        // Skip if it's a test file with obvious test card numbers
        if (/\.test\.|\.spec\.|__tests__|__mocks__/.test(file) && /4242\s?4242\s?4242\s?4242/.test(content)) continue;
        // Skip UUID patterns (e.g. 00000000-0000-0000-0000-000000000000)
        const matchIdx = ccMatch.index ?? 0;
        const surrounding = content.slice(Math.max(0, matchIdx - 20), matchIdx + ccMatch[0].length + 20);
        if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(surrounding)) continue;
        // Skip all-zero placeholder patterns (e.g. "0000 0000 0000 0000")
        const digits = ccMatch[0].replace(/[-\s]/g, '');
        if (/^0+$/.test(digits)) continue;
        // Skip if inside a placeholder/label attribute
        if (/placeholder\s*[=:]\s*["'][^"']*$/.test(content.slice(Math.max(0, matchIdx - 60), matchIdx))) continue;
        findings.push({
          id: 'PCI-001',
          scanner: 'pci-dss-checker',
          severity: 'critical',
          title: 'Req 3.4 — Potential credit card number in source code',
          description:
            'A pattern matching a credit card number was found in source code. PCI-DSS Req 3.4 prohibits storage of PAN (Primary Account Number) in plaintext. Never store raw card numbers — use tokenization.',
          file,
          category: 'compliance',
        });
        break;
      }
    }

    // Check Stripe Elements pattern (client-side tokenization)
    const hasStripe = contentExistsInFiles(
      projectPath,
      ['src', 'app', 'pages', 'components'],
      [/stripe/i],
      ['ts', 'js', 'tsx', 'jsx'],
      ignore,
    );

    if (hasStripe) {
      // If using Stripe, check for Stripe Elements (proper pattern) vs raw card handling
      const hasStripeElements = contentExistsInFiles(
        projectPath,
        ['src', 'app', 'pages', 'components'],
        [/CardElement|PaymentElement|Elements\s*>|loadStripe|useStripe|useElements/],
        ['ts', 'tsx', 'js', 'jsx'],
        ignore,
      );

      const rawCardHandling = findContentInFilesWithPath(
        projectPath,
        ['src', 'lib', 'app', 'pages'],
        [/card[-_]?number|cardNumber|card_num|pan\b/i],
        ['ts', 'js'],
        ignore,
      );

      // Filter out test files from raw card handling
      const nonTestRawCard = rawCardHandling.filter(
        (m) => !/\.test\.|\.spec\.|__tests__|__mocks__/.test(m.file),
      );

      if (!hasStripeElements && nonTestRawCard.length > 0) {
        findings.push({
          id: 'PCI-002',
          scanner: 'pci-dss-checker',
          severity: 'high',
          title: 'Req 3.4 — Raw card data handling without Stripe Elements',
          description:
            'Card data references found in server code without Stripe Elements pattern. PCI-DSS Req 3.4 requires that card data never touches your server. Use Stripe Elements or PaymentElement for client-side tokenization.',
          file: nonTestRawCard[0]?.file,
          category: 'compliance',
        });
      }
    }

    // --- Req 6.2: Secure Development ---

    // Check for input validation
    const hasValidation = contentExistsInFiles(
      projectPath,
      ['src', 'lib', 'app', 'pages', 'utils'],
      [/\bz\.\w+/, /Joi\.\w+/, /yup\.\w+/, /\bvalidate\b/i, /\bsanitize\b/i],
      ['ts', 'js', 'tsx', 'jsx'],
      ignore,
    );

    if (!hasValidation) {
      findings.push({
        id: 'PCI-003',
        scanner: 'pci-dss-checker',
        severity: 'medium',
        title: 'Req 6.2 — No input validation detected',
        description:
          'No input validation library or pattern was found. PCI-DSS Req 6.2 requires secure development practices including input validation and output encoding.',
        category: 'compliance',
      });
    }

    // Check for output encoding
    const hasOutputEncoding = contentExistsInFiles(
      projectPath,
      ['src', 'lib', 'utils'],
      [/escapeHtml|encodeURIComponent|sanitize|DOMPurify|xss/i],
      ['ts', 'js', 'tsx', 'jsx'],
      ignore,
    );

    if (!hasOutputEncoding) {
      findings.push({
        id: 'PCI-004',
        scanner: 'pci-dss-checker',
        severity: 'low',
        title: 'Req 6.2 — No output encoding utility detected',
        description:
          'No output encoding or sanitization utility (escapeHtml, DOMPurify) was found. PCI-DSS Req 6.2 recommends output encoding to prevent injection attacks.',
        category: 'compliance',
      });
    }

    // --- Req 6.4: WAF/CSP ---

    // Check for CSP header
    const cspPatterns = [
      /Content-Security-Policy/,
      /contentSecurityPolicy/i,
      /\bcsp\b/i,
    ];

    const hasCsp = contentExistsInFiles(
      projectPath,
      ['src', 'lib', 'middleware', 'app', 'pages'],
      cspPatterns,
      ['ts', 'js', 'tsx', 'jsx', 'mjs'],
      ignore,
    );

    // Also check config files
    let hasCspInConfig = false;
    for (const configFile of ['next.config.js', 'next.config.mjs', 'next.config.ts', 'vercel.json']) {
      const filePath = join(projectPath, configFile);
      if (existsSync(filePath)) {
        const content = readFileSafe(filePath);
        if (content && cspPatterns.some((p) => p.test(content))) {
          hasCspInConfig = true;
          break;
        }
      }
    }

    if (!hasCsp && !hasCspInConfig) {
      findings.push({
        id: 'PCI-005',
        scanner: 'pci-dss-checker',
        severity: 'medium',
        title: 'Req 6.4 — No Content Security Policy configured',
        description:
          'No Content-Security-Policy header configuration was found. PCI-DSS Req 6.4 requires a web application firewall or equivalent protection. CSP is a critical client-side defense.',
        category: 'compliance',
      });
    }

    // Check for rate limiting on payment endpoints
    const hasRateLimit = contentExistsInFiles(
      projectPath,
      ['src', 'lib', 'middleware', 'app', 'pages', 'utils'],
      [/rate[-_]?limit/i, /rateLimit/i, /throttle/i],
      ['ts', 'js'],
      ignore,
    );

    if (!hasRateLimit) {
      findings.push({
        id: 'PCI-006',
        scanner: 'pci-dss-checker',
        severity: 'medium',
        title: 'Req 6.4 — No rate limiting detected',
        description:
          'No rate limiting was found. PCI-DSS Req 6.4 requires protection against automated attacks. Rate limiting on payment and authentication endpoints is essential.',
        category: 'compliance',
      });
    }

    // --- Req 8.3: Strong Authentication ---

    // Check for password hashing
    const hashPatterns = [
      /\bbcrypt\b/,
      /\bargon2\b/i,
      /\bscrypt\b/,
      /\bpbkdf2\b/i,
      /hashPassword/i,
      /password[-_]?hash/i,
    ];

    const hasPasswordHashing = contentExistsInFiles(
      projectPath,
      ['src', 'lib', 'utils', 'app'],
      hashPatterns,
      ['ts', 'js'],
      ignore,
    );

    // Also check package.json for hashing deps
    let hasHashDep = false;
    const pkgPath = join(projectPath, 'package.json');
    if (existsSync(pkgPath)) {
      const pkgContent = readFileSafe(pkgPath);
      if (pkgContent) {
        hasHashDep = /bcrypt|argon2|scrypt/.test(pkgContent);
      }
    }

    // If project uses Supabase Auth, hashing is handled server-side
    const usesAuthService = contentExistsInFiles(
      projectPath,
      ['src', 'lib', 'utils', 'app'],
      [/supabase.*auth|auth0|clerk|next-?auth|lucia/i],
      ['ts', 'js'],
      ignore,
    );

    if (!hasPasswordHashing && !hasHashDep && !usesAuthService) {
      findings.push({
        id: 'PCI-007',
        scanner: 'pci-dss-checker',
        severity: 'high',
        title: 'Req 8.3 — No password hashing detected',
        description:
          'No password hashing library (bcrypt, argon2, scrypt) was found. PCI-DSS Req 8.3 requires strong authentication including proper password storage.',
        category: 'compliance',
      });
    }

    // Check for plaintext password comparison
    const plaintextPasswordFiles = findContentInFilesWithPath(
      projectPath,
      ['src', 'lib', 'app', 'pages'],
      [/password\s*===?\s*['"]/, /===?\s*password\b/, /password\s*==\s*req/],
      ['ts', 'js'],
      ignore,
    );

    for (const match of plaintextPasswordFiles) {
      if (/\.test\.|\.spec\.|__tests__|__mocks__/.test(match.file)) continue;
      findings.push({
        id: 'PCI-008',
        scanner: 'pci-dss-checker',
        severity: 'critical',
        title: 'Req 8.3 — Potential plaintext password comparison',
        description:
          'A pattern suggesting plaintext password comparison was found. PCI-DSS Req 8.3 requires that passwords are never compared in plaintext. Use timing-safe comparison with hashed values.',
        file: match.file,
        category: 'compliance',
      });
      break;
    }

    // --- Req 11.3: Penetration Testing ---

    const securityTestPatterns = [
      /security[-_]?scan/i,
      /pentest/i,
      /penetration/i,
      /security[-_]?test/i,
      /vulnerability/i,
      /owasp/i,
      /zap/i,
      /nuclei/i,
    ];

    const hasSecurityTests = contentExistsInFiles(
      projectPath,
      ['src', '__tests__', 'tests', 'test', 'e2e', '.github'],
      securityTestPatterns,
      ['ts', 'js', 'yml', 'yaml'],
      ignore,
    );

    // Also check root config files
    let hasSecurityInCi = false;
    const workflowDir = join(projectPath, '.github', 'workflows');
    if (existsSync(workflowDir)) {
      try {
        const files = walkFiles(workflowDir, [], ['yml', 'yaml']);
        for (const file of files) {
          const content = readFileSafe(file);
          if (content && securityTestPatterns.some((p) => p.test(content))) {
            hasSecurityInCi = true;
            break;
          }
        }
      } catch {
        // skip
      }
    }

    if (!hasSecurityTests && !hasSecurityInCi) {
      findings.push({
        id: 'PCI-009',
        scanner: 'pci-dss-checker',
        severity: 'medium',
        title: 'Req 11.3 — No security testing found',
        description:
          'No security test files or security scanning in CI/CD were found. PCI-DSS Req 11.3 requires regular penetration testing and vulnerability scanning.',
        category: 'compliance',
      });
    }

    return {
      scanner: 'pci-dss-checker',
      category: 'compliance',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
