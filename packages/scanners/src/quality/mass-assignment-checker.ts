import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

const ROUTE_FILENAMES = ['route.ts', 'route.js'];

function detectApiDirs(projectPath: string): string[] {
  return [
    `${projectPath}/src/app/api`,
    `${projectPath}/app/api`,
    `${projectPath}/pages/api`,
  ];
}

function findLineNumber(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

/**
 * Patterns that indicate the request body is read.
 *
 * v0.9.2 (validator MAJOR-01): accept both `req` and `request` as
 * handler-parameter aliases. Next.js App Router allows either name for
 * the incoming `NextRequest` argument; the `req` abbreviation is
 * extremely common in the ecosystem. Previously only `request.json()`
 * matched, so every codebase using `const body = await req.json()`
 * silently bypassed the detection. Kept symmetric with
 * `packages/scanners/src/ast/sources.ts` TAINT_SOURCES which already
 * handles both aliases.
 */
const REQUEST_JSON_PATTERN = /await\s+(?:req|request)\.json\s*\(\s*\)/;

/** Patterns that indicate the raw body is passed directly to a DB operation */
const RAW_DB_PATTERNS = [
  // Supabase: .insert(body|data|payload|...) / .update(...) / .upsert(...)
  /\.(insert|update|upsert)\s*\(\s*(?:body|data|payload|params|input|values)\s*\)/,
  // Prisma: prisma.*.create({ data: body|data|payload|... }) / .update / .upsert
  // v0.10 Z5: `[^}]*` cannot cross `}` so the realistic nested shape
  // `{ where: { id }, data: body }` escaped detection. Replaced with a
  // balanced-brace expression that allows one level of nested objects —
  // covers the standard `where: { ... }, data: body` Prisma mutation shape.
  /prisma\s*\.\s*\w+\s*\.\s*(?:create|update|upsert)\s*\(\s*\{(?:[^{}]|\{[^{}]*\})*data\s*:\s*(?:body|data|payload|params|input|values)\b/,
  // Inline: .insert(await req.json()) / .update(await request.json()) / .upsert(...) — either alias
  /\.(insert|update|upsert)\s*\(\s*await\s+(?:req|request)\.json\s*\(\s*\)\s*\)/,
];

/** Patterns that indicate the body is sanitised before DB use.
 *  If ANY of these are found, the file is considered mitigated. */
const MITIGATION_PATTERNS = [
  // Zod parse / safeParse — either alias
  /\.parse\s*\(\s*(?:body|await\s+(?:req|request)\.json\s*\(\s*\))/,
  /\.safeParse\s*\(\s*(?:body|await\s+(?:req|request)\.json\s*\(\s*\))/,
  // Any safeParse or parseAsync call anywhere in the file
  /\.safeParse\s*\(/,
  /\.parseAsync\s*\(/,
  /\.safeParseAsync\s*\(/,
  // Explicit field destructuring from body/data/payload/params/input/values
  /const\s*\{[^}]+\}\s*=\s*(?:body|data|payload|params|input|values)/,
  // Inline destructure direct from the await — either alias
  /const\s*\{[^}]+\}\s*=\s*await\s+(?:req|request)\.json/,
];

function hasMitigation(content: string): boolean {
  return MITIGATION_PATTERNS.some((p) => p.test(content));
}

/**
 * v0.17.7 F-MASS-1: Sensitive field names that, when destructured from the
 * request body, indicate mass-assignment-class privilege escalation even
 * if "explicit field destructuring" appears as a mitigation.
 *
 * Source: 2026-04-29 Round-3 dogfood. Pre-v0.17.7 the destructuring check
 * (MITIGATION_PATTERNS line 57-59) treated `const {role, permissions, ...}
 * = await req.json()` as mitigated — but if `role` or `is_admin` are in
 * the destructure-set, the attacker CAN still set them by including those
 * keys in the JSON body. The destructure is the SAME bug as raw insert,
 * just with explicit field names.
 *
 * Field selection criteria:
 *   1. Names that map directly to authorization columns: role, permissions,
 *      is_admin, is_staff, is_verified, scopes, capabilities.
 *   2. Tenant-scoping keys: tenant_id, tenantId, org_id, orgId,
 *      workspace_id, workspaceId. Setting these from the body lets an
 *      attacker insert into another tenant's scope.
 *   3. Subscription/billing state: tier, plan, subscription_status,
 *      credits, balance — escalation to paid tiers / fraud.
 *   4. Identity-binding keys: userId, user_id, ownerId, owner_id —
 *      letting an attacker create rows owned by another user.
 *   5. Email-verification flags: email_verified, emailVerified,
 *      verified — bypassing email confirmation.
 */
const SENSITIVE_FIELD_NAMES = [
  // Authorization
  'role', 'roles', 'permissions', 'permission',
  'is_admin', 'isAdmin', 'is_staff', 'isStaff',
  'is_verified', 'isVerified', 'verified',
  'is_superuser', 'isSuperuser', 'admin',
  'scopes', 'scope', 'capabilities', 'privileges',
  // Tenant-scoping
  'tenant_id', 'tenantId', 'org_id', 'orgId',
  'workspace_id', 'workspaceId', 'team_id', 'teamId',
  // Subscription / billing
  'tier', 'plan', 'subscription_status', 'subscriptionStatus',
  'credits', 'balance', 'subscription_tier', 'subscriptionTier',
  // Identity-binding
  'userId', 'user_id', 'ownerId', 'owner_id', 'createdBy', 'created_by',
  // Email-verification
  'email_verified', 'emailVerified',
];

/** Build a regex that matches any sensitive field name as an
 *  identifier inside a destructure pattern. Word-bound so longer
 *  identifiers (e.g. `role_description`) don't accidentally match. */
const SENSITIVE_FIELD_RE = new RegExp(
  `\\b(?:${SENSITIVE_FIELD_NAMES.join('|')})\\b`,
);

/**
 * F-MASS-1: detect destructure-from-body where the destructured set
 * includes a sensitive field. Pattern:
 *
 *   const { ..., role, ... } = await request.json();
 *   const { ..., is_admin, ... } = body;
 *
 * Returns true when both:
 *   1. A `const { ... } = body|data|payload|params|input|values|await req.json()`
 *      destructure exists.
 *   2. The brace-content includes at least one sensitive field name.
 *
 * The presence of a `pick`/Zod-strict parse in the file still suppresses
 * the finding (see hasZodStrictParse below) — F-MASS-1 only fires when
 * there's NO validation boundary AND the destructure-set is harmful.
 */
function hasSensitiveDestructureFromBody(content: string): boolean {
  // Match destructure from request body (either `body|data|...` alias
  // or inline `await req.json()`). Capture the brace-content for the
  // sensitive-name scan.
  const re = /const\s*\{([^}]+)\}\s*=\s*(?:body|data|payload|params|input|values|await\s+(?:req|request)\.json\s*\(\s*\))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const brace = match[1];
    if (SENSITIVE_FIELD_RE.test(brace)) return true;
  }
  return false;
}

/**
 * F-MASS-1 (variant): detect supabase.auth.signUp options.data containing
 * sensitive fields sourced from user input.
 *
 * Pattern:
 *   supabase.auth.signUp({
 *     email,
 *     password,
 *     options: { data: { role, full_name } }   // ← sensitive field in data
 *   })
 *
 * The Supabase signUp `options.data` payload becomes user_metadata,
 * which is often consumed by RLS policies (`auth.jwt() ->>
 * 'user_metadata' ->> 'role'`). User-controlled `role` here = RLS
 * bypass.
 */
function hasSupabaseSignupSensitiveData(content: string): boolean {
  // Find supabase.auth.signUp(...) calls
  const signupRe = /\.auth\.signUp\s*\(\s*\{([\s\S]{0,500}?)\}\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = signupRe.exec(content)) !== null) {
    const args = match[1];
    // Look for `options: { data: { ... <sensitive> ... } }` shape
    const dataRe = /options\s*:\s*\{[^{}]*data\s*:\s*\{([^}]+)\}/;
    const dataMatch = dataRe.exec(args);
    if (dataMatch && SENSITIVE_FIELD_RE.test(dataMatch[1])) return true;
  }
  return false;
}

/** Detect Zod-strict-parse-followed-by-DB pattern. Strict Zod schemas
 *  reject unknown keys at the boundary, so even sensitive-name fields
 *  in the schema's pick-list cannot be exploited (the schema enforces
 *  enum/type constraints). This is the canonical safe pattern and
 *  must NOT be flagged.
 *
 *  Heuristic: file uses `.strict()` chained on a Zod schema OR
 *  declares a `z.object({...}).strict()` schema definition. */
function hasZodStrictParse(content: string): boolean {
  return /\.strict\s*\(\s*\)\s*\.parse\s*\(/.test(content) ||
         /\.strict\s*\(\s*\)\s*\.safeParse\s*\(/.test(content) ||
         /z\.object\s*\([^)]*\)\s*\.strict\s*\(\s*\)/.test(content);
}

function hasRequestJson(content: string): boolean {
  return REQUEST_JSON_PATTERN.test(content);
}

function hasRawDbWrite(content: string): boolean {
  return RAW_DB_PATTERNS.some((p) => p.test(content));
}

export const massAssignmentCheckerScanner: Scanner = {
  name: 'mass-assignment-checker',
  description: 'Detects API routes where an unvalidated request body is passed directly to a database write operation',
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

        // Must read request body
        if (!hasRequestJson(content)) continue;

        // v0.17.7 F-MASS-1: separate paths.
        //   Path A (legacy): request body flows raw into a DB write
        //     (.insert(body), .update(payload), prisma.x.create({data: body}), ...)
        //     — original v0.13 detection. Skip if Zod or destructuring mitigates.
        //   Path B (F-MASS-1): destructure includes a SENSITIVE field name
        //     (role, is_admin, tenant_id, ...). Mitigated only by Zod-strict.
        //   Path C (F-MASS-1): supabase.auth.signUp options.data contains
        //     sensitive fields. Mitigated only by Zod-strict.
        const sensitiveDestructure = hasSensitiveDestructureFromBody(content);
        const supabaseSignupSensitive = hasSupabaseSignupSensitiveData(content);
        const rawDbWrite = hasRawDbWrite(content);

        if (!sensitiveDestructure && !supabaseSignupSensitive && !rawDbWrite) {
          continue;
        }

        // Path A mitigation: Zod parse / destructuring covers the raw-write
        // case. Does NOT cover Path B / C (sensitive fields are in scope
        // even when destructured, and Supabase signUp data flows directly).
        if (rawDbWrite && !sensitiveDestructure && !supabaseSignupSensitive) {
          if (hasMitigation(content)) continue;
        }

        // Path B / C mitigation: ONLY Zod-strict-parse is sufficient.
        // Bare destructuring is the bug — F-MASS-1's whole point.
        if (sensitiveDestructure || supabaseSignupSensitive) {
          if (hasZodStrictParse(content)) continue;
        }

        // Find the line of the first relevant emission point. Prefer the
        // sensitive-destructure line (F-MASS-1), then signup, then DB-write.
        let lineNumber = 1;
        if (sensitiveDestructure) {
          const re = /const\s*\{([^}]+)\}\s*=\s*(?:body|data|payload|params|input|values|await\s+(?:req|request)\.json\s*\(\s*\))/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(content)) !== null) {
            if (SENSITIVE_FIELD_RE.test(m[1])) {
              lineNumber = findLineNumber(content, m.index);
              break;
            }
          }
        } else if (supabaseSignupSensitive) {
          const m = /\.auth\.signUp\s*\(/.exec(content);
          if (m) lineNumber = findLineNumber(content, m.index);
        } else {
          for (const pattern of RAW_DB_PATTERNS) {
            const match = pattern.exec(content);
            if (match) {
              lineNumber = findLineNumber(content, match.index);
              break;
            }
          }
        }

        const id = `MASS-${String(idCounter.value++).padStart(3, '0')}`;
        // v0.15.4 D-N-002 — include route path in title so multi-finding
        // reports differentiate per-route rather than repeating.
        const routePath = file.match(/\/api\/(.+?)\/route\.(?:ts|js)$/)?.[1] ?? '';
        const titleSuffix = routePath ? ` (/api/${routePath})` : '';
        // v0.17.7 F-MASS-1: distinguish title by detection path.
        let title: string;
        let detail: string;
        if (sensitiveDestructure) {
          title = `Mass assignment: sensitive field destructured from request body${titleSuffix}`;
          detail =
            'The request body destructure includes a sensitive field (role / permissions / is_admin / tenant_id / userId / etc.) that flows into a database write. Even though the destructure is "explicit", the attacker can still POST {role: "admin"} because the sensitive field is in scope. Use a Zod schema with .strict() to enforce both the field-set AND value constraints (e.g. z.enum(["customer", "guest"])).';
        } else if (supabaseSignupSensitive) {
          title = `Mass assignment: supabase.auth.signUp options.data contains sensitive fields${titleSuffix}`;
          detail =
            'supabase.auth.signUp() is called with options.data containing user-controlled sensitive fields (role / permissions / etc.). These become user_metadata, often consumed by RLS policies. An attacker POSTing {role: "admin"} gets user_metadata.role = "admin" — potential RLS bypass. Hardcode the role server-side, or validate via Zod-strict-enum against an allowlist of safe roles before signUp.';
        } else {
          title = `Mass assignment: raw request body passed directly to database${titleSuffix}`;
          detail =
            'The request body from request.json() is passed directly to a database insert/update/upsert without Zod validation or explicit field destructuring. This allows attackers to set arbitrary fields, including privilege columns like role, tenantId, or isAdmin. Validate with a Zod schema or destructure only the expected fields.';
        }
        findings.push({
          id,
          scanner: 'mass-assignment-checker',
          severity: 'high',
          title,
          description: detail,
          file,
          line: lineNumber,
          category: 'security',
          owasp: 'A08:2021',
          cwe: 915,
          fix: {
            description:
              'Always parse the body through a Zod schema with .strict() so unknown fields throw instead of silently flowing into the database — an attacker cannot set role: "admin" or tenantId: "other" if those keys are rejected at the validation boundary. For role-like fields, the schema must constrain values via z.enum(["customer", "guest"]) so even a known field-name cannot carry an unsafe value. Read only the validated output into the insert, never the raw body.',
            code: "const input = CreateOrderSchema.strict().parse(await request.json());\nawait db.insert('orders', { userId: auth.userId, productId: input.productId, qty: input.qty });",
            links: [
              'https://cwe.mitre.org/data/definitions/915.html',
              'https://owasp.org/www-community/attacks/Mass_Assignment_Cheat_Sheet',
            ],
          },
        });
      }
    }

    return {
      scanner: 'mass-assignment-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
