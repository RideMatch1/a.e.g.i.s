// D10 canary lib — wrapper around fetch with a fixed URL and a
// user-controlled body. v0.9.1 URL-position filter recognises that
// arg-0 is the URL position while arg-1 is options (body / headers)
// — taint in arg-1's body does NOT qualify as CWE-918 SSRF.

export async function rateLimitCall(
  url: string,
  opts: { body: object; headers?: Record<string, string> },
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
    body: JSON.stringify(opts.body),
  });
}
