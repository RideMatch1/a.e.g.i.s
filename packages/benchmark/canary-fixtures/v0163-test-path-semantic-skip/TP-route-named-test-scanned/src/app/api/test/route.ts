// Legitimate Next.js App Router route at app/api/test/route.ts.
// Pre-v0.16.3 this file was silently skipped by 19 scanners because
// `/test/` appeared as a substring of the path. The D-CA-001 fix
// removes that substring-match — this file must now fire jwt-detector
// on the hardcoded token below.
const HARDCODED_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

export async function GET(): Promise<Response> {
  return new Response(HARDCODED_JWT, { status: 200 });
}
