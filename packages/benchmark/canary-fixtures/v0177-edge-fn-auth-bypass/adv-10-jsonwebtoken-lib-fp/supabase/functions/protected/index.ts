import jwt from 'jsonwebtoken';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET = Deno.env.get('JWT_SECRET')!;

const admin = createClient(URL, SERVICE);

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization');
  if (!auth) return new Response('Unauthorized', { status: 401 });
  const token = auth.replace('Bearer ', '');
  try {
    jwt.verify(token, SECRET);
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }
  const { data } = await admin.from('items').select('*');
  return new Response(JSON.stringify(data));
});
