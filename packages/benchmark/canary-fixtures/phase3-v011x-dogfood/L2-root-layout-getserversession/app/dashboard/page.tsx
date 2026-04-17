import { prisma } from '@/lib/prisma';

export default async function DashboardPage() {
  const users = await prisma.user.findMany({ take: 10 });
  return <div>{users.length} users</div>;
}
