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

import { uploadValidatorScanner } from '../../src/quality/upload-validator.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-upload-test-'));
}

function createApiRoute(projectPath: string, subPath: string, content: string): void {
  const routeDir = join(projectPath, 'src', 'app', 'api', subPath);
  mkdirSync(routeDir, { recursive: true });
  writeFileSync(join(routeDir, 'route.ts'), content);
}

function createLibFile(projectPath: string, subPath: string, content: string): void {
  const fileDir = join(projectPath, 'src', 'lib', subPath.split('/').slice(0, -1).join('/'));
  mkdirSync(fileDir, { recursive: true });
  writeFileSync(join(projectPath, 'src', 'lib', subPath), content);
}

describe('uploadValidatorScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await uploadValidatorScanner.isAvailable(projectPath)).toBe(true);
  });

  it('returns no findings for a project with no api or lib directory', async () => {
    const result = await uploadValidatorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('upload-validator');
    expect(result.findings).toHaveLength(0);
  });

  it('returns no findings for routes without any upload patterns', async () => {
    createApiRoute(
      projectPath,
      'bookings',
      `
      export async function GET() {
        return Response.json({ bookings: [] });
      }
    `,
    );

    const result = await uploadValidatorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('flags request.formData() without magic-byte validation as HIGH', async () => {
    createApiRoute(
      projectPath,
      'upload/avatar',
      `
      export async function POST(request: Request) {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile('/uploads/' + file.name, buffer);
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await uploadValidatorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.scanner === 'upload-validator');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
    expect(finding!.id).toBe('UPLOAD-001');
    expect(finding!.category).toBe('security');
    expect(finding!.owasp).toBe('A04:2021');
    expect(finding!.cwe).toBe(434);
  });

  it('flags multer usage without magic-byte validation', async () => {
    createApiRoute(
      projectPath,
      'upload/docs',
      `
      import multer from 'multer';
      const upload = multer({ dest: 'uploads/' });
      export const config = { api: { bodyParser: false } };
    `,
    );

    const result = await uploadValidatorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.some((f) => f.title.includes('magic-byte'))).toBe(true);
  });

  it('flags Supabase storage upload without magic-byte validation', async () => {
    createApiRoute(
      projectPath,
      'upload/media',
      `
      export async function POST(request: Request) {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const { error } = await supabase.storage.from('media').upload(file.name, file);
        return Response.json({ ok: !error });
      }
    `,
    );

    const result = await uploadValidatorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.some((f) => f.owasp === 'A04:2021')).toBe(true);
  });

  it('does not flag Supabase .storage.from() without .upload() call', async () => {
    createApiRoute(
      projectPath,
      'media/list',
      `
      export async function GET() {
        const { data } = await supabase.storage.from('media').list('folder');
        return Response.json(data);
      }
    `,
    );

    const result = await uploadValidatorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does not flag upload with file-type validation', async () => {
    createApiRoute(
      projectPath,
      'upload/avatar',
      `
      import { fileTypeFromBuffer } from 'file-type';
      export async function POST(request: Request) {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const buffer = Buffer.from(await file.arrayBuffer());
        const type = await fileTypeFromBuffer(buffer);
        if (!type || !['image/jpeg', 'image/png'].includes(type.mime)) {
          return new Response('Invalid file type', { status: 400 });
        }
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await uploadValidatorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does not flag upload processed via sharp (image validation)', async () => {
    createApiRoute(
      projectPath,
      'upload/image',
      `
      import sharp from 'sharp';
      export async function POST(request: Request) {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const buffer = Buffer.from(await file.arrayBuffer());
        const resized = await sharp(buffer).resize(800).toBuffer();
        return Response.json({ ok: true });
      }
    `,
    );

    const result = await uploadValidatorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('detects upload handler in lib/ directory', async () => {
    createLibFile(
      projectPath,
      'storage.ts',
      `
      export async function uploadFile(file: File) {
        const formData = new FormData();
        formData.append('file', file);
        await fetch('/api/upload', { method: 'POST', body: formData });
      }
      // Server-side upload
      async function handleUpload(request: Request) {
        const data = await request.formData();
        return data.get('file');
      }
    `,
    );

    const result = await uploadValidatorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('generates incrementing IDs across multiple unvalidated upload handlers', async () => {
    createApiRoute(projectPath, 'upload/a', `export async function POST(r) { const f = await r.formData(); const file = f.get('image'); }`);
    createApiRoute(projectPath, 'upload/b', `export async function POST(r) { const f = await r.formData(); formData.get('file'); }`);

    const result = await uploadValidatorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain('UPLOAD-001');
    expect(ids).toContain('UPLOAD-002');
  });

  it('includes duration and available fields in result', async () => {
    const result = await uploadValidatorScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});

describe('uploadValidatorScanner — Supabase contentType option (v0.6e)', () => {
  let projectPath: string;
  beforeEach(() => { projectPath = makeTempProject(); });

  it('flags supabase.storage.upload() WITHOUT contentType option', async () => {
    createApiRoute(projectPath, 'upload', `
      import { fileTypeFromBuffer } from 'file-type';
      export async function POST(req) {
        const formData = await req.formData();
        const file = formData.get('file');
        await fileTypeFromBuffer(await file.arrayBuffer());
        await supabase.storage.from('avatars').upload(\`u/id.png\`, file);
      }
    `);
    const result = await uploadValidatorScanner.scan(projectPath, MOCK_CONFIG);
    const ctFinding = result.findings.find((f) => f.title.includes('contentType'));
    expect(ctFinding).toBeDefined();
    expect(ctFinding!.severity).toBe('medium');
    expect(ctFinding!.cwe).toBe(434);
  });

  it('does NOT flag supabase.storage.upload() WITH contentType option', async () => {
    createApiRoute(projectPath, 'upload', `
      import { fileTypeFromBuffer } from 'file-type';
      export async function POST(req) {
        const formData = await req.formData();
        const file = formData.get('file');
        await fileTypeFromBuffer(await file.arrayBuffer());
        await supabase.storage.from('avatars').upload('u/id.png', file, {
          contentType: 'image/png',
          upsert: false,
        });
      }
    `);
    const result = await uploadValidatorScanner.scan(projectPath, MOCK_CONFIG);
    const ctFinding = result.findings.find((f) => f.title.includes('contentType'));
    expect(ctFinding).toBeUndefined();
  });

  it('flags BOTH magic-byte AND contentType when neither is present', async () => {
    createApiRoute(projectPath, 'upload', `
      export async function POST(req) {
        const formData = await req.formData();
        const file = formData.get('file');
        await supabase.storage.from('avatars').upload('a.png', file);
      }
    `);
    const result = await uploadValidatorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBe(2);
    expect(result.findings.some((f) => f.title.includes('magic-byte'))).toBe(true);
    expect(result.findings.some((f) => f.title.includes('contentType'))).toBe(true);
  });

  it('contentType check fires only on supabase storage uploads, not multer/formData', async () => {
    createApiRoute(projectPath, 'upload', `
      import multer from 'multer';
      import { fileTypeFromBuffer } from 'file-type';
      export async function POST(req) {
        await fileTypeFromBuffer(req.file.buffer);
      }
    `);
    const result = await uploadValidatorScanner.scan(projectPath, MOCK_CONFIG);
    const ctFinding = result.findings.find((f) => f.title.includes('contentType'));
    expect(ctFinding).toBeUndefined();
  });
});
