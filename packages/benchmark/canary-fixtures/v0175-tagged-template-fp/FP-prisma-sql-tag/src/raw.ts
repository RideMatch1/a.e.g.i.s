// Prisma.sql tagged-template — safe parameterized fragment.
// template-sql-checker MUST NOT fire.

declare const Prisma: { sql: (strings: TemplateStringsArray, ...values: unknown[]) => unknown };
declare const prisma: { $executeRaw: (chunk: unknown) => Promise<unknown> };

export async function adjustBalance(userId: string, delta: number) {
  return await prisma.$executeRaw(
    Prisma.sql`UPDATE wallets SET balance = balance + ${delta} WHERE user_id = ${userId}`,
  );
}
