// Sanitized from a real 2026-04-29 dogfood-scan FP (openstatus
// packages/api/src/router/domain.ts:56). The .query() argument is a
// tRPC HANDLER FUNCTION — the template-literal inside is a fetch URL,
// not SQL.

const z = { object: (_s: unknown) => ({}), string: () => ({ optional: () => ({}) }) } as any;
const protectedProcedure = { input: (_s: unknown) => ({ query: (_h: unknown) => ({}) }) } as any;
const createTRPCRouter = (def: unknown) => def;
const env = { PROJECT_ID_VERCEL: '', VERCEL_AUTH_BEARER_TOKEN: '' };

export const domainRouter = createTRPCRouter({
  getDomainResponse: protectedProcedure
    .input(z.object({ domain: z.string().optional() }))
    .query(async (opts: { input: { domain?: string } }) => {
      if (!opts.input.domain) {
        return null;
      }
      const data = await fetch(
        `https://api.vercel.com/v9/projects/${env.PROJECT_ID_VERCEL}/domains/${opts.input.domain}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${env.VERCEL_AUTH_BEARER_TOKEN}`,
          },
        },
      );
      return data.json();
    }),
});
