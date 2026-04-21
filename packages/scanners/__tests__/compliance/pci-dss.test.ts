import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('@aegis-scan/core', () => {
  const { readdirSync, readFileSync, statSync } = require('fs');
  const { join } = require('path');

  function walkFilesSync(dir: string, ignore: string[], exts: string[]): string[] {
    const results: string[] = [];
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return results;
    }
    for (const entry of entries) {
      if (ignore.includes(entry)) continue;
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          results.push(...walkFilesSync(full, ignore, exts));
        } else {
          const ext = entry.split('.').pop() ?? '';
          if (exts.includes(ext)) results.push(full);
        }
      } catch {
        // skip
      }
    }
    return results;
  }

  return {
    walkFiles: (dir: string, ignore: string[], exts: string[]) =>
      walkFilesSync(dir, ignore, exts),
    readFileSafe: (path: string) => {
      try {
        return readFileSync(path, 'utf-8');
      } catch {
        return null;
      }
    },
    commandExists: async () => true,
    exec: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
    isTestFile: (filePath) => /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) || /[\/\\]__tests__[\/\\]/.test(filePath) || /[\/\\]__mocks__[\/\\]/.test(filePath) || /[\/\\](playwright|cypress|e2e)[\/\\]/.test(filePath),

  };
});

import { pciDssCheckerScanner } from '../../src/compliance/pci-dss.js';
import type { AegisConfig } from '@aegis-scan/core';

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-pci-test-'));
}

function makeConfig(extra: Record<string, unknown> = {}): AegisConfig {
  return { stack: { payment: 'none' }, ...extra } as unknown as AegisConfig;
}

function makeStripeConfig(extra: Record<string, unknown> = {}): AegisConfig {
  return { stack: { payment: 'stripe' }, ...extra } as unknown as AegisConfig;
}

function createFile(projectPath: string, relPath: string, content: string): void {
  const parts = relPath.split('/');
  const dir = parts.slice(0, -1).join('/');
  if (dir) mkdirSync(join(projectPath, dir), { recursive: true });
  writeFileSync(join(projectPath, relPath), content);
}

describe('pciDssCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await pciDssCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('has correct name and category', () => {
    expect(pciDssCheckerScanner.name).toBe('pci-dss-checker');
    expect(pciDssCheckerScanner.category).toBe('compliance');
  });

  it('returns 0 findings when no payment processing detected', async () => {
    const result = await pciDssCheckerScanner.scan(projectPath, makeConfig());
    expect(result.findings).toHaveLength(0);
    expect(result.scanner).toBe('pci-dss-checker');
    expect(result.available).toBe(true);
  });

  it('returns 0 findings when project has no package.json and no payment stack', async () => {
    const result = await pciDssCheckerScanner.scan(projectPath, makeConfig());
    expect(result.findings).toHaveLength(0);
  });

  it('detects payment processing via package.json dependencies', async () => {
    createFile(
      projectPath,
      'package.json',
      JSON.stringify({
        dependencies: { stripe: '^12.0.0' },
      }),
    );

    const result = await pciDssCheckerScanner.scan(projectPath, makeConfig());
    // Should have findings because it detected payment processing
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('detects payment processing via stack config', async () => {
    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('all finding IDs have PCI- prefix', async () => {
    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    for (const finding of result.findings) {
      expect(finding.id).toMatch(/^PCI-\d{3}$/);
    }
  });

  it('all findings have compliance category', async () => {
    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    for (const finding of result.findings) {
      expect(finding.category).toBe('compliance');
    }
  });

  it('result includes duration', async () => {
    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    expect(typeof result.duration).toBe('number');
  });
});

describe('pciDssCheckerScanner — Req 3.4: PAN Storage', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('PCI-001: reports CRITICAL when credit card pattern found in source', async () => {
    createFile(
      projectPath,
      'src/lib/payment.ts',
      `const testCard = '5555 5555 5555 4444';`,
    );

    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-001');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
    expect(finding!.title).toContain('Req 3.4');
  });

  it('PCI-001: no finding when no card numbers in source', async () => {
    createFile(
      projectPath,
      'src/lib/payment.ts',
      `export async function charge(amount: number) { return stripe.charges.create({ amount }); }`,
    );

    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-001');
    expect(finding).toBeUndefined();
  });

  it('PCI-002: reports HIGH when raw card handling without Stripe Elements', async () => {
    createFile(
      projectPath,
      'src/lib/payment.ts',
      `export async function processPayment(cardNumber: string) {
        await stripe.charges.create({ source: cardNumber });
      }`,
    );

    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-002');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('PCI-002: no finding when Stripe Elements are used', async () => {
    createFile(
      projectPath,
      'src/components/PaymentForm.tsx',
      `import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
       export function PaymentForm() {
         const stripe = useStripe();
         const elements = useElements();
         return <CardElement />;
       }`,
    );

    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-002');
    expect(finding).toBeUndefined();
  });
});

describe('pciDssCheckerScanner — Req 6.2: Secure Development', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('PCI-003: reports MEDIUM when no input validation found', async () => {
    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-003');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('PCI-003: no finding when Zod validation exists', async () => {
    createFile(
      projectPath,
      'src/lib/schemas.ts',
      `import { z } from 'zod';
       export const paymentSchema = z.object({ amount: z.number().positive() });`,
    );

    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-003');
    expect(finding).toBeUndefined();
  });

  it('PCI-004: reports LOW when no output encoding found', async () => {
    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-004');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('low');
  });

  it('PCI-004: no finding when sanitization exists', async () => {
    createFile(
      projectPath,
      'src/lib/sanitize.ts',
      `import DOMPurify from 'dompurify';
       export function sanitize(html: string) { return DOMPurify.sanitize(html); }`,
    );

    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-004');
    expect(finding).toBeUndefined();
  });
});

describe('pciDssCheckerScanner — Req 6.4: WAF/CSP', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('PCI-005: reports MEDIUM when no CSP found', async () => {
    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-005');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('PCI-005: no finding when CSP header configured', async () => {
    createFile(
      projectPath,
      'src/middleware.ts',
      `response.headers.set('Content-Security-Policy', "default-src 'self'");`,
    );

    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-005');
    expect(finding).toBeUndefined();
  });

  it('PCI-006: reports MEDIUM when no rate limiting found', async () => {
    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-006');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('PCI-006: no finding when rate limiting exists', async () => {
    createFile(
      projectPath,
      'src/lib/rate-limit.ts',
      `export function rateLimit(req) { /* rate limiting logic */ }`,
    );

    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-006');
    expect(finding).toBeUndefined();
  });
});

describe('pciDssCheckerScanner — Req 8.3: Strong Authentication', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('PCI-007: reports HIGH when no password hashing found', async () => {
    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-007');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('PCI-007: no finding when bcrypt is used', async () => {
    createFile(
      projectPath,
      'src/lib/auth.ts',
      `import bcrypt from 'bcrypt';
       export async function hashPassword(pw: string) { return bcrypt.hash(pw, 12); }`,
    );

    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-007');
    expect(finding).toBeUndefined();
  });

  it('PCI-007: no finding when project uses Supabase Auth', async () => {
    createFile(
      projectPath,
      'src/lib/supabase.ts',
      `import { createClient } from '@supabase/supabase-js';
       export const supabase = createClient(url, key);
       export async function signIn(email: string, password: string) {
         return supabase.auth.signInWithPassword({ email, password });
       }`,
    );

    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-007');
    expect(finding).toBeUndefined();
  });

  it('PCI-008: reports CRITICAL when plaintext password comparison found', async () => {
    createFile(
      projectPath,
      'src/lib/auth.ts',
      `export function login(input: string, stored: string) {
        if (password === 'admin123') return true;
        return false;
      }`,
    );

    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-008');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
  });

  it('PCI-008: no finding when proper comparison is used', async () => {
    createFile(
      projectPath,
      'src/lib/auth.ts',
      `import bcrypt from 'bcrypt';
       export async function verify(input: string, hash: string) {
         return bcrypt.compare(input, hash);
       }`,
    );

    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-008');
    expect(finding).toBeUndefined();
  });
});

describe('pciDssCheckerScanner — Req 11.3: Penetration Testing', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('PCI-009: reports MEDIUM when no security testing found', async () => {
    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-009');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('PCI-009: no finding when security tests exist', async () => {
    createFile(
      projectPath,
      'src/security-scan.ts',
      `export function runSecurityScan() { /* OWASP checks */ }`,
    );

    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-009');
    expect(finding).toBeUndefined();
  });

  it('PCI-009: no finding when security scanning in CI/CD', async () => {
    createFile(
      projectPath,
      '.github/workflows/security.yml',
      `name: Security Scan
       on: push
       jobs:
         security:
           steps:
             - name: OWASP ZAP Scan
               uses: zaproxy/action-full-scan@v0.4.0`,
    );

    const result = await pciDssCheckerScanner.scan(projectPath, makeStripeConfig());
    const finding = result.findings.find((f) => f.id === 'PCI-009');
    expect(finding).toBeUndefined();
  });
});

describe('pciDssCheckerScanner — payment provider detection', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('detects braintree in package.json', async () => {
    createFile(
      projectPath,
      'package.json',
      JSON.stringify({ dependencies: { braintree: '^3.0.0' } }),
    );

    const result = await pciDssCheckerScanner.scan(projectPath, makeConfig());
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('detects @paypal/react-paypal-js in package.json', async () => {
    createFile(
      projectPath,
      'package.json',
      JSON.stringify({ dependencies: { '@paypal/react-paypal-js': '^7.0.0' } }),
    );

    const result = await pciDssCheckerScanner.scan(projectPath, makeConfig());
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('detects @stripe/stripe-js in devDependencies', async () => {
    createFile(
      projectPath,
      'package.json',
      JSON.stringify({ devDependencies: { '@stripe/stripe-js': '^1.0.0' } }),
    );

    const result = await pciDssCheckerScanner.scan(projectPath, makeConfig());
    expect(result.findings.length).toBeGreaterThan(0);
  });
});
