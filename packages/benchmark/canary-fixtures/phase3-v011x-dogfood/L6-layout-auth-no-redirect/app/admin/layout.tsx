import { getServerSession } from 'next-auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) {
    console.warn('[admin-layout] no session, continuing anyway');
  }
  return <>{children}</>;
}
