// Legitimate Next.js App Router route at app/api/test/route.ts. The path
// contains the `/test/` substring but is NOT a test-file (no .test.ts
// extension, no __tests__/ segment). Per the D-CA-001 fix (v0.16.3),
// taint-analyzer must scan this file and flag the command-injection flow
// from request body to child_process.exec as CWE-78.
import { exec } from 'child_process';

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const id = body.id;
  exec(id);
  return new Response('ok', { status: 200 });
}
