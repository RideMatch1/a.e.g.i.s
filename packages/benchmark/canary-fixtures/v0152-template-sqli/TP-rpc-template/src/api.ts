export async function findUserById(id: string, supabase: any) {
  return await supabase.rpc('raw', { q: `SELECT * FROM users WHERE id = '${id}'` });
}
