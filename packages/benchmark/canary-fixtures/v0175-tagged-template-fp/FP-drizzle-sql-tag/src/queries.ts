// Drizzle / postgres.js style tagged-template SQL.
// The `sql` tag returns a parameterized SQLChunk — values are bound
// as parameters, not spliced into raw SQL text. SAFE.
// template-sql-checker MUST NOT fire.

declare const db: { execute: (chunk: unknown) => Promise<unknown> };
declare const sql: (strings: TemplateStringsArray, ...values: unknown[]) => unknown;

export async function findUserById(id: string) {
  return await db.execute(sql`SELECT * FROM users WHERE id = ${id}`);
}

export async function deleteUser(id: string) {
  return await db.execute(sql`DELETE FROM users WHERE id = ${id} AND archived = false`);
}
