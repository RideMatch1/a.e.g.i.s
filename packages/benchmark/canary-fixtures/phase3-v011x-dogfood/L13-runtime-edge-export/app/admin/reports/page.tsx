import { supabase } from '@/lib/supabase';

export const runtime = 'edge';

export default async function ReportsPage() {
  const { data } = await supabase.from('reports').select('*');
  return <div>{data?.length} reports</div>;
}
