import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { hasAccessToPath } from '@/lib/auth/page-access';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const pathname = hdrs.get('x-pathname') ?? '';
  const { allowed, userId } = await hasAccessToPath(pathname);
  if (!userId) redirect('/login');
  if (!allowed) redirect('/admin/dashboard');
  return <>{children}</>;
}
