import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadTemplate } from '../../src/template/loader.js';

function createFixtureTemplate(): string {
  const root = mkdtempSync(join(tmpdir(), 'aegis-tpl-'));
  mkdirSync(join(root, 'files'), { recursive: true });
  writeFileSync(join(root, 'template.json'), JSON.stringify({
    name: 'test-tpl', stack: 'test-stack', aegisVersion: '0.12.0',
    description: 'fixture', placeholders: ['PROJECT_NAME'],
    postInstall: { scan: true, scanExpectedScore: 1000, scanExpectedGrade: 'A' },
  }));
  mkdirSync(join(root, 'files', 'lib'), { recursive: true });
  writeFileSync(join(root, 'files', 'package.json.tpl'), '{"name": "{{PROJECT_NAME}}"}');
  writeFileSync(join(root, 'files', 'lib', 'a.ts'), 'export const a = 1;');
  return root;
}

describe('loadTemplate', () => {
  it('loads the manifest and enumerates files (relative paths, sorted)', async () => {
    const root = createFixtureTemplate();
    const tpl = await loadTemplate(root);
    expect(tpl.manifest.name).toBe('test-tpl');
    expect(tpl.files).toEqual([
      'lib/a.ts',
      'package.json.tpl',
    ]);
  });

  it('throws a descriptive error when template.json is missing', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'aegis-tpl-empty-'));
    mkdirSync(join(empty, 'files'));
    await expect(loadTemplate(empty)).rejects.toThrow(/template\.json/);
  });

  it('throws when files/ directory is missing', async () => {
    const noFiles = mkdtempSync(join(tmpdir(), 'aegis-tpl-nofiles-'));
    writeFileSync(join(noFiles, 'template.json'), '{}');
    await expect(loadTemplate(noFiles)).rejects.toThrow();
  });

  it('rejects a manifest that fails Zod-strict validation', async () => {
    const bad = mkdtempSync(join(tmpdir(), 'aegis-tpl-bad-'));
    mkdirSync(join(bad, 'files'));
    writeFileSync(join(bad, 'template.json'), JSON.stringify({ name: 'only-name' }));
    await expect(loadTemplate(bad)).rejects.toThrow();
  });
});
