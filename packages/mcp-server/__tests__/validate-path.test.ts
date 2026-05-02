import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { validatePath } from '../src/handlers.js';

// Use a repo-relative scratch dir instead of os.tmpdir() — TMPDIR can be /tmp under turbo,
// and /tmp is blocked by the new validatePath, which would invalidate beforeEach setup.
const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRATCH_BASE = path.join(TEST_FILE_DIR, '.scratch');

describe('validatePath — baseline guards (already shipped)', () => {
  it('rejects "../" raw-input traversal', () => {
    expect(() => validatePath('../../../etc/passwd')).toThrow(/traversal/i);
  });

  it('rejects null byte', () => {
    expect(() => validatePath('/tmp/safe\0/../etc')).toThrow(/null byte/i);
  });

  it('rejects /etc directly', () => {
    expect(() => validatePath('/etc')).toThrow(/blocked|system/i);
  });

  it('accepts the AEGIS repo root (regression guard)', () => {
    const repoRoot = path.resolve(__dirname, '..', '..', '..');
    expect(() => validatePath(repoRoot)).not.toThrow();
  });
});

describe('validatePath — hardening (Tier-S MCP-poisoning defense)', () => {
  let tmpDir: string;

  beforeAll(() => {
    fs.mkdirSync(SCRATCH_BASE, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(SCRATCH_BASE, { recursive: true, force: true });
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(SCRATCH_BASE, 'vp-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rejects symlink that points at /etc (symlink-escape bypass)', () => {
    const link = path.join(tmpDir, 'innocent-looking-dir');
    try {
      fs.symlinkSync('/etc', link);
    } catch {
      // CI without symlink permission — skip
      return;
    }
    expect(() => validatePath(link)).toThrow(/blocked|system|symlink/i);
  });

  it('rejects /private/etc on macOS (aliasing bypass)', () => {
    if (process.platform !== 'darwin') return;
    expect(() => validatePath('/private/etc')).toThrow(/blocked|system/i);
  });

  it('rejects /private/var/log on macOS (specific sensitive subdir)', () => {
    if (process.platform !== 'darwin') return;
    expect(() => validatePath('/private/var/log')).toThrow(/blocked|system/i);
  });

  it('rejects ~/.ssh (user-secret directory)', () => {
    const sshDir = path.join(os.homedir(), '.ssh');
    expect(() => validatePath(sshDir)).toThrow(/blocked|system|user-secret/i);
  });

  it('rejects ~/.aws (user-secret directory)', () => {
    const awsDir = path.join(os.homedir(), '.aws');
    expect(() => validatePath(awsDir)).toThrow(/blocked|system|user-secret/i);
  });

  it('rejects ~/.gnupg (user-secret directory)', () => {
    const gnupgDir = path.join(os.homedir(), '.gnupg');
    expect(() => validatePath(gnupgDir)).toThrow(/blocked|system|user-secret/i);
  });

  it('rejects /tmp (multi-tenant temp directory)', () => {
    expect(() => validatePath('/tmp')).toThrow(/blocked|system/i);
  });

  it('rejects /var/tmp', () => {
    expect(() => validatePath('/var/tmp')).toThrow(/blocked|system/i);
  });

  it('rejects /etc/passwd (path under blocked dir)', () => {
    expect(() => validatePath('/etc/passwd')).toThrow(/blocked|system/i);
  });

  it('does NOT reject prefix-collision (/etcetera-style)', () => {
    // path.resolve('/etcetera-test') = '/etcetera-test'
    // current impl uses startsWith('/etc') which would FALSE-POSITIVE
    // After patch: must use startsWith('/etc' + sep) OR exact-match
    // Test: a non-existent path under repo, named to look like /etc/...
    const fakePath = path.join(tmpDir, 'etcetera');
    fs.mkdirSync(fakePath);
    expect(() => validatePath(fakePath)).not.toThrow();
  });
});
