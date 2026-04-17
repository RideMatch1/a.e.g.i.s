import { supabase } from '@/lib/supabase';

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await supabase.from('reports').select('*').eq('id', id).single();
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
