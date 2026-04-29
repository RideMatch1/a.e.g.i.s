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

/** Field names whose value MUST be server-controlled in payment-SDK calls.
 *  Long-form (`amount: <expr>`) and ES6 shorthand (`{ amount, ... }`) both
 *  apply; for shorthand the value is the field name itself, treated as an
 *  identifier. */
const AMOUNT_LONGFORM_RE =
  /(?:^|[\{,\s])(amount|unit_amount|unit_amount_decimal|price|amount_in_cents|amount_due)\s*:\s*([^,\n}]+?)(?=\s*[,\n}])/g;
const AMOUNT_SHORTHAND_RE =
  /(?:^|[\{,])\s*(amount|unit_amount|unit_amount_decimal|price|amount_in_cents|amount_due)\s*(?=[,}\n])/g;

/** Direct taint sources that may appear inline as the value expression. */
const DIRECT_TAINT_SOURCE_PATTERNS: RegExp[] = [
  /\bbody\.[a-zA-Z_$][\w$]*/,
  /\bbody\[\s*['"][^'"]+['"]\s*\]/,
  /\b(?:await\s+)?(?:req|request)\.json\s*\(\s*\)/,
  /\.searchParams\.get\s*\(/,
  /\bsearchParams\.get\s*\(/,
  /\b(?:req|request)\.query\.[a-zA-Z_$][\w$]*/,
  /\b(?:req|request)\.body\.[a-zA-Z_$][\w$]*/,
  /\bformData\.get\s*\(/,
];

/** Identifier names treated as implicitly-tainted body roots when no
 *  explicit binding is observed (Next.js / Express idiom). */
const IMPLICIT_TAINT_ROOTS = new Set(['body', 'request', 'req']);

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

function findOpenParen(content: string, fromIndex: number): number {
  for (let i = fromIndex; i < content.length; i++) {
    if (content[i] === '(') return i;
    if (content[i] !== ' ' && content[i] !== '\t' && content[i] !== '\n') break;
  }
  // Pattern always matches up through `(`; the open paren is the last char.
  return content[fromIndex - 1] === '(' ? fromIndex - 1 : -1;
}

/** Build the set of identifiers proven tainted by client-controlled input. */
function gatherTaintedIdentifiers(content: string): Set<string> {
  const tainted = new Set<string>();
  const taintedRoots = new Set<string>();

  // Pass 1 — root bindings: identifier = (await req.json() | req.body | request.body | etc.)
  const rootBindingPatterns: RegExp[] = [
    /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*await\s+(?:req|request)\.json\s*\(\s*\)/g,
    /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*await\s+(?:req|request)\.formData\s*\(\s*\)/g,
    /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:req|request)\.body\b/g,
  ];
  for (const re of rootBindingPatterns) {
    for (const m of content.matchAll(re)) {
      taintedRoots.add(m[1]);
      tainted.add(m[1]);
    }
  }

  // Pass 2 — destructure from any tainted root (explicit or implicit)
  const allRoots = new Set<string>([...IMPLICIT_TAINT_ROOTS, ...taintedRoots]);
  const allRootsAlt = Array.from(allRoots).map(escapeRegex).join('|');
  const destructureFromRoot = new RegExp(
    `(?:const|let|var)\\s+\\{\\s*([^}]+?)\\s*\\}\\s*=\\s*(?:${allRootsAlt})\\b`,
    'g',
  );
  for (const m of content.matchAll(destructureFromRoot)) {
    for (const part of m[1].split(',')) {
      const id = part.trim().split(':')[0].trim().split('=')[0].trim();
      if (id && /^[a-zA-Z_$][\w$]*$/.test(id)) tainted.add(id);
    }
  }
  // Destructure direct from `await req.json()` (no binding)
  for (const m of content.matchAll(
    /(?:const|let|var)\s+\{\s*([^}]+?)\s*\}\s*=\s*await\s+(?:req|request)\.json\s*\(\s*\)/g,
  )) {
    for (const part of m[1].split(',')) {
      const id = part.trim().split(':')[0].trim().split('=')[0].trim();
      if (id && /^[a-zA-Z_$][\w$]*$/.test(id)) tainted.add(id);
    }
  }
  // Destructure from req.formData() — Next.js form action pattern
  for (const m of content.matchAll(
    /(?:const|let|var)\s+\{\s*([^}]+?)\s*\}\s*=\s*await\s+(?:req|request)\.formData\s*\(\s*\)/g,
  )) {
    for (const part of m[1].split(',')) {
      const id = part.trim().split(':')[0].trim().split('=')[0].trim();
      if (id && /^[a-zA-Z_$][\w$]*$/.test(id)) tainted.add(id);
    }
  }

  // Pass 3 — property assignment from any tainted root
  for (const root of allRoots) {
    const re = new RegExp(
      `(?:const|let|var)\\s+([a-zA-Z_$][\\w$]*)\\s*=\\s*${escapeRegex(root)}\\.[a-zA-Z_$][\\w$]*`,
      'g',
    );
    for (const m of content.matchAll(re)) tainted.add(m[1]);
  }

  // Pass 4 — searchParams.get(...) / req.query.X bindings
  for (const m of content.matchAll(
    /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:[^;,\n]*?\.)?searchParams\.get\s*\(/g,
  )) {
    tainted.add(m[1]);
  }
  for (const m of content.matchAll(
    /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:req|request)\.query\.[a-zA-Z_$][\w$]*/g,
  )) {
    tainted.add(m[1]);
  }
  // Destructure from searchParams: `const { amount } = Object.fromEntries(searchParams)` is uncommon; skip.
  // Destructure from req.query: `const { amount } = req.query`
  for (const m of content.matchAll(
    /(?:const|let|var)\s+\{\s*([^}]+?)\s*\}\s*=\s*(?:req|request)\.query\b/g,
  )) {
    for (const part of m[1].split(',')) {
      const id = part.trim().split(':')[0].trim().split('=')[0].trim();
      if (id && /^[a-zA-Z_$][\w$]*$/.test(id)) tainted.add(id);
    }
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
      // wrapping Stripe.js are non-issue.
      const head = content.slice(0, 200);
      if (/^\s*['"]use client['"];?/m.test(head)) continue;

      // Cheap reject: no payment-SDK call patterns? skip the file entirely.
      if (!PAYMENT_SDK_CALL_PATTERNS.some((p) => p.test(content))) continue;

      const tainted = gatherTaintedIdentifiers(content);
      const seenCallSites = new Set<number>();

      for (const sdkPattern of PAYMENT_SDK_CALL_PATTERNS) {
        const re = new RegExp(sdkPattern.source, 'g' + (sdkPattern.flags.includes('i') ? 'i' : ''));
        for (const match of content.matchAll(re)) {
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
