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
          if (exts.length === 0 || exts.includes(ext)) results.push(full);
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
    isTestFile: (filePath: string) =>
      /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) ||
      /[\/\\]__tests__[\/\\]/.test(filePath),
  };
});

import { supabaseMigrationCheckerScanner } from '../../src/quality/supabase-migration-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-sbm-test-'));
}

function createMigration(projectPath: string, name: string, content: string): string {
  const dir = join(projectPath, 'supabase', 'migrations');
  mkdirSync(dir, { recursive: true });
  const fullPath = join(dir, name);
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('supabaseMigrationCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await supabaseMigrationCheckerScanner.isAvailable('')).toBe(true);
  });

  it('returns no findings for empty project', async () => {
    const result = await supabaseMigrationCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('supabase-migration-checker');
    expect(result.findings).toHaveLength(0);
  });

  // ─── SBM-001 ────────────────────────────────────────────────────────────
  describe('SBM-001 — definer + p_user_id without auth.uid() guard', () => {
    it('flags Hundementor-shape vulnerable RPC', async () => {
      createMigration(projectPath, '20250112_arena.sql', `
CREATE OR REPLACE FUNCTION public.purchase_arena_item(
  p_user_id uuid,
  p_item_key character varying
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_item RECORD;
BEGIN
  UPDATE public.profiles SET forum_points = forum_points - 100 WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true);
END;
$$;
`);
      const result = await supabaseMigrationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      const sbm001 = result.findings.filter((f) => f.id.startsWith('SBM-001'));
      expect(sbm001.length).toBe(1);
      expect(sbm001[0].severity).toBe('critical');
      expect(sbm001[0].cwe).toBe(863);
      expect(sbm001[0].title).toMatch(/p_user_id parameter lacks auth.uid\(\) guard/);
    });

    it('does NOT flag function with _aegis_authorize_user call', async () => {
      createMigration(projectPath, '20260429_fixed.sql', `
CREATE OR REPLACE FUNCTION public.purchase_arena_item(
  p_user_id uuid, p_item_key character varying
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public._aegis_authorize_user(p_user_id);
  -- ... rest
END;
$$;
`);
      const result = await supabaseMigrationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      const sbm001 = result.findings.filter((f) => f.id.startsWith('SBM-001'));
      expect(sbm001).toHaveLength(0);
    });

    it('does NOT flag function with explicit auth.uid() check', async () => {
      createMigration(projectPath, '20250101_self_guarded.sql', `
CREATE FUNCTION public.fn(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
END;
$$;
`);
      const result = await supabaseMigrationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      const sbm001 = result.findings.filter((f) => f.id.startsWith('SBM-001'));
      expect(sbm001).toHaveLength(0);
    });

    it('does NOT flag SECURITY INVOKER function (RLS handles authz)', async () => {
      createMigration(projectPath, '20250101_invoker.sql', `
CREATE FUNCTION public.fn(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public AS $$
BEGIN
  UPDATE profiles SET x = 1 WHERE id = p_user_id;
END;
$$;
`);
      const result = await supabaseMigrationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      const sbm001 = result.findings.filter((f) => f.id.startsWith('SBM-001'));
      expect(sbm001).toHaveLength(0);
    });
  });

  // ─── SBM-002 ────────────────────────────────────────────────────────────
  describe('SBM-002 — definer + resource-id without ownership check', () => {
    it('flags p_dog_id reader without ownership check', async () => {
      createMigration(projectPath, '20250101_doc_reader.sql', `
CREATE FUNCTION public.get_dog_documents(p_dog_id uuid)
RETURNS SETOF dog_documents LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.dog_documents WHERE dog_id = p_dog_id;
END;
$$;
`);
      const result = await supabaseMigrationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      const sbm002 = result.findings.filter((f) => f.id.startsWith('SBM-002'));
      expect(sbm002.length).toBeGreaterThanOrEqual(1);
      expect(sbm002[0].cwe).toBe(639);
    });

    it('does NOT fire when ownership check is present', async () => {
      createMigration(projectPath, '20250101_ownership.sql', `
CREATE FUNCTION public.get_dog_documents(p_dog_id uuid)
RETURNS SETOF dog_documents LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dogs WHERE id = p_dog_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT * FROM public.dog_documents WHERE dog_id = p_dog_id;
END;
$$;
`);
      const result = await supabaseMigrationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      const sbm002 = result.findings.filter((f) => f.id.startsWith('SBM-002'));
      expect(sbm002).toHaveLength(0);
    });
  });

  // ─── SBM-003 ────────────────────────────────────────────────────────────
  describe('SBM-003 — definer without SET search_path', () => {
    it('flags missing search_path', async () => {
      createMigration(projectPath, '20250101_no_search.sql', `
CREATE FUNCTION public.fn(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public._aegis_authorize_user(p_user_id);
END;
$$;
`);
      const result = await supabaseMigrationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      const sbm003 = result.findings.filter((f) => f.id.startsWith('SBM-003'));
      expect(sbm003.length).toBe(1);
      expect(sbm003[0].cwe).toBe(426);
    });
  });

  // ─── SBM-004 ────────────────────────────────────────────────────────────
  describe('SBM-004 — definer with dynamic SQL using parameter', () => {
    it('flags restore_deleted-shape (table-name parameter in EXECUTE format())', async () => {
      createMigration(projectPath, '20250101_restore.sql', `
CREATE FUNCTION public.restore_deleted(p_table_name text, p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_sql TEXT;
BEGIN
  v_sql := format('UPDATE %I SET deleted_at = NULL WHERE id = %L', p_table_name, p_id);
  EXECUTE v_sql;
  RETURN true;
END;
$$;
`);
      const result = await supabaseMigrationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      const sbm004 = result.findings.filter((f) => f.id.startsWith('SBM-004'));
      expect(sbm004.length).toBe(1);
      expect(sbm004[0].severity).toBe('critical');
      expect(sbm004[0].cwe).toBe(89);
    });
  });

  // ─── SBM-005 ────────────────────────────────────────────────────────────
  describe('SBM-005 — RLS WITH CHECK (true) for non-SELECT', () => {
    it('flags anon INSERT with WITH CHECK (true)', async () => {
      createMigration(projectPath, '20250101_newsletter.sql', `
CREATE TABLE public.newsletter_subscribers (id uuid PRIMARY KEY, email text);
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can subscribe"
  ON public.newsletter_subscribers
  FOR INSERT TO anon
  WITH CHECK (true);
`);
      const result = await supabaseMigrationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      const sbm005 = result.findings.filter((f) => f.id.startsWith('SBM-005'));
      expect(sbm005.length).toBe(1);
      expect(sbm005[0].cwe).toBe(285);
    });

    it('does NOT flag SELECT policy with USING (true) — public-read pattern', async () => {
      createMigration(projectPath, '20250101_public_read.sql', `
CREATE POLICY "public read"
  ON public.posts FOR SELECT TO anon
  USING (true);
`);
      const result = await supabaseMigrationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      const sbm005 = result.findings.filter((f) => f.id.startsWith('SBM-005'));
      expect(sbm005).toHaveLength(0);
    });
  });

  // ─── Path filtering ─────────────────────────────────────────────────────
  describe('migration-path filtering', () => {
    it('does NOT scan SQL files outside known migration paths', async () => {
      const dir = join(projectPath, 'docs');
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'example.sql'),
        `CREATE FUNCTION public.fn(p_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN UPDATE x WHERE id = p_user_id; END; $$;`,
      );
      const result = await supabaseMigrationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      expect(result.findings).toHaveLength(0);
    });

    it('scans files under db/migrations/ as well', async () => {
      const dir = join(projectPath, 'db', 'migrations');
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'm1.sql'),
        `CREATE FUNCTION public.fn(p_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN UPDATE x WHERE id = p_user_id; END; $$;`,
      );
      const result = await supabaseMigrationCheckerScanner.scan(projectPath, MOCK_CONFIG);
      expect(result.findings.some((f) => f.id.startsWith('SBM-001'))).toBe(true);
    });
  });

  // ─── Smoke: Hundementor-shape multi-vuln file ───────────────────────────
  describe('integration — Hundementor-shape multi-rule file', () => {
    it('flags all distinct vulnerabilities in a single migration', async () => {
      createMigration(projectPath, '20250112_full.sql', `
-- multiple vulns in one file
CREATE FUNCTION public.purchase_arena_item(p_user_id uuid, p_item_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles SET forum_points = forum_points - 100 WHERE id = p_user_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE FUNCTION public.restore_deleted(p_table_name text, p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  EXECUTE format('UPDATE %I SET deleted_at = NULL WHERE id = %L', p_table_name, p_id);
END;
$$;

CREATE POLICY "open insert" ON public.t FOR INSERT TO authenticated WITH CHECK (true);
`);
      const result = await supabaseMigrationCheckerScanner.scan(projectPath, MOCK_CONFIG);

      // purchase_arena_item: SBM-001 (no guard) + SBM-003 (no search_path)
      // restore_deleted: SBM-004 (dynamic SQL) + SBM-003 (no search_path)
      // policy: SBM-005
      const ids = new Set(result.findings.map((f) => f.id.split('-').slice(0, 2).join('-')));
      expect(ids.has('SBM-001')).toBe(true);
      expect(ids.has('SBM-003')).toBe(true);
      expect(ids.has('SBM-004')).toBe(true);
      expect(ids.has('SBM-005')).toBe(true);
    });
  });
});
