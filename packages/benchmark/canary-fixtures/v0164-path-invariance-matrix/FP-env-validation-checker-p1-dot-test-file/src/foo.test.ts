// Canonical test-file — `.test.ts` extension (P1-class). Six distinct
// env-references below are intentional test-fixture data. isTestFile()
// extension-match must skip this file.
import { describe, it, expect } from 'vitest';

const a = process.env.DATABASE_URL;
const b = process.env.NEXTAUTH_SECRET;
const c = process.env.SMTP_HOST;
const d = process.env.STRIPE_SECRET_KEY;
const e = process.env.REDIS_URL;
const f = process.env.S3_BUCKET;

describe('env-handler harness', () => {
  it('reads six env vars', () => {
    expect([a, b, c, d, e, f]).toHaveLength(6);
  });
});
