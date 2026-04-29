// Real SQL injection — F1.1 must not over-suppress.

declare const db: { execute: (sql: string) => Promise<unknown> };

export async function getUserById(id: string) {
  return await db.execute(`SELECT * FROM users WHERE id = '${id}'`);
}
