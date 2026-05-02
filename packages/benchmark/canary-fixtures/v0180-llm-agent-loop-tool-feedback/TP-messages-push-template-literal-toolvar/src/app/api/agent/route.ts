// v0180-canary TP — agent-loop messages.push with template-literal
// interpolating an attacker-controllable tool-output variable.

async function fetchExternalDoc(_url: string): Promise<string> {
  return 'stub-doc';
}

export async function POST(req: Request) {
  const body = await req.json();
  const messages: Array<{ role: string; content: string }> = body.messages ?? [];

  const docUrl: string = body.docUrl;
  const toolOutput = await fetchExternalDoc(docUrl);

  messages.push({
    role: 'user',
    content: `Tool retrieved the following:\n${toolOutput}\n\nPlease summarize.`,
  });

  return Response.json({ ok: true, messages });
}
