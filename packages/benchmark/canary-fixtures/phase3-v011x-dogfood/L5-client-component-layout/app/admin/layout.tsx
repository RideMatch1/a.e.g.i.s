'use client';

import { useEffect } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const session = localStorage.getItem('session');
    if (!session) window.location.href = '/login';
  }, []);
  return <>{children}</>;
}
