import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { hasAccessToPath } from '@/lib/auth/page-access';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const { userId } = await hasAccessToPath(hdrs.get('x-pathname') ?? '');
  if (!userId) redirect('/login');
  return <>{children}</>;
}
