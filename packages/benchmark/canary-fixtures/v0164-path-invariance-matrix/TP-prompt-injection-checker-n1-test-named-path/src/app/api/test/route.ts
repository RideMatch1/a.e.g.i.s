// Legitimate Next.js App Router route at app/api/test/route.ts.
// Prompt-template interpolates user-controlled input directly —
// prompt-injection-checker must flag PROMPTINJ / CWE-77.
async function askAI(userMessage: string): Promise<unknown> {
  const response = await (globalThis as any).client.create({
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: `${userMessage}` },
    ],
  });
  return response;
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  return new Response(JSON.stringify(await askAI(body.q)), { status: 200 });
}
