export async function renameUser(name: string, db: any) {
  return await db.execute(`UPDATE users SET name = '${name}'`);
}
