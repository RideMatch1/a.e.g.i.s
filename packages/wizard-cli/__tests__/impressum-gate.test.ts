/**
 * D-COM-05 — Impressum field-completeness gate (commit 8).
 *
 * Tests the bash-3-compat shell script that wraps the TMG §5 / DDG
 * field-class check. The script lives at __tests__/fixtures/ as the
 * canonical reference shipped via the legal-pages-de pattern body;
 * consumers copy it into their generated scaffold's scripts/ dir.
 *
 * Three fixtures cover the gate-threshold matrix:
 *   - empty-field      → 0/7 → exit 1
 *   - fully-populated  → 7/7 → exit 0
 *   - partially (4/7)  → exit 1 with the missing-class diagnostic
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const SCRIPT_PATH = resolve(__dirname, 'fixtures', 'check-impressum-completeness.sh');

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'impressum-gate-'));
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function runGate(fixturePath: string): { stdout: string; stderr: string; exit: number } {
  try {
    const stdout = execSync(`bash ${SCRIPT_PATH} ${fixturePath}`, {
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString();
    return { stdout, stderr: '', exit: 0 };
  } catch (e) {
    const err = e as { status?: number; stdout?: Buffer; stderr?: Buffer };
    return {
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
      exit: err.status ?? -1,
    };
  }
}

describe('Impressum gate (D-COM-05, bash-3-compat shell script)', () => {
  it('FIXTURE 1 — empty-field Impressum exits 1', () => {
    const fxPath = join(tmpDir, 'empty.tsx');
    writeFileSync(
      fxPath,
      [
        'export default function Impressum() {',
        '  return (',
        '    <main>',
        '      <h1>Impressum</h1>',
        '      <h2>Angaben § 5 TMG</h2>',
        '      <p>Anbieter: ...</p>',
        '      <p>Inhalt folgt.</p>',
        '    </main>',
        '  );',
        '}',
      ].join('\n'),
    );
    const { exit, stderr } = runGate(fxPath);
    expect(exit).toBe(1);
    expect(stderr).toMatch(/Impressum incomplete — only [0-2]\/7/);
    expect(stderr).toMatch(/Abmahnung-risk/);
  });

  it('FIXTURE 2 — fully-populated GmbH Impressum (7/7) exits 0', () => {
    const fxPath = join(tmpDir, 'full.tsx');
    writeFileSync(
      fxPath,
      [
        'export default function Impressum() {',
        '  return (',
        '    <main>',
        '      <h1>Impressum</h1>',
        '      <p>AEGIS Test GmbH</p>',
        '      <p>Hauptstraße 42</p>',
        '      <p>12345 Berlin</p>',
        '      <p>E-Mail: kontakt@example.com</p>',
        '      <p>Telefon: +49 30 1234567</p>',
        '      <p>Geschäftsführer: Max Mustermann</p>',
        '      <p>Handelsregister: Amtsgericht Berlin, HRB 123456</p>',
        '      <p>USt-IdNr: DE123456789</p>',
        '    </main>',
        '  );',
        '}',
      ].join('\n'),
    );
    const { exit, stdout } = runGate(fxPath);
    expect(exit).toBe(0);
    expect(stdout).toMatch(/PASS: 7\/7/);
  });

  it('FIXTURE 3 — partial 4/7 sole-proprietor Impressum exits 1 with missing-class diagnostic', () => {
    const fxPath = join(tmpDir, 'partial.tsx');
    writeFileSync(
      fxPath,
      [
        'export default function Impressum() {',
        '  return (',
        '    <main>',
        '      <h1>Impressum</h1>',
        '      <p>Hauptstraße 42</p>',
        '      <p>12345 Berlin</p>',
        '      <p>E-Mail: kontakt@example.com</p>',
        '      <p>Inhaber: Max Mustermann</p>',
        '    </main>',
        '  );',
        '}',
      ].join('\n'),
    );
    const { exit, stderr } = runGate(fxPath);
    expect(exit).toBe(1);
    expect(stderr).toMatch(/only 4\/7/);
    expect(stderr).toMatch(/5-Handelsregister/);
  });

  it('byte-equality with shipped script (M4, audit) — embedded script in legal-pages-de.md is identical to the fixture', () => {
    // M4: the fixture + the consumer-shipped script must never drift.
    // Consumer pastes the shipped script into their scaffold. Tests
    // verify the fixture. If the two diverge, tests pass but production
    // run breaks in subtle ways (different stderr-routing, different
    // variable names). Byte-equality check catches this at CI-time.
    const fixture = readFileSync(SCRIPT_PATH, 'utf-8').trim();
    const patternPath = resolve(
      __dirname,
      '..',
      '..',
      '..',
      'docs',
      'patterns',
      'compliance',
      'legal-pages-de.md',
    );
    const patternBody = readFileSync(patternPath, 'utf-8');
    // Extract the embedded script — it lives between the ```bash and ``` fences
    // immediately following the "### Impressum field-completeness gate" heading.
    const m = patternBody.match(/### Impressum field-completeness gate[\s\S]*?```bash\n([\s\S]*?)```/);
    expect(m).not.toBeNull();
    const embedded = m![1].trim();
    expect(embedded).toBe(fixture);
  });

  it('FIXTURE 5 (M5, audit) — sole-proprietor with -weg street suffix exits 0 (regex covers non-Straße suffixes)', () => {
    // M5: the 1-Anschrift class regex previously only matched
    // straße|strasse|str\.|anschrift. A legitimate sole-proprietor
    // Impressum with "Beispielweg 42" as the address was false-negatived
    // (gate reported 1-Anschrift missing). The regex now also matches
    // 8 common German non-Straße suffixes: weg|allee|platz|ring|
    // chaussee|damm|pfad|ufer. Fixture covers 1+2+3+4+7 = 5/7 → PASS.
    const fxPath = join(tmpDir, 'beispielweg.tsx');
    writeFileSync(
      fxPath,
      [
        'export default function Impressum() {',
        '  return (',
        '    <main>',
        '      <h1>Impressum</h1>',
        '      <p>Beispielweg 42</p>',
        '      <p>10115 Berlin</p>',
        '      <p>E-Mail: kontakt@example.com</p>',
        '      <p>Inhaber: Max Mustermann</p>',
        '      <p>Telefon: +49 30 1234567</p>',
        '    </main>',
        '  );',
        '}',
      ].join('\n'),
    );
    const { exit, stdout } = runGate(fxPath);
    expect(exit).toBe(0);
    expect(stdout).toMatch(/PASS: 5\/7/);
    expect(stdout).toMatch(/1-Anschrift/);
  });

  it('FIXTURE 4 (M1, audit) — Impressum with empty-placeholder broken HTML exits 1 with empty-HTML diagnostic', () => {
    const fxPath = join(tmpDir, 'empty-html.tsx');
    writeFileSync(
      fxPath,
      [
        'export default function Impressum() {',
        '  return (',
        '    <main>',
        '      <h1>Impressum</h1>',
        '      <p>AEGIS Test GmbH</p>',
        '      <p>Hauptstraße 42</p>',
        '      <p>12345 Berlin</p>',
        '      <p>E-Mail: kontakt@example.com</p>',
        '      <p>Telefon: +49 30 1234567</p>',
        '      <p>Geschäftsführer: Max Mustermann</p>',
        '      <p>Handelsregister: Amtsgericht Berlin, HRB 123456</p>',
        '      <p>USt-IdNr: DE123456789</p>',
        '      <p>',
        '        Datenschutzbeauftragter:',
        '        E-Mail: <a href="mailto:"></a>',
        '      </p>',
        '    </main>',
        '  );',
        '}',
      ].join('\n'),
    );
    const { exit, stderr } = runGate(fxPath);
    expect(exit).toBe(1);
    expect(stderr).toMatch(/empty-placeholder|broken render/i);
    expect(stderr).toMatch(/href="mailto:"/);
  });
});
