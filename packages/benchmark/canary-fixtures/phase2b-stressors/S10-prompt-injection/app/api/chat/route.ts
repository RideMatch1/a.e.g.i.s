import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// S10 canary — user input concatenated directly into LLM messages
// with no system-prompt separation or input sanitization. Attacker
// can inject role-switches ("ignore previous instructions") or
// extract the system prompt.

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { message } = await req.json();

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: message,
      },
    ],
  });

  return NextResponse.json({
    reply: completion.choices[0].message.content,
  });
}
