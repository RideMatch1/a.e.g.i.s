// Cron-style script — NOT an HTTP route handler.
// Service-role usage here is fine: this is operator-invoked, not user-invoked.
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function nightly() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  await admin.from('audit_logs').delete().lt('created_at', cutoff);
}
nightly();
