export async function proxyRequest(req: { json: () => Promise<{ host: string }> }) {
  const { host } = await req.json();
  const res = await fetch(`${host}/api/data`, { method: 'GET' });
  return res.json();
}
