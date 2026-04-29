// Non-async arrow handler with internal template-literal logging.
// template-sql-checker MUST NOT fire — F1.1 arrow-shape detection.

const trpc = {
  query: (_h: unknown) => ({}),
} as any;

export const userQuery = trpc.query((opts: { input: { id: string } }) => {
  console.log(`Resolving user ${opts.input.id} at ${new Date().toISOString()}`);
  return { id: opts.input.id };
});
