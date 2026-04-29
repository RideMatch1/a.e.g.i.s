import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

export async function requireUser(req: Request): Promise<{ id: string; email: string }> {
  const auth = req.headers.get('Authorization');
  if (!auth) throw new Response('Unauthorized', { status: 401 });
  const userClient = createClient(URL, ANON, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new Response('Unauthorized', { status: 401 });
  return { id: user.id, email: user.email! };
}
