// Legitimate Next.js App Router route at app/api/test/route.ts. The
// path-join below takes user-controlled input without normalization —
// path-traversal-checker must flag PATHTRV / CWE-22.
import path from 'path';
import { readFileSync } from 'fs';

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const filePath = path.join('/uploads', searchParams.get('path')!);
  return new Response(readFileSync(filePath));
}
