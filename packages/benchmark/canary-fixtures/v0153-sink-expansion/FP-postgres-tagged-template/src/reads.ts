export async function findById(id: string, sql: any) {
  return await sql`SELECT * FROM t WHERE id = ${id}`;
}
