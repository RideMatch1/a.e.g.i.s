// v0180-canary TP — agent-loop messages.push tool-feedback class.
// The toolResult is attacker-controllable when the tool fetches from an
// external source (web-search, file-read, RPC). Pushing it into messages
// without sanitization gives the attacker a direct path to inject
// prompt-override instructions into the LLM context.

interface ToolCall { id: string; name: string; args: unknown; }

async function runTool(_tc: ToolCall): Promise<string> {
  return 'stub-result';
}

export async function POST(req: Request) {
  const body = await req.json();
  const messages: Array<{ role: string; content: string; toolCallId?: string }> =
    body.messages ?? [];

  const toolCalls: ToolCall[] = body.toolCalls ?? [];

  for (const tc of toolCalls) {
    const toolResult = await runTool(tc);
    messages.push({ role: 'tool', content: toolResult, toolCallId: tc.id });
  }

  return Response.json({ ok: true, messages });
}
