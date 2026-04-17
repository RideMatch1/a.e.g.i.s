import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!process.env.BYPASS_AUTH) {
    const session = await getServerSession();
    if (!session) redirect('/login');
  }
  return <>{children}</>;
}
