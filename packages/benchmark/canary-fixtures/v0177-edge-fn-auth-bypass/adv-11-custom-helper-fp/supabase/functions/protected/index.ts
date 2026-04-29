import { createClient } from 'jsr:@supabase/supabase-js@2';
import { requireUser } from './_shared/auth.ts';

const URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(URL, SERVICE);

Deno.serve(async (req) => {
  const user = await requireUser(req);
  const { data } = await admin.from('items').select('*').eq('user_id', user.id);
  return new Response(JSON.stringify(data));
});
