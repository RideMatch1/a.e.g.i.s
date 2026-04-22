// Legitimate Next.js App Router route at app/api/test/route.ts. The path
// contains the `/test/` substring but is NOT a test-file. Per D-CA-001
// (v0.16.3) jwt-detector must flag the hardcoded JWT below as CWE-798.
const HARDCODED_JWT = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abc123def456";

export async function GET(): Promise<Response> {
  return new Response(HARDCODED_JWT, { status: 200 });
}
