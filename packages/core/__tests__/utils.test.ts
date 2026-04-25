import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { getChangedFiles } from '../src/utils.js';

/**
 * AUDIT-AEGIS-SCAN-V0165 §1 C1 — CWE-78 OS command injection in
 * getChangedFiles via --diff <ref>. Auditor empirically reproduced via
 * shell-metachar payload AND attacker-controlled-branch-name (git
 * permits & in refnames; the shell parses it as command-separator).
 *
 * SC-1 fix: argv-style execFile + isValidGitRef strict pre-filter.
 * These tests assert both the pre-filter rejection AND the absence of
 * shell side-effects across the metachar classes the auditor used.
 */
describe('getChangedFiles — CMDi regression-guards (C1, AUDIT-AEGIS-SCAN-V0165 §1)', () => {
  const PROOF_FILE = '/tmp/AEGIS_CMDI_TEST_SHOULD_NOT_EXIST';

  function mkRepo(prefix: string): string {
    const tmp = mkdtempSync(join(tmpdir(), prefix));
    spawnSync('git', ['init', '-q'], { cwd: tmp });
    writeFileSync(join(tmp, 'a.ts'), 'a');
    spawnSync('git', ['add', '.'], { cwd: tmp });
    spawnSync(
      'git',
      ['-c', 'user.email=a@a.a', '-c', 'user.name=a', 'commit', '-q', '-m', 'i'],
      { cwd: tmp },
    );
    return tmp;
  }

  it.each([
    ['semicolon', `main; touch ${PROOF_FILE} #`],
    ['ampersand', `main&touch ${PROOF_FILE}_AMP`],
    ['backtick', `main\`touch ${PROOF_FILE}_BACKTICK\``],
    ['subshell', `main$(touch ${PROOF_FILE}_SUBSHELL)`],
    ['pipe', `main|touch ${PROOF_FILE}_PIPE`],
    ['redirect', `main>${PROOF_FILE}_REDIRECT`],
  ])('rejects shell-metachar in ref (%s)', async (_name, payload) => {
    const tmp = mkRepo(`aegis-cmdi-${_name}-`);
    try {
      // Pre-condition: proof file class must NOT exist
      for (const suffix of ['', '_AMP', '_BACKTICK', '_SUBSHELL', '_PIPE', '_REDIRECT']) {
        rmSync(`${PROOF_FILE}${suffix}`, { force: true });
      }

      // Attack: getChangedFiles with shell-metachar payload
      await expect(getChangedFiles(tmp, payload)).rejects.toThrow(/Invalid git ref/);

      // Post-condition: NO proof file may exist (no shell ran)
      for (const suffix of ['', '_AMP', '_BACKTICK', '_SUBSHELL', '_PIPE', '_REDIRECT']) {
        expect(existsSync(`${PROOF_FILE}${suffix}`)).toBe(false);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it.each([
    ['leading-dash', '-rf'],
    ['double-dot', 'main..HEAD'],
    ['empty', ''],
    ['whitespace', 'main HEAD'],
  ])('rejects git-invalid ref shape (%s)', async (_name, payload) => {
    const tmp = mkRepo(`aegis-shape-${_name}-`);
    try {
      await expect(getChangedFiles(tmp, payload)).rejects.toThrow(/Invalid git ref/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('accepts a valid HEAD ref and returns an array', async () => {
    const tmp = mkRepo('aegis-cmdi-valid-');
    try {
      const files = await getChangedFiles(tmp, 'HEAD');
      expect(Array.isArray(files)).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('accepts realistic ref forms (branch, tag, sha, refs/path)', async () => {
    // Sanity-check the regex accepts common real-world refs without
    // actually invoking git on a repo that has them; we only need to
    // confirm the pre-filter doesn't reject legitimate shapes.
    const tmp = mkRepo('aegis-shape-pos-');
    try {
      // Valid shapes that should pass isValidGitRef even if git later
      // doesn't resolve them in this throwaway repo.
      const validShapes = [
        'HEAD',
        'main',
        'origin/main',
        'feat/branch-name',
        'v0.16.5',
        'refs/tags/v0.16.5',
        'HEAD~1',
        'HEAD^',
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0', // 40-hex sha
      ];
      for (const ref of validShapes) {
        // We expect getChangedFiles to either succeed (HEAD case) or
        // throw "git diff failed" (other shapes that don't resolve in
        // the throwaway repo) — but NEVER throw "Invalid git ref".
        try {
          await getChangedFiles(tmp, ref);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          expect(msg).not.toMatch(/Invalid git ref/);
        }
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
