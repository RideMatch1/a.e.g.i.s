import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect('/login');
  return <html><body>{children}</body></html>;
}
