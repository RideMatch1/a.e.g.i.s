import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// VULNERABLE: GitHub webhook accepting events without x-hub-signature-256 HMAC verification
// Attacker can POST a 'push' event to trigger CI re-runs or DB updates.
export async function POST(req: NextRequest) {
  const event = await req.json();
  const eventType = req.headers.get('x-github-event');
  if (eventType === 'push') {
    await db.builds.create({
      data: { repo: event.repository.full_name, sha: event.after, status: 'queued' },
    });
  }
  return NextResponse.json({ received: true });
}
