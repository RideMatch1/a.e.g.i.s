// UNTAGGED template directly to .execute() — real SQLi.
// template-sql-checker MUST fire.

declare const db: { execute: (sql: string) => Promise<unknown> };

export async function unsafeUpdate(name: string) {
  return await db.execute(`UPDATE users SET name = '${name}'`);
}
