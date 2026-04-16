/**
 * Next.js NEXT_PUBLIC_ Environment Variable Leak Scanner.
 *
 * Two finding classes:
 *
 * 1. **Secret-in-public-prefix**: `process.env.NEXT_PUBLIC_*` where the suffix
 *    matches a secret pattern (SECRET, PRIVATE, SERVICE_ROLE_KEY, …). These
 *    leak to the client bundle by Next.js convention. AI-generated code
 *    frequently confuses NEXT_PUBLIC_ semantics — common bug in vibe-coded apps.
 *
 * 2. **Server-secret in client component**: `process.env.SECRET_*` (no
 *    NEXT_PUBLIC_ prefix) accessed in a file with `'use client'` directive.
 *    These will be `undefined` at runtime (Next.js strips them) but the
 *    INTENT is dangerous — code reads a secret it doesn't have.
 *
 * Tier: pattern (75% precision gate).
 */
import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/**
 * Names that ARE meant to be public on Next.js + Supabase + standard SaaS stacks.
 * Adding more whitelist entries reduces false-positive rate but should be
 * deliberate — each entry is an explicit decision that the value is safe to
 * expose to client bundles.
 */
const KNOWN_SAFE_PUBLIC = new Set<string>([
  // URLs are not secrets
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_BASE_URL',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_VERCEL_URL',

  // Supabase anon key is public-by-design (RLS protects DB)
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',

  // Analytics IDs (intentionally client-side)
  'NEXT_PUBLIC_GA_ID',
  'NEXT_PUBLIC_GTM_ID',
  'NEXT_PUBLIC_POSTHOG_KEY',
  'NEXT_PUBLIC_POSTHOG_HOST',
  'NEXT_PUBLIC_PLAUSIBLE_DOMAIN',

  // Error tracking (intentionally client-side)
  'NEXT_PUBLIC_SENTRY_DSN',

  // Stripe publishable keys (start with pk_, public-by-design)
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLIC_KEY',

  // Build/env metadata
  'NEXT_PUBLIC_VERCEL_ENV',
  'NEXT_PUBLIC_NODE_ENV',
  'NEXT_PUBLIC_APP_NAME',
  'NEXT_PUBLIC_APP_VERSION',
]);

/**
 * Substrings that strongly suggest the value is a server-only secret.
 * Match anywhere in the env-var name (not just suffix) so we catch
 * things like `NEXT_PUBLIC_DATABASE_PASSWORD_PROD`.
 *
 * Connection strings (DATABASE_URL, REDIS_URL, MONGODB_URI, …) are the
 * most-missed server-only category in real Next.js + Supabase codebases —
 * they don't contain SECRET/PRIVATE/PASSWORD, so the original indicator
 * set silently let them through. Whole-string patterns (DATABASE_URL
 * rather than _URL) avoid false-positives on legitimately-public URLs
 * like NEXT_PUBLIC_APP_URL.
 */
const SECRET_INDICATORS = [
  // Explicit-secret categories
  'SECRET',
  'PRIVATE_KEY',
  'PRIVATE',
  'PASSWORD',
  'SERVICE_ROLE_KEY', // Supabase service role — must NEVER be NEXT_PUBLIC_
  'WEBHOOK_SECRET',
  'JWT_SECRET',
  'API_KEY', // somewhat noisy but worth a low-severity flag for human review

  // Connection-string categories (v0.6 — previously missed class of leaks)
  'DATABASE_URL',
  'POSTGRES_URL',
  'MYSQL_URL',
  'REDIS_URL',
  'MONGODB_URI',
  'AWS_ACCESS', // catches AWS_ACCESS_KEY_ID and friends
  'AWS_SECRET', // catches AWS_SECRET_ACCESS_KEY (also matches SECRET above, kept for clarity)
  '_DSN',       // Sentry-style DSNs, Doctrine-style DSNs
];

/**
 * Find all `process.env.IDENT` accesses in source content.
 * Returns array of { name, line }.
 */
function findEnvAccesses(content: string): Array<{ name: string; line: number }> {
  const results: Array<{ name: string; line: number }> = [];
  // Match `process.env.X` AND `process.env['X']` AND `process.env["X"]`
  const re = /process\.env(?:\.([A-Z][A-Z0-9_]*)|\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\])/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const name = match[1] ?? match[2];
    if (!name) continue;
    const line = content.slice(0, match.index).split('\n').length;
    results.push({ name, line });
  }
  return results;
}

/**
 * Check whether the file declares 'use client' as the first non-trivial directive.
 */
function isClientFile(content: string): boolean {
  // 'use client' must be the first directive (allowing leading whitespace + comments)
  // Skip leading comments + empty lines, then check for the directive
  const stripped = content
    .replace(/^\s*\/\*[\s\S]*?\*\/\s*/g, '') // leading block comments
    .replace(/^(?:\s*\/\/[^\n]*\n)+/g, '');   // leading line comments
  return /^\s*['"]use client['"]/.test(stripped);
}

/**
 * Check whether an env-var name contains a secret indicator (case-sensitive).
 */
function looksLikeSecret(name: string): boolean {
  for (const indicator of SECRET_INDICATORS) {
    if (name.includes(indicator)) return true;
  }
  return false;
}

export const nextPublicLeakScanner: Scanner = {
  name: 'next-public-leak',
  description:
    'Detects NEXT_PUBLIC_ env-vars that look like secrets (leak to client bundle) ' +
    'and server-only secrets accessed from client components.',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;

    const defaultIgnore = ['node_modules', 'dist', '.next', '.git', 'coverage'];
    const ignore = [...new Set([...defaultIgnore, ...(config.ignore ?? [])])];
    const files = walkFiles(projectPath, ignore, ['ts', 'js', 'tsx', 'jsx', 'mjs', 'cjs']);

    for (const file of files) {
      const content = readFileSafe(file);
      if (!content) continue;

      const accesses = findEnvAccesses(content);
      if (accesses.length === 0) continue;

      // 'use client' is normally on .tsx/.jsx files but Next.js also allows it
      // on .ts/.js utility modules used in client context. Cheap regex anyway.
      const isClient = isClientFile(content);

      for (const { name, line } of accesses) {
        // ── Class 1: NEXT_PUBLIC_* with secret-like suffix ──
        if (name.startsWith('NEXT_PUBLIC_')) {
          if (KNOWN_SAFE_PUBLIC.has(name)) continue; // explicit allowlist
          if (looksLikeSecret(name)) {
            findings.push({
              id: `NPL-${String(idCounter++).padStart(3, '0')}`,
              scanner: 'next-public-leak',
              category: 'security',
              severity: 'high',
              title: `Suspected secret exposed via NEXT_PUBLIC_ prefix: ${name}`,
              description:
                `\`process.env.${name}\` is prefixed with NEXT_PUBLIC_ which means Next.js inlines it into the client bundle. ` +
                `The name suggests it holds a secret (${SECRET_INDICATORS.find((i) => name.includes(i))}). ` +
                `If this value is sensitive, rename without the NEXT_PUBLIC_ prefix and access it server-side only. ` +
                `If it is genuinely safe to expose (like an analytics ID), add it to KNOWN_SAFE_PUBLIC or use a non-secret-like name.`,
              file,
              line,
              cwe: 200, // CWE-200: Information Exposure
              owasp: 'A02:2021',
            });
          }
          continue;
        }

        // ── Class 2: server-secret in 'use client' file ──
        // Only meaningful for client-component files
        if (isClient && looksLikeSecret(name)) {
          findings.push({
            id: `NPL-${String(idCounter++).padStart(3, '0')}`,
            scanner: 'next-public-leak',
            category: 'security',
            severity: 'high',
            title: `Server-only secret accessed from client component: ${name}`,
            description:
              `\`process.env.${name}\` is accessed in a file marked with \`'use client'\`. ` +
              `Next.js does not inline non-NEXT_PUBLIC_ env vars into client bundles, so this value will be \`undefined\` at runtime. ` +
              `More importantly, the INTENT is dangerous — the code reads a secret it cannot have. ` +
              `Move this access to a Server Component, Server Action, or Route Handler.`,
            file,
            line,
            cwe: 200,
            owasp: 'A02:2021',
          });
        }
      }
    }

    return {
      scanner: 'next-public-leak',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
