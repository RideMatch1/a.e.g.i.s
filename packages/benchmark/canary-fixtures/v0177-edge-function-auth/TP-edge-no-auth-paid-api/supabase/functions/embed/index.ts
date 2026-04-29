// Edge Function calls OpenAI embeddings API without verifying caller.
// Anyone calling this URL drains developer's OpenAI quota.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

Deno.serve(async (req: Request) => {
  const { text } = await req.json();

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });

  return new Response(await response.text(), {
    headers: { "Content-Type": "application/json" },
  });
});
