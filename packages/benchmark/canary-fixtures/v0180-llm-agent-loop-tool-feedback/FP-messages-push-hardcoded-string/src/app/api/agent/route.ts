// v0180-canary FP — messages.push() with hardcoded string. Must NOT fire.

export async function POST() {
  const messages: Array<{ role: string; content: string }> = [];

  messages.push({ role: 'system', content: 'You are a helpful assistant.' });
  messages.push({ role: 'assistant', content: 'How can I help you today?' });
  messages.push({ role: 'user', content: 'Tell me about TypeScript.' });

  return Response.json({ ok: true, messages });
}
