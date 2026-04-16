/**
 * Tenant guard helper — marks this project as multi-tenant.
 * Routes should filter by tenant_id using this helper.
 */
export async function getTenantId(userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('tenant_id').eq('user_id', userId).single();
  return data?.tenant_id;
}
