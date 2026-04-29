// Sanitized from real 2026-04-29 dogfood-scan TP (nextjs-ai-note-app
// src/app/api/chat/route.ts). RAG retrieval feeds note.content directly
// into the system message template-literal. Indirect prompt-injection —
// attacker who writes a note (or when multi-user filter fails) injects
// payload into the LLM context.

export async function POST(req: Request) {
  const body = await req.json();
  const messages = body.messages;
  const userId = "stub-user";

  // RAG retrieval — relevantNotes is array of { id, content, title }
  const relevantNotes = [
    { id: "1", content: "stub", title: "stub-title" },
  ];

  const systemMessage = {
    role: "system" as const,
    content:
      "You are an intelligent note-taking app. Relevant notes:\n" +
      relevantNotes
        .map((note) => `Title: ${note.title}\n\nContent:\n${note.content}`)
        .join("\n\n"),
  };

  return Response.json({ ok: true, systemMessage, userId, messages });
}
