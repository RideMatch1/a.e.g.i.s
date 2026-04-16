/**
 * CLEAN-02: Properly sanitized taint flow — should NOT be flagged by taint-analyzer
 * parseInt blocks SQLi, DOMPurify blocks XSS, Zod blocks all
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const Schema = z.object({ id: z.number(), name: z.string() }).strict();

export async function POST(request: NextRequest) {
  const body = Schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  const { id, name } = body.data;
  client.query(`SELECT * FROM users WHERE id = ${id}`);
  return NextResponse.json({ id, name });
}
