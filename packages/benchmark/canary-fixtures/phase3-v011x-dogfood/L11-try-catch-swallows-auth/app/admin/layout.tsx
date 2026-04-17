import { requireAuth } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAuth();
  } catch {
    // Log-less swallow — page renders regardless of auth state
  }
  return <>{children}</>;
}
