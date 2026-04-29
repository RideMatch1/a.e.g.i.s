// Server-derived role: role is hardcoded to 'customer' on insert.
// Body destructure picks only non-sensitive fields. mass-assignment-checker
// must NOT fire because the role/permission columns are server-controlled.

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  const { email, password, name } = await request.json();

  if (!email || !password || !name) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const { data: user } = await db.from('User').insert({
    email,
    password: hashedPassword,
    name,
    role: 'customer',
    is_admin: false,
    is_verified: false,
  }).select().single();

  return NextResponse.json({ user });
}
