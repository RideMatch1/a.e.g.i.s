export async function findById(id: string, prisma: any) {
  return await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE id = ${id}`);
}
