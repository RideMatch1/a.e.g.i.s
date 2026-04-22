// Legitimate Next.js App Router route at app/api/test/route.ts. Contains
// a catastrophic-backtrack regex applied to user input — redos-checker
// must flag CWE-1333 under the post-D-CA-001 path-invariance contract.
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') ?? '';
  const pattern = /^(a+)+$/;
  return new Response(String(pattern.test(query)), { status: 200 });
}
