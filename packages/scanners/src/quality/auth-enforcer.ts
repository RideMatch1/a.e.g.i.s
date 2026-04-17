import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { existsSync } from 'fs';

const AUTH_GUARD_PATTERNS = [
  /secureApiRouteWithTenant/,
  /getServerSession/,
  /\bauth\(\)/,
  /getSession/,
  /requireAuth/,
  /\bauthenticate\b/,
  /verifyToken/,
  /verifySignature/,
  // v0.9.2: Clerk / Auth.js community AUTH helpers (distinct from the
  // role-guard check in ROLE_GUARD_PATTERNS). currentUser() proves the
  // request has an authenticated session; the role check is separate.
  /\bcurrentUser\s*\(\s*\)/,
  /auth\.protect\s*\(/,           // Clerk v5 explicit protect()
  // v0.9.3: tRPC / Hono / Elysia context-based auth. The framework
  // produces `ctx.session` (or `ctx.user`) from its createContext
  // function which already verified the request. A procedure checking
  // `if (!ctx.session)` / `if (!ctx.user)` is the idiomatic auth gate.
  /\bctx\.(?:session|user)\b/,
];

/**
 * Role / authorisation guard patterns.
 *
 * The original v0.7 set was tuned to a narrow helper family
 * (requireRole, requireRoleOrSelf, isManager, …). Validator-
 * report MAJOR-02 surfaced that standard next-auth / Clerk / iron-
 * session community shapes do NOT match any of those names, so every
 * properly-authorised next-auth route produced a "missing role guard"
 * low-severity FP.
 *
 * v0.9.2 extends the list with the dominant community shapes. We match
 * **guard shapes** where possible — structural ownership-comparison
 * patterns like `session.user.id === post.userId` — rather than mere
 * helper-name keywords, so a random file containing "canRead" in a
 * comment does not falsely qualify. This is still a precision-over-
 * recall pattern match, not full-flow AST analysis; the latter is
 * v0.10 scope.
 */
const ROLE_GUARD_PATTERNS = [
  // Original tuning set (kept for backward compat).
  /requireRole/,
  /requireRoleOrSelf/,
  /isManager/,
  /checkRole/,
  /hasRole/,
  /isAdmin/,
  /authorize/,

  // v0.9.2 / v0.9.3: next-auth / iron-session / Clerk / Auth.js — claim
  // comparison shapes. The regexes below uniformly handle:
  //   - Optional chaining on `session` and/or `.user` (session?.user.id,
  //     session.user?.id, session?.user?.id) — common post-null-check shape.
  //   - Both equality operators (`===` and `!==`) — the negated form is
  //     the canonical "forbidden unless matching" early-exit.
  //   - Either operand order: session-on-left AND resource-on-left.
  //   - tRPC-style `ctx.session.user.id` via the optional prefix.
  //
  // v0.9.3 closes the reviewer's residual MAJOR-02 FP classes (optional
  // chaining breaking literal-dot matches; reversed-operand not-equals
  // ownership checks) surfaced against a vanilla shadcn-ui/taxonomy scan.
  /(?:\bctx\.)?session\??\.user\??\.(?:id|role|email)\s*[!=]==/,
  /[!=]==\s*(?:\bctx\.)?session\??\.user\??\.(?:id|role|email)/,
  /\.(?:userId|authorId|ownerId|createdBy|user_id)\s*[!=]==\s*(?:\bctx\.)?session\??\.user/,
  /(?:\bctx\.)?session\??\.user\??\.id\s*[!=]==\s*\w+\.(?:userId|authorId|ownerId|createdBy|user_id)/,

  // Community utility-name families (taxonomy / Auth.js-style helpers).
  // e.g. `await verifyCurrentUserHasAccessToPost(postId)`
  /verifyCurrent(User|Member|Owner)[A-Z]\w*/,
  /user(HasAccess|CanAccess|IsOwner|OwnsResource|CanEdit|CanRead|CanWrite|CanDelete)\w*/,
  /\bcan(Edit|Read|Write|Delete|Access|View)[A-Z]\w*\s*\(/,

  // Clerk role / permission checks (distinct from Clerk's AUTH guard
  // which is already covered by /\bauth\(\)/ above).
  // Matches both `auth().has({ role: 'admin' })` (member form) and the
  // destructured `const { has } = auth(); has({ role })` form.
  /\bhas\s*\(\s*\{\s*(?:role|permission)\s*:/,
  /(?:public|private|unsafe)Metadata\.role/,     // Clerk metadata role claim
];

/** Routes that are intentionally public — no auth required */
const PUBLIC_ROUTE_PATTERNS = [
  /\/public\//,
  /\/webhook/,
  /\/health/,
  /\/status/,
  /\/auth\/(login|register|callback|signup|verify|reset|confirm)/,
  /\/cron\//,
  /\/api\/og/,        // Open Graph image generation
  /\/_next\//,
];

/** Patterns that indicate direct database access in a server component */
const DB_ACCESS_PATTERNS = [
  /supabase\s*\.\s*from\s*\(/,
  /prisma\s*\.\s*\w+\s*\.\s*(find|create|update|delete|upsert)/,
  /\bquery\s*\(/,
  /\bdb\s*\.\s*(select|insert|update|delete)\s*\(/,
  /\.execute\s*\(\s*['"`]/,
];

/** Express/Fastify-style route handler patterns */
const EXPRESS_ROUTE_PATTERNS = [
  /\b(app|router)\s*\.\s*(get|post|put|patch|delete|all)\s*\(/,
];

/** Middleware auth patterns (Next.js middleware.ts) */
const MIDDLEWARE_AUTH_PATTERNS = [
  /getToken/,
  /withAuth/,
  /\bauth\(\)/,
  /NextAuth/,
  /clerkMiddleware/,
  /authMiddleware/,
];

const ROUTE_FILENAMES = ['route.ts', 'route.js'];

function detectApiDirs(projectPath: string): string[] {
  const candidates = [
    `${projectPath}/src/app/api`,
    `${projectPath}/app/api`,
    `${projectPath}/pages/api`,
  ];
  return candidates;
}

function detectServerComponentDirs(projectPath: string): string[] {
  const candidates = [
    `${projectPath}/src/app`,
    `${projectPath}/app`,
  ];
  return candidates;
}

function detectExpressDirs(projectPath: string): string[] {
  const candidates = [
    `${projectPath}/src/routes`,
    `${projectPath}/routes`,
    `${projectPath}/src/api`,
    `${projectPath}/api`,
    `${projectPath}/src`,
  ];
  return candidates;
}

function isPublicRoute(filePath: string): boolean {
  return PUBLIC_ROUTE_PATTERNS.some((p) => p.test(filePath));
}

/** Patterns in file content that indicate intentional public access */
const PUBLIC_CONTENT_PATTERNS = [
  /\/\*\*?\s*@public\b/,           // JSDoc @public annotation
  /\/\/\s*@public\b/,              // Line comment @public
  /requireAuth:\s*false/,          // Explicit opt-out
  /stripe\.webhooks\.constructEvent/, // Stripe webhook signature verification
  /verifyWebhookSignature/,        // Generic webhook signature
  /createHmac\b.*\bdigest\b/,     // HMAC comparison (webhook signature verification)
  /timingSafeEqual\b.*\bhmac\b/i, // Timing-safe HMAC comparison
];

function checkFile(
  content: string,
  file: string,
  findings: Finding[],
  idCounter: { value: number },
): void {
  // Skip intentionally public routes
  if (isPublicRoute(file)) return;
  if (PUBLIC_CONTENT_PATTERNS.some((p) => p.test(content))) return;

  const hasAuthGuard = AUTH_GUARD_PATTERNS.some((p) => p.test(content));
  const hasRoleGuard = ROLE_GUARD_PATTERNS.some((p) => p.test(content));

  if (!hasAuthGuard) {
    const id = `AUTH-${String(idCounter.value++).padStart(3, '0')}`;
    findings.push({
      id,
      scanner: 'auth-enforcer',
      severity: 'high',
      title: 'Route missing authentication guard',
      description: `API route does not use any recognised auth guard. Unauthenticated access may be possible.`,
      file,
      line: 1,
      fileLevel: true,
      category: 'security',
      owasp: 'A07:2021',
      cwe: 306,
    });
  } else if (!hasRoleGuard) {
    const id = `AUTH-${String(idCounter.value++).padStart(3, '0')}`;
    findings.push({
      id,
      scanner: 'auth-enforcer',
      severity: 'low',  // Auth exists, just missing explicit role check — defense-in-depth suggestion
      title: 'Route missing role/authorisation guard',
      description: `API route has auth but no role check. Consider adding requireRole or requireRoleOrSelf for defense-in-depth.`,
      file,
      line: 1,
      fileLevel: true,
      category: 'security',
      owasp: 'A07:2021',
      cwe: 285,
    });
  }
}

export const authEnforcerScanner: Scanner = {
  name: 'auth-enforcer',
  description: 'Detects API route files missing authentication and authorization guards',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const idCounter = { value: 1 };
    const defaultIgnore = ['node_modules', 'dist', '.next', '.git'];
    const ignore = [...new Set([...defaultIgnore, ...(config.ignore ?? [])])];

    // --- 1. Classic Next.js/App Router route.ts files ---
    const apiDirs = detectApiDirs(projectPath);

    for (const apiDir of apiDirs) {
      let files: string[];
      try {
        files = walkFiles(apiDir, ignore, ['ts', 'js']);
      } catch {
        continue;
      }

      const routeFiles = files.filter((f) => {
        const basename = f.split('/').pop() ?? '';
        return ROUTE_FILENAMES.includes(basename);
      });

      for (const file of routeFiles) {
        const content = readFileSafe(file);
        if (content === null) continue;
        checkFile(content, file, findings, idCounter);
      }
    }

    // --- 2. Server components (page.tsx) with direct DB access ---
    const serverDirs = detectServerComponentDirs(projectPath);

    for (const dir of serverDirs) {
      let files: string[];
      try {
        files = walkFiles(dir, [...ignore, 'api'], ['tsx', 'ts']);
      } catch {
        continue;
      }

      const pageFiles = files.filter((f) => {
        const basename = f.split('/').pop() ?? '';
        return basename === 'page.tsx' || basename === 'page.ts';
      });

      for (const file of pageFiles) {
        const content = readFileSafe(file);
        if (content === null) continue;

        // Only flag if the page directly accesses a database
        const hasDbAccess = DB_ACCESS_PATTERNS.some((p) => p.test(content));
        if (!hasDbAccess) continue;

        const hasAuthGuard = AUTH_GUARD_PATTERNS.some((p) => p.test(content));
        if (!hasAuthGuard) {
          const id = `AUTH-${String(idCounter.value++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'auth-enforcer',
            severity: 'high',
            title: 'Server component with DB access missing auth guard',
            description: `Server component page directly accesses the database without any recognised auth guard. This may allow unauthenticated data access.`,
            file,
            line: 1,
            fileLevel: true,
            category: 'security',
            owasp: 'A07:2021',
            cwe: 306,
          });
        }
      }
    }

    // --- 3. Express/Fastify-style route handlers ---
    const expressDirs = detectExpressDirs(projectPath);

    for (const dir of expressDirs) {
      let files: string[];
      try {
        files = walkFiles(dir, ignore, ['ts', 'js']);
      } catch {
        continue;
      }

      for (const file of files) {
        const content = readFileSafe(file);
        if (content === null) continue;

        const hasExpressRoute = EXPRESS_ROUTE_PATTERNS.some((p) => p.test(content));
        if (!hasExpressRoute) continue;

        checkFile(content, file, findings, idCounter);
      }
    }

    // --- 4. Check for middleware.ts auth pattern ---
    const middlewarePaths = [
      `${projectPath}/middleware.ts`,
      `${projectPath}/middleware.js`,
      `${projectPath}/src/middleware.ts`,
      `${projectPath}/src/middleware.js`,
    ];

    let hasMiddlewareAuth = false;
    let hasAnyMiddleware = false;

    for (const mwPath of middlewarePaths) {
      if (!existsSync(mwPath)) continue;
      hasAnyMiddleware = true;
      const content = readFileSafe(mwPath);
      if (!content) continue;
      if (MIDDLEWARE_AUTH_PATTERNS.some((p) => p.test(content))) {
        hasMiddlewareAuth = true;
        break;
      }
    }

    if (!hasMiddlewareAuth && hasAnyMiddleware) {
      const middlewareFile = middlewarePaths.find((p) => existsSync(p));
      const id = `AUTH-${String(idCounter.value++).padStart(3, '0')}`;
      findings.push({
        id,
        scanner: 'auth-enforcer',
        severity: 'medium',
        title: 'Middleware exists but has no auth pattern',
        description: `A middleware file was found but does not contain any recognised auth pattern. Middleware is often the best place to enforce authentication globally.`,
        file: middlewareFile,
        line: 1,
        fileLevel: true,
        category: 'security',
        owasp: 'A07:2021',
        cwe: 306,
      });
    }

    return {
      scanner: 'auth-enforcer',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
