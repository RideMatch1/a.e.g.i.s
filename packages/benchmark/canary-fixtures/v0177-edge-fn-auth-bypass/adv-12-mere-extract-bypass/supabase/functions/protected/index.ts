import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(URL, SERVICE);

Deno.serve(async (req) => {
  const _maybeToken = req.headers.get('Authorization');
  const { data } = await admin.from('items').select('*');
  return new Response(JSON.stringify(data));
});
