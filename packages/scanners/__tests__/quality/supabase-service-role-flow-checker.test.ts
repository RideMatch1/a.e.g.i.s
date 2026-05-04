import { describe, it, expect, vi } from 'vitest';
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
  };
});

import { supabaseServiceRoleFlowCheckerScanner } from '../../src/quality/supabase-service-role-flow-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-svcrole-flow-test-'));
}

function writeFile(dir: string, relPath: string, body: string) {
  const full = join(dir, relPath);
  mkdirSync(full.substring(0, full.lastIndexOf('/')), { recursive: true });
  writeFileSync(full, body, 'utf-8');
}

describe('supabase-service-role-flow-checker', () => {
  it('fires on app/api route handler using SERVICE_ROLE_KEY without auth', async () => {
    const dir = makeProject();
    writeFile(
      dir,
      'app/api/admin/route.ts',
      `import { createClient } from '@supabase/supabase-js';
       const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
       export async function POST(req) {
         await admin.from('users').delete().eq('id', '1');
         return Response.json({ ok: true });
       }`,
    );
    const r = await supabaseServiceRoleFlowCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]!.severity).toBe('critical');
    expect(r.findings[0]!.cwe).toBe(285);
  });

  it("fires on 'use server' Server Action using SERVICE_ROLE_KEY without auth", async () => {
    const dir = makeProject();
    writeFile(
      dir,
      'app/actions/admin.ts',
      `'use server';
       import { createClient } from '@supabase/supabase-js';
       const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
       export async function deleteOrder(id) {
         await admin.from('orders').delete().eq('id', id);
       }`,
    );
    const r = await supabaseServiceRoleFlowCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]!.title).toContain("'use server'");
  });

  it('fires on supabase.auth.admin.* call without auth', async () => {
    const dir = makeProject();
    writeFile(
      dir,
      'app/api/admin/delete/route.ts',
      `import { createClient } from '@supabase/supabase-js';
       const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
       export async function POST(req) {
         const { userId } = await req.json();
         await admin.auth.admin.deleteUser(userId);
         return Response.json({ ok: true });
       }`,
    );
    const r = await supabaseServiceRoleFlowCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings).toHaveLength(1);
  });

  it('does NOT fire when getUser() is called before service-role usage', async () => {
    const dir = makeProject();
    writeFile(
      dir,
      'app/api/admin/route.ts',
      `import { createClient } from '@supabase/supabase-js';
       import { createServerClient } from '@supabase/ssr';
       export async function POST(req) {
         const userClient = createServerClient(URL, ANON, { cookies: () => ({}) });
         const { data: { user } } = await userClient.auth.getUser();
         if (!user) return new Response('401', { status: 401 });
         const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
         await admin.from('users').delete().eq('id', '1');
         return Response.json({ ok: true });
       }`,
    );
    const r = await supabaseServiceRoleFlowCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings).toHaveLength(0);
  });

  it('does NOT fire on cron/script files (out of scope)', async () => {
    const dir = makeProject();
    writeFile(
      dir,
      'scripts/nightly.ts',
      `import { createClient } from '@supabase/supabase-js';
       const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
       async function nightly() { await admin.from('audit').delete().lt('ts', '2024-01-01'); }
       nightly();`,
    );
    const r = await supabaseServiceRoleFlowCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings).toHaveLength(0);
  });

  it('does NOT fire when the route does not import service-role', async () => {
    const dir = makeProject();
    writeFile(
      dir,
      'app/api/users/route.ts',
      `import { createServerClient } from '@supabase/ssr';
       export async function GET() {
         const sb = createServerClient(URL, ANON, { cookies: () => ({}) });
         return Response.json(await sb.from('profiles').select('*'));
       }`,
    );
    const r = await supabaseServiceRoleFlowCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings).toHaveLength(0);
  });

  it('does NOT fire when comments mention auth() / getUser() but body does not', async () => {
    // Defensive — comment-stripper must not be bypassable via comments.
    // The fixture below has SERVICE_ROLE usage, NO real auth-call, but a
    // comment that says "calls auth()". Scanner should still fire.
    const dir = makeProject();
    writeFile(
      dir,
      'app/api/admin/route.ts',
      `import { createClient } from '@supabase/supabase-js';
       // This file uses auth() and getUser() per the documentation block above
       /* getServerSession() should be called here but isn't */
       const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
       export async function POST(req) {
         await admin.from('x').delete();
         return Response.json({});
       }`,
    );
    const r = await supabaseServiceRoleFlowCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings).toHaveLength(1);
  });

  it('does NOT fire when secureApiRoute HOC wraps the handler', async () => {
    const dir = makeProject();
    writeFile(
      dir,
      'app/api/admin/route.ts',
      `import { createClient } from '@supabase/supabase-js';
       import { secureApiRoute } from '@/lib/auth';
       const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
       export const POST = secureApiRoute(async (req, { user }) => {
         await admin.from('users').delete().eq('id', '1');
         return Response.json({ ok: true });
       });`,
    );
    const r = await supabaseServiceRoleFlowCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings).toHaveLength(0);
  });

  it('emits CWE-285 OWASP A01 with severity critical', async () => {
    const dir = makeProject();
    writeFile(
      dir,
      'app/api/admin/route.ts',
      `import { createClient } from '@supabase/supabase-js';
       const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
       export async function POST(req) { await admin.from('x').delete(); return Response.json({}); }`,
    );
    const r = await supabaseServiceRoleFlowCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings[0]!.cwe).toBe(285);
    expect(r.findings[0]!.owasp).toBe('A01:2021');
    expect(r.findings[0]!.severity).toBe('critical');
  });

  it('handles bare env-read pattern without createClient or auth.admin call', async () => {
    // Lower-confidence path: file references SERVICE_ROLE_KEY but
    // exact instantiation pattern is not matched. Still fires when
    // file is in-scope and lacks auth.
    const dir = makeProject();
    writeFile(
      dir,
      'app/api/admin/route.ts',
      `const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
       export async function POST(req) {
         await fetch('https://supabase.example.com/rest/v1/users', {
           headers: { apikey: key, Authorization: 'Bearer ' + key },
         });
         return Response.json({ ok: true });
       }`,
    );
    const r = await supabaseServiceRoleFlowCheckerScanner.scan(dir, MOCK_CONFIG);
    expect(r.findings).toHaveLength(1);
  });
});
