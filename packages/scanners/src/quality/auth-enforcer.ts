import ts from 'typescript';
import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { existsSync } from 'fs';
import { parseFile, walkAst } from '../ast/parser.js';
import { stripComments, pageIsGuardedByContext } from '../ast/page-context.js';

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
/**
 * Role-guard patterns recognised as function-call / throw-based helpers.
 *
 * Presence anywhere in the file content is accepted — these helpers throw
 * on missing-role, so merely being called is enough to serve as a guard.
 *
 * v0.10 Z1: the bare `/authorize/` regex previously substring-matched
 * inside `"unauthorized"` / `"authorization"` strings in error responses,
 * silencing the CWE-285 emission on every route with a 401 response
 * body. Replaced with `/\bauthorize\s*\(/` to require the word boundary
 * plus opening paren — function-call shape only.
 */
const ROLE_GUARD_CALL_PATTERNS = [
  /\brequireRole\b/,
  /\brequireRoleOrSelf\b/,
  /\bisManager\b/,
  /\bcheckRole\b/,
  /\bhasRole\b/,
  /\bisAdmin\b/,
  /\bauthorize\s*\(/,                // v0.10 Z1 — word-bound + call shape
  /verifyCurrent(User|Member|Owner)[A-Z]\w*/,
  /user(HasAccess|CanAccess|IsOwner|OwnsResource|CanEdit|CanRead|CanWrite|CanDelete)\w*/,
  /\bcan(Edit|Read|Write|Delete|Access|View)[A-Z]\w*\s*\(/,
  // Clerk role / permission via has({ role:.. }) — call form.
  /\bhas\s*\(\s*\{\s*(?:role|permission)\s*:/,
];

/**
 * Role-guard patterns that are comparison expressions (session equality
 * or Clerk metadata-role equality).
 *
 * v0.10 D1 (full-flow): a comparison like `session.user.id === params.id`
 * only counts as a guard when it is used as a gating condition — inside
 * an IfStatement / ConditionalExpression test / loop condition. A
 * value-capture such as `const isOwn = session.user.id === params.id`
 * does NOT guard subsequent writes. The AST helper `collectGatingText`
 * below returns only the text of gating-position expressions; these
 * patterns are tested against that text, not the whole file.
 *
 * v0.9.3 closed the optional-chaining + reversed-operand + tRPC variants.
 */
const ROLE_GUARD_COMPARISON_PATTERNS = [
  /(?:\bctx\.)?session\??\.user\??\.(?:id|role|email)\s*[!=]==/,
  /[!=]==\s*(?:\bctx\.)?session\??\.user\??\.(?:id|role|email)/,
  /\.(?:userId|authorId|ownerId|createdBy|user_id)\s*[!=]==\s*(?:\bctx\.)?session\??\.user/,
  /(?:\bctx\.)?session\??\.user\??\.id\s*[!=]==\s*\w+\.(?:userId|authorId|ownerId|createdBy|user_id)/,
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

/**
 * Middleware auth patterns (Next.js middleware.ts).
 *
 * v0.11.x Bug C: widened with data-driven additions from 9-project
 * corpus + post-v0.11.0 real-world dogfood. Dominant real-world shapes
 * are next-auth v4 `getServerSession` (5/9 corpus) and `@supabase/ssr`
 * `supabase.auth.getUser()` (observed in the dogfood sample). The
 * original 6-pattern list
 * only covered next-auth-v4-imports (`NextAuth`) and v5-style
 * bare `auth()` — real middleware code using helper calls was
 * missed, producing the "Middleware exists but has no auth pattern"
 * FP on legitimate codebases.
 */
const MIDDLEWARE_AUTH_PATTERNS = [
  /getToken/,
  /withAuth/,
  /\bauth\(\)/,
  /NextAuth/,
  /clerkMiddleware/,
  /authMiddleware/,
  // v0.11.x Bug C additions — all empirically observed in corpus /
  // dogfood scans. Regex shape mirrors the catalog in
  // `middleware-auth-checker` for symmetry.
  /\bgetServerSession\s*\(/,                   // next-auth v4 (5/9 corpus)
  /\bgetServerAuthSession\s*\(/,               // T3-stack helper convention
  /\.auth\.(?:getUser|getSession)\s*\(/,       // Supabase SSR session check
  /\bcurrentUser\s*\(/,                        // Clerk
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

/** Patterns in file content that indicate intentional public access.
 *  Matching any of these suppresses BOTH the missing-auth and the
 *  missing-role-guard emissions — the route is considered fully
 *  exempted. */
const PUBLIC_CONTENT_PATTERNS = [
  /\/\*[\s\S]*?@public\b[\s\S]*?\*\//,       // JSDoc block with @public
  /\/\/[^\n]*@public\b/,                     // Line comment @public
  /requireAuth:\s*false/,                    // Explicit opt-out
  /stripe\.webhooks\.constructEvent/,        // Stripe webhook signature verification
  /verifyWebhookSignature/,                  // Generic webhook signature
  /createHmac\b.*\bdigest\b/,                // HMAC comparison (webhook signature verification)
  /timingSafeEqual\b.*\bhmac\b/i,            // Timing-safe HMAC comparison
];

/** v0.10 D3 — `@self-only` annotation. Route is authenticated (auth
 *  guard still required) but intentionally has no role-guard: every
 *  user acts on their own resources, no admin / moderator separation.
 *  Suppresses CWE-285 only; CWE-306 still fires if auth is missing.
 *  Distinct from @public which suppresses both. */
const SELF_ONLY_CONTENT_PATTERNS = [
  /\/\*[\s\S]*?@self-only\b[\s\S]*?\*\//,
  /\/\/[^\n]*@self-only\b/,
];

/**
 * v0.10 D1 — collect text of expressions used as gating conditions.
 *
 * Only expressions in these positions count:
 *   - IfStatement.expression      — `if (COND) { ... }`
 *   - ConditionalExpression.cond  — `COND ? a : b`
 *   - While/Do loop .expression   — `while (COND) { ... }`
 *   - ForStatement.condition      — `for (init; COND; update) { ... }`
 *   - Logical-AND / Logical-OR / Nullish-coalescing left operand
 *       — `COND && sink()` / `COND || throwFn()` are guard shapes.
 *
 * Value-captures such as `const isOwn = session.user.id === params.id`
 * are NOT in this list; the comparison lives inside a VariableDeclaration
 * initializer which never runs as a control-flow gate.
 */
function collectGatingText(sf: ts.SourceFile): string {
  const parts: string[] = [];
  walkAst(sf, (node) => {
    if (ts.isIfStatement(node)) {
      parts.push(node.expression.getText(sf));
    } else if (ts.isConditionalExpression(node)) {
      parts.push(node.condition.getText(sf));
    } else if (ts.isWhileStatement(node) || ts.isDoStatement(node)) {
      parts.push(node.expression.getText(sf));
    } else if (ts.isForStatement(node) && node.condition) {
      parts.push(node.condition.getText(sf));
    } else if (ts.isBinaryExpression(node)) {
      // Left operand of && / || / ?? when the RHS is an effectful
      // statement-expression — guard-short-circuit shape.
      const kind = node.operatorToken.kind;
      if (
        kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        kind === ts.SyntaxKind.BarBarToken ||
        kind === ts.SyntaxKind.QuestionQuestionToken
      ) {
        parts.push(node.left.getText(sf));
      }
    }
  });
  return parts.join('\n');
}

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

  // v0.10 D1 full-flow: comparison-based role-guards only count when
  // they appear in gating positions (if / ternary / loop / logical-
  // short-circuit). Call-based role-guards (requireRole, hasRole,
  // isAdmin, etc.) count anywhere because those helpers throw on
  // failure and are guards regardless of surrounding syntax.
  let hasRoleGuard = ROLE_GUARD_CALL_PATTERNS.some((p) => p.test(content));
  if (!hasRoleGuard) {
    let sf: ts.SourceFile | null = null;
    try {
      sf = parseFile(file, content);
    } catch {
      // Fallback: if AST parse fails (malformed source), fall back to
      // the old full-content comparison check so this scanner still
      // emits conservatively. Tolerates partial-source edge cases.
      hasRoleGuard = ROLE_GUARD_COMPARISON_PATTERNS.some((p) => p.test(content));
    }
    if (sf) {
      const gatingText = collectGatingText(sf);
      hasRoleGuard = ROLE_GUARD_COMPARISON_PATTERNS.some((p) => p.test(gatingText));
    }
  }

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
    return;
  }

  if (!hasRoleGuard) {
    // v0.10 D3 — `@self-only` suppresses CWE-285 but requires AUTH
    // (already verified above). @public would have suppressed both
    // earlier in the function.
    if (SELF_ONLY_CONTENT_PATTERNS.some((p) => p.test(content))) return;

    const id = `AUTH-${String(idCounter.value++).padStart(3, '0')}`;
    findings.push({
      id,
      scanner: 'auth-enforcer',
      severity: 'low',  // Auth exists, just missing explicit role check — defense-in-depth suggestion
      title: 'Route missing role/authorisation guard',
      description: `API route has auth but no role check in a gating position. Consider adding requireRole / requireRoleOrSelf, or move the ownership comparison inside an if-condition. Intentional self-service routes can opt out with a \`@self-only\` JSDoc or line-comment annotation.`,
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

    // v0.13 AUTH-001 FP fix: track whether at least ONE route handler,
    // server-component page, or express handler uses a recognised auth
    // primitive. Presence is treated as a compensating control that
    // suppresses the middleware-missing-auth finding emitted in step 4.
    // Per-route findings (steps 1-3) continue to fire independently for
    // any route lacking its own guard — over-suppression only applies
    // to the middleware heuristic, not to per-route checks.
    //
    // Note: the tracking is intentionally coarse. A public endpoint like
    // `/api/auth/login/route.ts` (classified public by PUBLIC_ROUTE_PATTERNS)
    // may contain an `authenticate()` call — that will also flip the
    // boolean. Acceptable: the only consequence is suppressing a
    // middleware reminder in an app that already has some auth plumbing.
    let hasAnyRouteAuth = false;

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
        if (!hasAnyRouteAuth && AUTH_GUARD_PATTERNS.some((p) => p.test(content))) {
          hasAnyRouteAuth = true;
        }
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

        // v0.11.x Bug A — strip comments before DB_ACCESS / AUTH_GUARD
        // regex scans. Natural-language prose in comments like
        // `// Stats query (separat, …)` accidentally matches
        // `\bquery\s*\(` otherwise (Z2-comment-leak class applied to
        // auth-enforcer).
        const sanitized = stripComments(content);

        const hasDbAccess = DB_ACCESS_PATTERNS.some((p) => p.test(sanitized));
        if (!hasDbAccess) continue;

        const hasAuthGuard = AUTH_GUARD_PATTERNS.some((p) => p.test(sanitized));
        if (hasAuthGuard) {
          hasAnyRouteAuth = true;
          continue;
        }

        // v0.11.x Bug B — App-Router parent-layout + middleware-matcher
        // awareness. The page may be legitimately protected by a
        // FAIL-CLOSED auth guard in a parent layout.tsx or by a
        // middleware with a matching path-matcher. Suppress when either
        // source confidently protects the page.
        if (pageIsGuardedByContext(file, projectPath)) {
          hasAnyRouteAuth = true;
          continue;
        }

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

        if (!hasAnyRouteAuth && AUTH_GUARD_PATTERNS.some((p) => p.test(content))) {
          hasAnyRouteAuth = true;
        }
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

    // v0.13 AUTH-001 FP fix: suppress the middleware-missing-auth finding
    // when ≥1 route / page / express handler already uses a recognised
    // auth primitive. This is the "per-route auth architecture" pattern
    // (e.g. auth delegated to route handlers via secureApiRouteWithTenant
    // or layout.tsx auth-guards). Per-route findings (steps 1-3) still
    // fire independently for handlers missing their own guard, so
    // partial-auth apps are not silently over-suppressed.
    if (!hasMiddlewareAuth && hasAnyMiddleware && !hasAnyRouteAuth) {
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
