export async function getUser(user: { id: string }, supabase: any) {
  return await supabase.rpc('get_user', { id: user.id });
}
