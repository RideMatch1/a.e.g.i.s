import { prisma } from '@/lib/prisma';

export default async function ReportsPage() {
  const reports = await prisma.report.findMany();
  return <div>{reports.length} reports</div>;
}
