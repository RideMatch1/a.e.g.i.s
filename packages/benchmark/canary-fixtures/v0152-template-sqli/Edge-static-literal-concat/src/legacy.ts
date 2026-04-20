export async function findById(id: string, db: any) {
  return await db.query("SELECT * FROM users WHERE id = " + id);
}
