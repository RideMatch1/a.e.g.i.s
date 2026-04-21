export async function deleteById(id: string, prisma: any) {
  return await prisma.$executeRawUnsafe(`DELETE FROM t WHERE x = ${id}`);
}
