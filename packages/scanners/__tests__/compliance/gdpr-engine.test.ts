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

import { gdprEngineScanner } from '../../src/compliance/gdpr-engine.js';
import type { AegisConfig } from '@aegis-scan/core';

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-gdpr-test-'));
}

function makeGdprConfig(extra: Record<string, unknown> = {}): AegisConfig {
  return { locale: 'de', ...extra } as unknown as AegisConfig;
}

function createFile(projectPath: string, relPath: string, content: string): void {
  const parts = relPath.split('/');
  const dir = parts.slice(0, -1).join('/');
  if (dir) mkdirSync(join(projectPath, dir), { recursive: true });
  writeFileSync(join(projectPath, relPath), content);
}

describe('gdprEngineScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await gdprEngineScanner.isAvailable()).toBe(true);
  });

  it('skips scan entirely when locale is not de and compliance does not include gdpr', async () => {
    const config = { locale: 'en' } as unknown as AegisConfig;
    const result = await gdprEngineScanner.scan(projectPath, config);
    expect(result.findings).toHaveLength(0);
  });

  it('runs scan when locale is de', async () => {
    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    // Empty project should have multiple findings
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('runs scan when compliance includes gdpr', async () => {
    const config = { compliance: ['gdpr'] } as unknown as AegisConfig;
    const result = await gdprEngineScanner.scan(projectPath, config);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('GDPR-001: reports CRITICAL when no datenschutz page exists', async () => {
    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-001');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
  });

  it('GDPR-001: no finding when datenschutz page exists', async () => {
    createFile(projectPath, 'app/datenschutz/page.tsx', 'export default function Privacy() {}');

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-001');
    expect(finding).toBeUndefined();
  });

  it('GDPR-001: no finding when privacy-policy page exists', async () => {
    createFile(
      projectPath,
      'app/privacy-policy/page.tsx',
      'export default function Privacy() {}',
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-001');
    expect(finding).toBeUndefined();
  });

  it('GDPR-002: reports CRITICAL when no impressum page exists', async () => {
    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-002');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
  });

  it('GDPR-002: no finding when impressum page exists', async () => {
    createFile(projectPath, 'app/impressum/page.tsx', 'export default function Imprint() {}');

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-002');
    expect(finding).toBeUndefined();
  });

  it('GDPR-006: reports HIGH when profiles migration has email column', async () => {
    mkdirSync(join(projectPath, 'supabase', 'migrations'), { recursive: true });
    writeFileSync(
      join(projectPath, 'supabase', 'migrations', '001_create_profiles.sql'),
      `CREATE TABLE public.profiles (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL,
        tenant_id UUID NOT NULL
      );`,
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-006');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('GDPR-006: no finding when profiles table has no PII', async () => {
    mkdirSync(join(projectPath, 'supabase', 'migrations'), { recursive: true });
    writeFileSync(
      join(projectPath, 'supabase', 'migrations', '001_create_profiles.sql'),
      `CREATE TABLE public.profiles (
        id UUID PRIMARY KEY,
        display_name TEXT,
        tenant_id UUID NOT NULL,
        role TEXT DEFAULT 'guest'
      );`,
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-006');
    expect(finding).toBeUndefined();
  });

  it('GDPR-010: reports HIGH when no consent table in migrations', async () => {
    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-010');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('GDPR-010: no finding when consent_log table exists in migrations', async () => {
    mkdirSync(join(projectPath, 'supabase', 'migrations'), { recursive: true });
    writeFileSync(
      join(projectPath, 'supabase', 'migrations', '010_consent_log.sql'),
      `CREATE TABLE public.consent_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users,
        consent_type TEXT NOT NULL,
        consented_at TIMESTAMPTZ DEFAULT NOW()
      );`,
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-010');
    expect(finding).toBeUndefined();
  });

  it('assigns correct category to all findings', async () => {
    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    for (const finding of result.findings) {
      expect(finding.category).toBe('compliance');
    }
  });

  it('result includes duration and available fields', async () => {
    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });

  it('all finding IDs are GDPR-0xx format', async () => {
    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    for (const finding of result.findings) {
      expect(finding.id).toMatch(/^GDPR-\d{3}$/);
    }
  });
});

describe('gdprEngineScanner — EU locale support', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('runs scan when locale is fr (French)', async () => {
    const config = { locale: 'fr' } as unknown as AegisConfig;
    const result = await gdprEngineScanner.scan(projectPath, config);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('runs scan when locale is it (Italian)', async () => {
    const config = { locale: 'it' } as unknown as AegisConfig;
    const result = await gdprEngineScanner.scan(projectPath, config);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('runs scan when locale is es (Spanish)', async () => {
    const config = { locale: 'es' } as unknown as AegisConfig;
    const result = await gdprEngineScanner.scan(projectPath, config);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('runs scan when locale is nl (Dutch)', async () => {
    const config = { locale: 'nl' } as unknown as AegisConfig;
    const result = await gdprEngineScanner.scan(projectPath, config);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('runs scan when locale is pl-PL (Polish with region code)', async () => {
    const config = { locale: 'pl-PL' } as unknown as AegisConfig;
    const result = await gdprEngineScanner.scan(projectPath, config);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('runs scan when locale is sv (Swedish)', async () => {
    const config = { locale: 'sv' } as unknown as AegisConfig;
    const result = await gdprEngineScanner.scan(projectPath, config);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('skips scan when locale is en (UK left EU)', async () => {
    const config = { locale: 'en' } as unknown as AegisConfig;
    const result = await gdprEngineScanner.scan(projectPath, config);
    expect(result.findings).toHaveLength(0);
  });

  it('skips scan when locale is ja (Japanese, not EU)', async () => {
    const config = { locale: 'ja' } as unknown as AegisConfig;
    const result = await gdprEngineScanner.scan(projectPath, config);
    expect(result.findings).toHaveLength(0);
  });
});

describe('gdprEngineScanner — new checks', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('GDPR-011: reports MEDIUM when no rate-limiting is found', async () => {
    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-011');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
    expect(finding!.title).toContain('rate-limit');
  });

  it('GDPR-011: no finding when rate-limiting code exists', async () => {
    createFile(
      projectPath,
      'lib/rate-limit.ts',
      `
      export function checkIPRateLimit(ip: string) {
        // rate limiting logic
      }
    `,
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-011');
    expect(finding).toBeUndefined();
  });

  it('GDPR-012: reports MEDIUM when no access logging/audit trail is found', async () => {
    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-012');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('GDPR-012: no finding when audit_log API exists', async () => {
    createFile(
      projectPath,
      'lib/audit.ts',
      `
      export function logAccess(userId: string, resource: string) {
        // audit_log implementation
      }
    `,
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-012');
    expect(finding).toBeUndefined();
  });
});

describe('gdprEngineScanner — German IT-law checks (GDPR-013 to GDPR-018)', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  // GDPR-013: Google Fonts CDN
  it('GDPR-013: flags Google Fonts CDN in tsx file', async () => {
    createFile(
      projectPath,
      'src/app/layout.tsx',
      `import '@fontsource/inter';
      <link href="https://fonts.googleapis.com/css2?family=Roboto" rel="stylesheet" />`,
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-013');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical'); // DACH locale
    expect(finding!.file).toContain('layout.tsx');
  });

  it('GDPR-013: flags fonts.gstatic.com', async () => {
    createFile(
      projectPath,
      'src/styles/global.css',
      `@font-face { src: url('https://fonts.gstatic.com/s/roboto/v30/font.woff2'); }`,
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-013');
    expect(finding).toBeDefined();
  });

  it('GDPR-013: no finding when fonts are self-hosted', async () => {
    createFile(
      projectPath,
      'src/app/layout.tsx',
      `import '@fontsource/inter'; // self-hosted`,
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-013');
    expect(finding).toBeUndefined();
  });

  it('GDPR-013: severity is HIGH for non-DACH EU locale', async () => {
    createFile(
      projectPath,
      'src/app/layout.tsx',
      `<link href="https://fonts.googleapis.com/css2?family=Roboto" />`,
    );

    const config = { locale: 'fr' } as unknown as AegisConfig;
    const result = await gdprEngineScanner.scan(projectPath, config);
    const finding = result.findings.find((f) => f.id === 'GDPR-013');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high'); // non-DACH
  });

  // GDPR-014: External CDN IP Transfer
  it('GDPR-014: flags CDN references', async () => {
    createFile(
      projectPath,
      'src/app/page.tsx',
      `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`,
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-014');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high'); // DACH
  });

  it('GDPR-014: no finding without CDN references', async () => {
    createFile(
      projectPath,
      'src/app/page.tsx',
      `import Chart from 'chart.js'; // local install`,
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-014');
    expect(finding).toBeUndefined();
  });

  // GDPR-015: Cookie Consent Quality
  it('GDPR-015: flags cookie banner without reject option', async () => {
    createFile(
      projectPath,
      'src/components/CookieConsent.tsx',
      `export function CookieConsent() {
        return <div className="cookie-consent"><button>Accept All</button></div>;
      }`,
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-015');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high'); // DACH
  });

  it('GDPR-015: no finding when reject option present', async () => {
    createFile(
      projectPath,
      'src/components/CookieConsent.tsx',
      `export function CookieConsent() {
        return <div className="cookie-consent">
          <button>Accept</button>
          <button>Reject</button>
        </div>;
      }`,
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-015');
    expect(finding).toBeUndefined();
  });

  it('GDPR-015: no finding when ablehnen option present', async () => {
    createFile(
      projectPath,
      'src/components/CookieBanner.tsx',
      `export function CookieBanner() {
        return <div className="cookieBanner">
          <button>Akzeptieren</button>
          <button>Ablehnen</button>
        </div>;
      }`,
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-015');
    expect(finding).toBeUndefined();
  });

  // GDPR-016: Newsletter Double-Opt-In
  it('GDPR-016: flags newsletter without double-opt-in', async () => {
    createFile(
      projectPath,
      'src/app/api/newsletter/route.ts',
      `export async function POST(req) {
        const { email } = await req.json();
        await db.newsletter.insert({ email });
        return Response.json({ ok: true });
      }`,
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-016');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high'); // DACH
  });

  it('GDPR-016: no finding when double-opt-in present', async () => {
    createFile(
      projectPath,
      'src/app/api/newsletter/route.ts',
      `export async function POST(req) {
        const { email } = await req.json();
        const verificationToken = crypto.randomUUID();
        await db.newsletter.insert({ email, confirmed: false, verificationToken });
        await sendConfirmationEmail(email, verificationToken);
        return Response.json({ ok: true });
      }`,
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-016');
    expect(finding).toBeUndefined();
  });

  // GDPR-017: YouTube Embed
  it('GDPR-017: flags youtube.com/embed without nocookie', async () => {
    createFile(
      projectPath,
      'src/components/VideoPlayer.tsx',
      `export function VideoPlayer({ id }: { id: string }) {
        return <iframe src={\`https://youtube.com/embed/\${id}\`} />;
      }`,
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-017');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high'); // DACH
  });

  it('GDPR-017: no finding when youtube-nocookie.com used', async () => {
    createFile(
      projectPath,
      'src/components/VideoPlayer.tsx',
      `export function VideoPlayer({ id }: { id: string }) {
        return <iframe src={\`https://youtube-nocookie.com/embed/\${id}\`} />;
      }`,
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const finding = result.findings.find((f) => f.id === 'GDPR-017');
    expect(finding).toBeUndefined();
  });

  // GDPR-018: Impressum Completeness
  it('GDPR-018: flags missing fields in impressum', async () => {
    createFile(
      projectPath,
      'src/app/impressum/page.tsx',
      `export default function Impressum() {
        return <div>
          <h1>Impressum</h1>
          <p>Some Company GmbH</p>
          <p>Musterstraße 1, 12345 Berlin</p>
        </div>;
      }`,
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const impressumFindings = result.findings.filter((f) => f.id === 'GDPR-018');
    // Should flag missing: email, phone, Handelsregister, USt-IdNr
    expect(impressumFindings.length).toBeGreaterThanOrEqual(3);
    expect(impressumFindings[0].severity).toBe('medium'); // DACH
  });

  it('GDPR-018: no findings for complete impressum', async () => {
    createFile(
      projectPath,
      'src/app/impressum/page.tsx',
      `export default function Impressum() {
        return <div>
          <h1>Impressum</h1>
          <p>Example Corp GmbH</p>
          <p>Musterstraße 42, 80331 München</p>
          <p>E-Mail: info@example.de</p>
          <p>Telefon: +49 89 12345678</p>
          <p>Handelsregister: Amtsgericht München, HRB 123456</p>
          <p>USt-IdNr: DE123456789</p>
        </div>;
      }`,
    );

    const result = await gdprEngineScanner.scan(projectPath, makeGdprConfig());
    const impressumFindings = result.findings.filter((f) => f.id === 'GDPR-018');
    expect(impressumFindings).toHaveLength(0);
  });

  // Universal checks — should run even for non-EU locales
  it('GDPR-013: runs for non-EU locale (en)', async () => {
    createFile(
      projectPath,
      'src/app/layout.tsx',
      `<link href="https://fonts.googleapis.com/css2?family=Roboto" />`,
    );

    const config = { locale: 'en' } as unknown as AegisConfig;
    const result = await gdprEngineScanner.scan(projectPath, config);
    const finding = result.findings.find((f) => f.id === 'GDPR-013');
    // Universal checks run for ALL projects
    expect(finding).toBeDefined();
    // But severity is lower for non-DACH
    expect(finding!.severity).toBe('high');
  });

  it('GDPR-014: runs for non-EU locale', async () => {
    createFile(
      projectPath,
      'src/app/page.tsx',
      `<script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js"></script>`,
    );

    const config = { locale: 'ja' } as unknown as AegisConfig;
    const result = await gdprEngineScanner.scan(projectPath, config);
    const finding = result.findings.find((f) => f.id === 'GDPR-014');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium'); // non-DACH
  });
});
