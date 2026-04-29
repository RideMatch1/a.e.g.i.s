// Zod strict-parsed body — the validation boundary rejects unknown fields,
// so even though the schema includes `role` (with a strict enum), the
// attacker cannot set arbitrary roles. This is the canonical safe pattern.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum(['customer', 'guest']),  // strict enum, no 'admin'
}).strict();

export async function POST(request: Request) {
  const input = CreateUserSchema.parse(await request.json());

  const { data: user } = await db.from('User').insert({
    email: input.email,
    name: input.name,
    role: input.role,
  }).select().single();

  return NextResponse.json({ user });
}
