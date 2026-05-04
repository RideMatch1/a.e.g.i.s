'use server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// VULNERABLE: Server Action mutates rows via service-role with no auth gate.
// 'use server' functions are callable by ANY client component invocation —
// including from public (unauthenticated) pages.
export async function deleteOrder(orderId: string) {
  await admin.from('orders').delete().eq('id', orderId);
}
