// Legitimate Next.js App Router route at app/api/test/route.ts. Six
// distinct process.env references without a central Zod-validated
// env.ts — env-validation-checker must flag ENV-001 / CWE-1188.
const a = process.env.DATABASE_URL;
const b = process.env.NEXTAUTH_SECRET;
const c = process.env.SMTP_HOST;
const d = process.env.STRIPE_SECRET_KEY;
const e = process.env.REDIS_URL;
const f = process.env.S3_BUCKET;

export async function GET(): Promise<Response> {
  return new Response(JSON.stringify({ a, b, c, d, e, f }), { status: 200 });
}
