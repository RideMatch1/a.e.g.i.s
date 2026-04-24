import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const PATTERN_PATH = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'docs',
  'patterns',
  'foundation',
  'auth-supabase-full.md',
);

describe('H1 — auth-supabase-full does NOT recommend shadcn add form', () => {
  const body = readFileSync(PATTERN_PATH, 'utf-8');

  it('install command does not include form', () => {
    const installLine = body.match(/npx shadcn@latest add[^\n]+/);
    expect(installLine).not.toBeNull();
    expect(installLine![0]).not.toMatch(/\bform\b/);
  });

  it('install command keeps button input label card alert', () => {
    const installLine = body.match(/npx shadcn@latest add[^\n]+/);
    expect(installLine![0]).toMatch(/\bbutton\b/);
    expect(installLine![0]).toMatch(/\binput\b/);
    expect(installLine![0]).toMatch(/\blabel\b/);
    expect(installLine![0]).toMatch(/\bcard\b/);
    expect(installLine![0]).toMatch(/\balert\b/);
  });
});
