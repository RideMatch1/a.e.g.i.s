import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

// D3 canary — session-authenticated self-service billing route. Every
// authenticated user manages their own subscription; no admin / moderator
// role required. The `@self-only` annotation tells AEGIS that missing-
// role-guard checks do not apply (auth IS required — this is NOT `@public`).
//
// Today: auth-enforcer sees AUTH_GUARD present but no ROLE_GUARD and
// emits low-severity CWE-285 "missing role/authorisation guard".
// Post-v0.10 expected: auth-enforcer recognises `@self-only` and
// suppresses CWE-285 while still requiring AUTH_GUARD (unlike `@public`
// which suppresses both).

/**
 * Update the authenticated user's subscription.
 *
 * @self-only
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  const customerId = session.user.stripeCustomerId;
  if (!customerId) {
    return NextResponse.json({ error: 'no customer' }, { status: 400 });
  }

  const { action } = await req.json();
  if (action === 'cancel') {
    await stripe.subscriptions.cancel(customerId);
  } else if (action === 'reactivate') {
    await stripe.subscriptions.update(customerId, { cancel_at_period_end: false });
  }

  return NextResponse.json({ ok: true, action });
}
