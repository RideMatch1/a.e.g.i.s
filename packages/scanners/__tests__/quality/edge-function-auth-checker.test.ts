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
    isTestFile: (filePath: string) =>
      /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath),
  };
});

import { edgeFunctionAuthCheckerScanner } from '../../src/quality/edge-function-auth-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-edge-fn-test-'));
}

function createEdgeFunction(projectPath: string, name: string, content: string): void {
  const fnDir = join(projectPath, 'supabase', 'functions', name);
  mkdirSync(fnDir, { recursive: true });
  writeFileSync(join(fnDir, 'index.ts'), content);
}

describe('edgeFunctionAuthCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    const ok = await edgeFunctionAuthCheckerScanner.isAvailable(projectPath);
    expect(ok).toBe(true);
  });

  it('flags Edge Function using SERVICE_ROLE_KEY without JWT verification (CRITICAL)', async () => {
    createEdgeFunction(projectPath, 'crawl', `
      import { createClient } from "jsr:@supabase/supabase-js@2.39.7";
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      Deno.serve(async (req) => {
        const { data } = await supabase.from("emails").select("*");
        return new Response(JSON.stringify({ data }));
      });
    `);
    const result = await edgeFunctionAuthCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.cwe === 306);
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
    expect(finding!.title).toMatch(/service-role-key|RLS bypass/i);
  });

  it('does NOT flag Edge Function with auth.getUser(req.headers.Authorization) before service-role call', async () => {
    createEdgeFunction(projectPath, 'safe', `
      import { createClient } from "jsr:@supabase/supabase-js@2.39.7";
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      Deno.serve(async (req) => {
        const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) return new Response("Unauthorized", { status: 401 });
        const admin = createClient(supabaseUrl, serviceKey);
        return new Response("ok");
      });
    `);
    const result = await edgeFunctionAuthCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toEqual([]);
  });

  it('does NOT flag Edge Function using anon-key only (no service-role bypass possible)', async () => {
    createEdgeFunction(projectPath, 'public', `
      import { createClient } from "jsr:@supabase/supabase-js@2.39.7";
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
      Deno.serve(async (req) => {
        const { data } = await supabase.from("public_posts").select("*");
        return new Response(JSON.stringify({ data }));
      });
    `);
    const result = await edgeFunctionAuthCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toEqual([]);
  });

  it('flags Edge Function calling paid third-party API (OpenAI) without auth — quota-burn HIGH', async () => {
    createEdgeFunction(projectPath, 'embed', `
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
      Deno.serve(async (req) => {
        const { text } = await req.json();
        const response = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: { "Authorization": "Bearer " + OPENAI_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
        });
        return new Response(await response.text());
      });
    `);
    const result = await edgeFunctionAuthCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.cwe === 306 && f.severity === 'high');
    expect(finding).toBeDefined();
    expect(finding!.title).toMatch(/quota-burn|paid third-party/i);
  });

  it('does NOT flag files outside supabase/functions/', async () => {
    // A regular API route file with Deno.serve and service-role wouldn't hit
    // the edge-function-auth-checker (path-scoped). Other scanners cover it.
    mkdirSync(join(projectPath, 'src/app/api/test'), { recursive: true });
    writeFileSync(
      join(projectPath, 'src/app/api/test/route.ts'),
      `Deno.serve(async (req) => {
         const supabase = createClient(URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
         return new Response("ok");
       });`,
    );
    const result = await edgeFunctionAuthCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toEqual([]);
  });

  it('skips empty project gracefully', async () => {
    const result = await edgeFunctionAuthCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toEqual([]);
    expect(result.available).toBe(true);
  });
});
