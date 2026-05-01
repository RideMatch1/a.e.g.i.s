import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/**
 * Payment-Flow Checker — detects payment-SDK calls (Stripe / Razorpay /
 * similar) where the `amount` / `unit_amount` / `unit_amount_decimal` /
 * `price` field is sourced from client-controlled input (request body,
 * URL search-params, query string) instead of a server-side DB lookup.
 *
 * v0.17.7 F-PRICE-TAMPER-1 — sourced from 2026-04-29 Round-3 dogfood
 * scan (scootmart-marketplace `/api/checkout` accepted `priceAed` from
 * request body and passed it verbatim to Stripe Checkout). An attacker
 * POSTs `{priceAed: 1}` and pays one cent for a 50,000-AED item.
 *
 * Detection emits CRITICAL when a payment-SDK call's amount field is
 * resolved to one of:
 *   - direct: body.X / req.json() / searchParams.get(...) / req.query.X
 *   - indirect: identifier bound earlier to one of the above (destructure
 *               from body / await req.json() / property access on a
 *               tainted root)
 *
 * Safe (no fire):
 *   - amount sourced from a DB lookup (`product.priceCents` where
 *     `product` is `await db.X.findUnique(...)`)
 *   - hardcoded numeric literal
 *
 * OWASP A04:2021 (Insecure Design)
 * CWE-602 (Client-Side Enforcement of Server-Side Security)
 */

const PAYMENT_SDK_CALL_PATTERNS: RegExp[] = [
  // Stripe SDK
  /\b(?:stripe|stripeClient|stripeServer)\.checkout\.sessions\.create\s*\(/,
  /\b(?:stripe|stripeClient|stripeServer)\.paymentIntents\.create\s*\(/,
  /\b(?:stripe|stripeClient|stripeServer)\.subscriptions\.create\s*\(/,
  /\b(?:stripe|stripeClient|stripeServer)\.invoiceItems\.create\s*\(/,
  // Custom wrappers commonly used in app codebases
  /\bcreateCheckoutSession\s*\(/,
  /\bcreatePaymentIntent\s*\(/,
  /\bcreateStripeCheckout\s*\(/,
  // Razorpay SDK
  /\b(?:Razorpay|razorpay|razorpayClient)\.orders\.create\s*\(/,
  /\b(?:Razorpay|razorpay|razorpayClient)\.payments\.create\s*\(/,
  // Destructured (e.g. const { paymentIntents } = stripe)
  /\bpaymentIntents\.create\s*\(/,
  /\bcheckoutSessions?\.create\s*\(/,
];

// 'g'-flagged copies built once at module init for matchAll usage in scan().
// v0.17.8 LOW-001 — prevents per-file RegExp construction in the inner loop.
const PAYMENT_SDK_CALL_PATTERNS_GLOBAL: RegExp[] = PAYMENT_SDK_CALL_PATTERNS.map(
  (p) => new RegExp(p.source, p.flags.includes('g') ? p.flags : 'g' + p.flags),
);

/** Field names whose value MUST be server-controlled in payment-SDK calls.
 *  `quantity` is included alongside the amount-class fields because Stripe
 *  Checkout `line_items[i].quantity` accepts any integer (including
 *  negatives), and a tainted quantity multiplied against a fixed `price`
 *  is the same vuln-class as a tainted amount (refund-forge / arbitrary
 *  multiplication). v0.17.8 HIGH-005 closure.
 *
 *  Long-form (`amount: <expr>`) and ES6 shorthand (`{ amount, ... }`) both
 *  apply; for shorthand the value is the field name itself, treated as an
 *  identifier. */
const SENSITIVE_PAYMENT_FIELDS =
  'amount|unit_amount|unit_amount_decimal|price|amount_in_cents|amount_due|quantity';
const AMOUNT_LONGFORM_RE = new RegExp(
  `(?:^|[\\{,\\s])(${SENSITIVE_PAYMENT_FIELDS})\\s*:\\s*([^,\\n}]+?)(?=\\s*[,\\n}])`,
  'g',
);
const AMOUNT_SHORTHAND_RE = new RegExp(
  `(?:^|[\\{,])\\s*(${SENSITIVE_PAYMENT_FIELDS})\\s*(?=[,}\\n])`,
  'g',
);

/** Direct taint sources that may appear inline as the value expression.
 *  v0.17.8 HIGH-003: cookies / headers added (Next.js 13+ App Router idioms).
 *  v0.17.8 HIGH-004: tRPC `input.X` added (post-Zod-parse procedure args). */
const DIRECT_TAINT_SOURCE_PATTERNS: RegExp[] = [
  /\bbody\.[a-zA-Z_$][\w$]*/,
  /\bbody\[\s*['"][^'"]+['"]\s*\]/,
  /\b(?:await\s+)?(?:req|request)\.json\s*\(\s*\)/,
  /\.searchParams\.get\s*\(/,
  /\bsearchParams\.get\s*\(/,
  /\b(?:req|request)\.query\.[a-zA-Z_$][\w$]*/,
  /\b(?:req|request)\.body\.[a-zA-Z_$][\w$]*/,
  /\bformData\.get\s*\(/,
  // v0.17.8 — Next.js 13+ App Router cookie / header taint sources
  /\bcookies\s*\(\s*\)\s*\.get\s*\(/,
  /\.cookies\s*\.get\s*\(/,
  /\bheaders\s*\(\s*\)\s*\.get\s*\(/,
  /\.headers\s*\.get\s*\(/,
  // v0.17.8 — tRPC procedure input is post-Zod-parsed body, NOT
  // semantically-validated (Zod checks shape, not authorisation)
  /\binput\.[a-zA-Z_$][\w$]*/,
];

/** Identifier names treated as implicitly-tainted body roots when no
 *  explicit binding is observed (Next.js / Express / tRPC idiom).
 *  v0.17.8 HIGH-004: `input` added (tRPC procedure parameter). */
const IMPLICIT_TAINT_ROOTS = new Set(['body', 'request', 'req', 'input']);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findLineNumber(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

/** Walk forward from `(` and return the substring up to the matching `)`,
 *  inclusive. Skips parens inside string literals. */
function extractCallArgumentBlock(content: string, openParenIndex: number): string | null {
  if (content[openParenIndex] !== '(') return null;
  let depth = 0;
  let i = openParenIndex;
  while (i < content.length) {
    const c = content[i];
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < content.length && content[i] !== quote) {
        if (content[i] === '\\') i += 2;
        else i++;
      }
      i++;
      continue;
    }
    if (c === '/' && content[i + 1] === '/') {
      while (i < content.length && content[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && content[i + 1] === '*') {
      i += 2;
      while (i < content.length - 1 && !(content[i] === '*' && content[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return content.slice(openParenIndex, i + 1);
    }
    i++;
  }
  return null;
}

/** Walk forward from `openIdx` (must point at `openCh`) and return the
 *  index of the matching `closeCh`. Skips string literals and balances
 *  nested pairs. Returns -1 if unmatched. */
function findBalancedClose(
  content: string,
  openIdx: number,
  openCh: string,
  closeCh: string,
): number {
  if (content[openIdx] !== openCh) return -1;
  let depth = 0;
  for (let i = openIdx; i < content.length; i++) {
    const c = content[i];
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < content.length && content[i] !== quote) {
        if (content[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (c === openCh) depth++;
    else if (c === closeCh) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Extract every identifier *bound* (not used as a key) inside a
 *  destructure pattern body. Walks the pattern and skips identifiers
 *  immediately followed by `:` (those are KEY names, the bound name
 *  comes after the colon and is captured separately). Handles nested
 *  destructures naturally because we just keep walking the inner
 *  brace contents.
 *
 *  Examples:
 *    `amount`               -> ['amount']
 *    `data: { amount }`     -> ['amount']         (HIGH-001)
 *    `data: { amount: x }`  -> ['x']
 *    `a, b: { c, d }`       -> ['a', 'c', 'd']
 *    `a = 0`                -> ['a']               (default values)
 */
function extractBoundIdentifiersFromDestructure(pattern: string): string[] {
  const result: string[] = [];
  const re = /[a-zA-Z_$][\w$]*/g;
  let m;
  while ((m = re.exec(pattern)) !== null) {
    const id = m[0];
    const after = pattern.slice(m.index + id.length);
    if (/^\s*:/.test(after)) continue; // KEY name, not a bound name
    result.push(id);
  }
  return result;
}

/** Build the set of identifiers proven tainted by client-controlled
 *  input. v0.17.8 rewrite: nested-destructure aware (HIGH-001),
 *  spread-rebound aware (HIGH-002), cookies/headers/formData binding
 *  aware (HIGH-003 + HIGH-006), tRPC `input` aware (HIGH-004). */
function gatherTaintedIdentifiers(content: string): Set<string> {
  const tainted = new Set<string>();
  const taintedRoots = new Set<string>();

  // Pass 1 — root bindings: identifier = <user-input expression>.
  // Each pattern below makes the bound identifier a "tainted root":
  // its property accesses propagate taint via Pass 3.
  const rootBindingPatterns: RegExp[] = [
    /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*await\s+(?:req|request)\.json\s*\(\s*\)/g,
    /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*await\s+(?:req|request)\.formData\s*\(\s*\)/g,
    /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:req|request)\.body\b/g,
    // v0.17.8 HIGH-002 — spread-rebound: `const X = { ...(await req.json()) }`
    // wraps the parsed body into a fresh object. X.Y is still tainted.
    /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*\{\s*\.\.\.\s*\(?\s*await\s+(?:req|request)\.(?:json|formData)\s*\(/g,
    /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*\{\s*\.\.\.\s*(?:req|request)\.body\b/g,
  ];
  for (const re of rootBindingPatterns) {
    for (const m of content.matchAll(re)) {
      taintedRoots.add(m[1]);
      tainted.add(m[1]);
    }
  }

  // Pass 2 — destructure (single- or nested-level) from any tainted
  // root (explicit-binding or implicit-by-convention) OR direct from
  // an inline await req.json() / req.body. Uses balanced-brace
  // matching so nested patterns like `const { data: { amount } } = ...`
  // surface every bound name (HIGH-001 closure).
  const allRoots = new Set<string>([...IMPLICIT_TAINT_ROOTS, ...taintedRoots]);
  const allRootsAlt = Array.from(allRoots).map(escapeRegex).join('|');
  const inlineRoots = [
    `await\\s+(?:req|request)\\.json\\s*\\(\\s*\\)`,
    `await\\s+(?:req|request)\\.formData\\s*\\(\\s*\\)`,
    `(?:req|request)\\.body\\b`,
    `(?:req|request)\\.query\\b`,
  ].join('|');
  const tailMatcher = new RegExp(
    `^\\s*=\\s*(?:(?:${allRootsAlt})\\b|${inlineRoots})`,
  );

  const destructureStart = /(?:const|let|var)\s+(\{)/g;
  let dm: RegExpExecArray | null;
  while ((dm = destructureStart.exec(content)) !== null) {
    const braceIdx = dm.index + dm[0].length - 1;
    const closeIdx = findBalancedClose(content, braceIdx, '{', '}');
    if (closeIdx < 0) continue;
    if (!tailMatcher.test(content.slice(closeIdx + 1))) continue;
    const inner = content.slice(braceIdx + 1, closeIdx);
    for (const id of extractBoundIdentifiersFromDestructure(inner)) {
      tainted.add(id);
    }
  }

  // Pass 3 — property assignment from any tainted root: `const X = root.Y`
  for (const root of allRoots) {
    const re = new RegExp(
      `(?:const|let|var)\\s+([a-zA-Z_$][\\w$]*)\\s*=\\s*${escapeRegex(root)}\\.[a-zA-Z_$][\\w$]*`,
      'g',
    );
    for (const m of content.matchAll(re)) tainted.add(m[1]);
  }

  // Pass 4 — getter-style taint sources bound to an identifier.
  // Handles:
  //   const x = searchParams.get('y')
  //   const x = req.query.y
  //   const x = formData.get('y')                       (HIGH-006)
  //   const x = cookies().get('y')?.value               (HIGH-003)
  //   const x = headers().get('y')                      (HIGH-003)
  //   const x = Number(formData.get('y'))               (coerce wrapper)
  // The leading prefix `(?:[^;=\n]*?\.)?` allows a property-chain or
  // function-call wrapper before the getter (e.g. `Number(`,
  // `parseInt(`, `(req as any).`).
  const getterBindingPatterns: RegExp[] = [
    /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*[^;\n]*?\bsearchParams\s*\.\s*get\s*\(/g,
    /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*[^;\n]*?\bformData\s*\.\s*get\s*\(/g,
    /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*[^;\n]*?\bcookies\s*\(\s*\)\s*\.\s*get\s*\(/g,
    /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*[^;\n]*?\bheaders\s*\(\s*\)\s*\.\s*get\s*\(/g,
    /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:req|request)\.query\.[a-zA-Z_$][\w$]*/g,
  ];
  for (const re of getterBindingPatterns) {
    for (const m of content.matchAll(re)) tainted.add(m[1]);
  }

  return tainted;
}

interface TaintVerdict {
  tainted: boolean;
  reason?: string;
}

function isMetadataNested(callBlock: string, fieldMatchIndex: number): boolean {
  // Heuristic: walk back from fieldMatchIndex looking for `metadata: {`. If we
  // find one before the matching open-brace at our level, the field is inside
  // a metadata object — Stripe metadata accepts arbitrary client-supplied
  // string tags, so amount-tampering isn't applicable.
  const before = callBlock.slice(0, fieldMatchIndex);
  const lastMetadata = before.lastIndexOf('metadata');
  if (lastMetadata < 0) return false;
  // Crude: count `{` and `}` between lastMetadata and fieldMatchIndex.
  // If `{` count > `}` count, we're inside the metadata object.
  let opens = 0;
  let closes = 0;
  for (let i = lastMetadata; i < fieldMatchIndex; i++) {
    if (before[i] === '{') opens++;
    else if (before[i] === '}') closes++;
  }
  return opens > closes;
}

function evaluateAmountExpression(expr: string, tainted: Set<string>): TaintVerdict {
  const trimmed = expr.trim();

  // Numeric literal — safe.
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return { tainted: false };
  // String numeric literal — safe.
  if (/^['"]-?\d+(\.\d+)?['"]$/.test(trimmed)) return { tainted: false };

  // Direct taint sources.
  for (const re of DIRECT_TAINT_SOURCE_PATTERNS) {
    if (re.test(trimmed)) return { tainted: true, reason: `direct user-input source (${re.source})` };
  }

  // Identifier propagation. Strip operators / parens / numeric coercions
  // and check each remaining identifier against the tainted set.
  const identifiers = trimmed.match(/[a-zA-Z_$][\w$]*/g) ?? [];
  const knownSafeBuiltins = new Set([
    'Number', 'parseInt', 'parseFloat', 'Math', 'BigInt', 'String',
    'round', 'floor', 'ceil', 'abs', 'min', 'max', 'pow',
  ]);
  for (const id of identifiers) {
    if (knownSafeBuiltins.has(id)) continue;
    if (tainted.has(id)) {
      return { tainted: true, reason: `identifier '${id}' bound to user-input` };
    }
  }
  return { tainted: false };
}

export const paymentFlowCheckerScanner: Scanner = {
  name: 'payment-flow-checker',
  description:
    "Detects payment-SDK calls (Stripe / Razorpay / similar) where `amount` / `unit_amount` / `price` is sourced from client-controlled input rather than a server-side DB lookup. Direct revenue-impact CWE class.",
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;
    const defaultIgnore = ['node_modules', 'dist', '.next', '.git', 'build', 'coverage'];
    const ignore = [...new Set([...defaultIgnore, ...(config.ignore ?? [])])];

    const files = walkFiles(projectPath, ignore, ['ts', 'tsx', 'js', 'jsx', 'mjs']);

    for (const file of files) {
      if (/\.(test|spec|e2e)\.[tj]sx?$/i.test(file)) continue;
      const content = readFileSafe(file);
      if (content === null) continue;

      // Skip 'use client' files — payment SDKs are server-only; client files
      // wrapping Stripe.js are non-issue. Scan first ~30 lines so a long
      // JSDoc / copyright banner above the directive does not push it past
      // a fixed byte cap (v0.17.8 MED-001 closure).
      const headLines = content.split('\n').slice(0, 30).join('\n');
      if (/^\s*['"]use client['"];?\s*$/m.test(headLines)) continue;

      // Cheap reject: no payment-SDK call patterns? skip the file entirely.
      if (!PAYMENT_SDK_CALL_PATTERNS.some((p) => p.test(content))) continue;

      const tainted = gatherTaintedIdentifiers(content);
      const seenCallSites = new Set<number>();

      for (const sdkPattern of PAYMENT_SDK_CALL_PATTERNS_GLOBAL) {
        for (const match of content.matchAll(sdkPattern)) {
          const callStart = match.index!;
          if (seenCallSites.has(callStart)) continue;
          seenCallSites.add(callStart);

          // The pattern ends with `(`; that's our open-paren index.
          const openParenIndex = callStart + match[0].length - 1;
          const callBlock = extractCallArgumentBlock(content, openParenIndex);
          if (!callBlock) continue;

          const fieldHits: Array<{ fieldName: string; valueExpr: string; indexInBlock: number }> = [];
          for (const fieldMatch of callBlock.matchAll(AMOUNT_LONGFORM_RE)) {
            fieldHits.push({
              fieldName: fieldMatch[1],
              valueExpr: fieldMatch[2],
              indexInBlock: fieldMatch.index!,
            });
          }
          for (const fieldMatch of callBlock.matchAll(AMOUNT_SHORTHAND_RE)) {
            fieldHits.push({
              fieldName: fieldMatch[1],
              valueExpr: fieldMatch[1], // shorthand: identifier = field name
              indexInBlock: fieldMatch.index!,
            });
          }
          const seenFieldOffsets = new Set<number>();
          for (const { fieldName, valueExpr, indexInBlock } of fieldHits) {
            if (seenFieldOffsets.has(indexInBlock)) continue;
            seenFieldOffsets.add(indexInBlock);

            if (isMetadataNested(callBlock, indexInBlock)) continue;

            const verdict = evaluateAmountExpression(valueExpr, tainted);
            if (!verdict.tainted) continue;

            const id = `PRICE-${String(idCounter++).padStart(3, '0')}`;
            findings.push({
              id,
              scanner: 'payment-flow-checker',
              severity: 'critical',
              title: `Payment-SDK call uses client-controlled '${fieldName}' field — price-tampering risk`,
              description:
                `A payment-SDK call sets '${fieldName}' from a client-controlled source (${verdict.reason}). ` +
                `An attacker can supply any value — including 1 cent — to charge themselves arbitrarily for a ` +
                `paid resource. The amount must come from a server-side database lookup keyed by a server-validated ` +
                `product / listing / SKU ID. Recommended pattern: load the product row from the DB by the validated ID, ` +
                `then derive the amount from the row's price field. Never trust client-supplied price values, even ` +
                `as multipliers (the multiplier itself can be a tainted source).`,
              file,
              line: findLineNumber(content, callStart),
              category: 'security',
              owasp: 'A04:2021',
              cwe: 602,
              fix: {
                description:
                  `Source '${fieldName}' from a server-side DB lookup keyed by a validated product / listing / SKU ID. ` +
                  `For Stripe Checkout, prefer pre-created Price objects (\`line_items: [{ price: 'price_XXX', quantity: 1 }]\`) ` +
                  `or build \`price_data\` with the unit_amount taken from the product row.`,
                code:
                  "// Server-controlled amount from DB lookup\n" +
                  "const { productId } = await req.json();\n" +
                  "const product = await db.product.findUnique({ where: { id: productId } });\n" +
                  "if (!product || !product.active) {\n" +
                  "  return NextResponse.json({ error: 'Not found' }, { status: 404 });\n" +
                  "}\n" +
                  "const session = await stripe.checkout.sessions.create({\n" +
                  "  line_items: [{\n" +
                  "    price_data: {\n" +
                  "      currency: product.currency,\n" +
                  "      product_data: { name: product.name },\n" +
                  "      unit_amount: product.priceCents, // <- from DB, not request\n" +
                  "    },\n" +
                  "    quantity: 1,\n" +
                  "  }],\n" +
                  "  mode: 'payment',\n" +
                  "});",
                links: [
                  'https://cwe.mitre.org/data/definitions/602.html',
                  'https://owasp.org/Top10/A04_2021-Insecure_Design/',
                  'https://stripe.com/docs/api/prices/create',
                ],
              },
            });
          }
        }
      }
    }

    return {
      scanner: 'payment-flow-checker',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
