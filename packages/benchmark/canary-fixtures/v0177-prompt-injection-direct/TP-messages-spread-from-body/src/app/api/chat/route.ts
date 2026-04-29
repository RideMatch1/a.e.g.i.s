// User-supplied messages array spread into the LLM call. Attacker can
// include `{role: 'system', ...}` entries that override the system prompt.

export async function POST(req: Request) {
  const body = await req.json();
  const messages = body.messages;
  const messagesTruncated = messages.slice(-6);

  const systemMessage = { role: "system" as const, content: "Be helpful." };

  // Spread body.messages directly — attacker controls roles
  const openai: any = { chat: { completions: { create: async (_x: any) => null } } };
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [systemMessage, ...messagesTruncated],
  });

  return Response.json({ response });
}
