'use client';

import { useQuery } from '@tanstack/react-query';

interface Stats { total: number; today: number }

export default function DashboardPage() {
  // Stats query (separat, ohne Filter, fuer Heute/Woche/Gesamt)
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => fetch('/api/admin/stats').then((r) => r.json()),
  });
  if (isLoading) return <div>Loading…</div>;
  return <div>{data?.total} entries</div>;
}
