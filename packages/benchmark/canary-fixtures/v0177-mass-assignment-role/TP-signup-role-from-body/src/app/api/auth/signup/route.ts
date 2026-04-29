// Sanitized from real 2026-04-29 dogfood-scan TP that the scanner missed
// (hirenfire-v2 src/app/api/auth/signup/route.ts). Destructuring is "explicit"
// but includes sensitive `role` field — attacker can POST {role: 'admin'}
// and become admin.

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  const { email, password, name, phone, role, specialization, hourlyRate } = await request.json();

  if (!email || !password || !name) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const { data: user } = await db.from('User').insert({
    email,
    password: hashedPassword,
    name,
    phone: phone || null,
    role: role || 'customer',
    isAvailable: false,
  }).select().single();

  return NextResponse.json({ user });
}
