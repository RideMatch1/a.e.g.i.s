export async function listAllUsers(db: any) {
  return await db.query(`SELECT * FROM users`);
}
