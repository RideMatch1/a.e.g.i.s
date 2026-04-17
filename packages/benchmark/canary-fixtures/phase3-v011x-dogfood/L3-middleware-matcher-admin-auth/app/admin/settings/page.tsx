import { supabase } from '@/lib/supabase';

export default async function SettingsPage() {
  const { data } = await supabase.from('settings').select('*');
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
