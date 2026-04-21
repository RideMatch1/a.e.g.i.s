export async function findById(id: string, prisma: any) {
  return await prisma.$queryRaw`SELECT * FROM t WHERE id = ${id}`;
}
