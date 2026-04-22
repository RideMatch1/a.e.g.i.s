// Legitimate route at api/test/route.ts inside scanner's HTTP_DIRS
// (api/lib/services). Bare fetch() without a timeout mechanism — the
// scanner must flag TIMEOUT-001 / CWE-400.
export async function getData(): Promise<unknown> {
  const res = await fetch('https://api.example.com/data');
  return res.json();
}
