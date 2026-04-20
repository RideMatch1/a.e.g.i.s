import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

const ROUTE_FILENAMES = ['route.ts', 'route.js'];

/** HTTP mutation methods that should have Zod validation on the request body.
 *  DELETE is excluded — it conventionally has no body (resource identified by URL). */
const MUTATION_PATTERNS = [
  /export\s+(async\s+)?function\s+POST\b/,
  /export\s+(async\s+)?function\s+PUT\b/,
  /export\s+(async\s+)?function\s+PATCH\b/,
];

/** Patterns indicating query parameter usage in a GET handler */
const SEARCH_PARAMS_PATTERNS = [
  /searchParams\.get\s*\(/,
  /request\.nextUrl\.searchParams/,
  /nextUrl\.searchParams/,
  /url\.searchParams/,
];

/** Patterns that indicate Zod is imported or used */
const ZOD_IMPORT_PATTERNS = [
  /from\s+['"]zod['"]/,
  /require\s*\(\s*['"]zod['"]\s*\)/,
];

/** Patterns that indicate Zod validation is applied to the request body.
 *  Requires a Zod schema method call, not generic JSON.parse(). */
const ZOD_PARSE_PATTERNS = [
  /\.safeParse\s*\(/,
  /\.parseAsync\s*\(/,
  /\.safeParseAsync\s*\(/,
];

/** Pattern for z.object({ without .strict() nearby */
const ZOD_OBJECT_PATTERN = /z\.object\s*\(\s*\{/g;
const ZOD_STRICT_PATTERN = /\.strict\s*\(\s*\)/;

function detectApiDirs(projectPath: string): string[] {
  return [
    `${projectPath}/src/app/api`,
    `${projectPath}/app/api`,
    `${projectPath}/pages/api`,
  ];
}

function hasGetHandler(content: string): boolean {
  return /export\s+(async\s+)?function\s+GET\b/.test(content);
}

function hasSearchParamsUsage(content: string): boolean {
  return SEARCH_PARAMS_PATTERNS.some((p) => p.test(content));
}

function hasMutationHandler(content: string): boolean {
  return MUTATION_PATTERNS.some((p) => p.test(content));
}

function hasZodImport(content: string): boolean {
  return ZOD_IMPORT_PATTERNS.some((p) => p.test(content));
}

function hasZodParse(content: string): boolean {
  // Check for Zod-specific parse methods
  if (ZOD_PARSE_PATTERNS.some((p) => p.test(content))) return true;
  // Also accept .parse() but only if Zod is imported AND there's a z.object/z.string nearby
  // (to avoid matching JSON.parse())
  if (/\.parse\s*\(/.test(content) && /z\.(object|string|number|array|enum|union|literal)\s*\(/.test(content)) {
    return true;
  }
  return false;
}

function findLineNumber(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

/** Find the position after the matching closing brace for an opening { at pos */
function findMatchingBrace(content: string, pos: number): number {
  let depth = 0;
  for (let i = pos; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return Math.min(pos + 2000, content.length); // fallback if unbalanced
}

export const zodEnforcerScanner: Scanner = {
  name: 'zod-enforcer',
  description: 'Checks that API mutation routes use Zod validation with .strict() on request bodies',
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

        // Check: GET handler uses searchParams without Zod validation
        // Only check for Zod usage within the GET handler block, not the entire file
        let getHandlerHasZodParse = false;
        const getMatch = /export\s+(?:async\s+)?function\s+GET\b/.exec(content);
        if (getMatch) {
          const braceIdx = content.indexOf('{', getMatch.index + getMatch[0].length);
          if (braceIdx !== -1) {
            const getEnd = findMatchingBrace(content, braceIdx);
            const getBlock = content.slice(braceIdx, getEnd);
            getHandlerHasZodParse = hasZodParse(getBlock);
          }
        }
        // Also accept manual validation: isValidUUID, parseInt, Number(), parseFloat
        const hasManualValidation = /isValidUUID|parseInt\s*\(|Number\s*\(|parseFloat\s*\(|\.match\s*\(/.test(content);
        if (hasGetHandler(content) && hasSearchParamsUsage(content) && !getHandlerHasZodParse && !hasManualValidation) {
          const id = `ZOD-${String(idCounter.value++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'zod-enforcer',
            severity: 'low',
            title: 'GET route uses query parameters without Zod validation',
            description:
              'This API route reads query parameters via searchParams without Zod validation. Consider using Zod coerce for type-safe parameter parsing.',
            file,
            line: getMatch ? findLineNumber(content, getMatch.index) : 1,
            category: 'security',
            owasp: 'A03:2021',
            cwe: 20,
          });
        }

        // Only check routes with mutation handlers
        if (!hasMutationHandler(content)) continue;

        const hasZod = hasZodImport(content);
        const hasParse = hasZodParse(content);

        // Check 1: Mutation handler with no Zod validation at all
        if (!hasZod || !hasParse) {
          // Find the line of the first mutation handler for an accurate line number
          let mutationIndex = 0;
          for (const mp of MUTATION_PATTERNS) {
            const m = mp.exec(content);
            if (m) { mutationIndex = m.index; break; }
          }
          const id = `ZOD-${String(idCounter.value++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'zod-enforcer',
            severity: 'high',
            title: 'Mutation route missing Zod validation',
            description:
              'This API route has POST/PUT/PATCH handlers but does not validate the request body with Zod (.parse() or .safeParse()). Unvalidated input is a top attack vector.',
            file,
            line: findLineNumber(content, mutationIndex),
            category: 'security',
            owasp: 'A03:2021',
            cwe: 20,
            fix: {
              description:
                'Declare a Zod schema with .strict() for the request body and parse or safeParse the payload before acting on it. Strict mode rejects unknown keys and gives you a validated, typed object downstream.',
              code: "const Body = z.object({ title: z.string().min(1) }).strict();\nconst data = Body.parse(await request.json());",
              links: [
                'https://cwe.mitre.org/data/definitions/20.html',
                'https://owasp.org/Top10/A03_2021-Injection/',
              ],
            },
          });
          continue; // No point checking .strict() if there's no Zod at all
        }

        // Check 2: Zod schemas exist but without .strict()
        const objectRe = new RegExp(ZOD_OBJECT_PATTERN.source, 'g');
        let match: RegExpExecArray | null;
        while ((match = objectRe.exec(content)) !== null) {
          // Find the matching closing brace using bracket balancing
          const searchStart = match.index + match[0].length - 1; // position of the {
          const endPos = findMatchingBrace(content, searchStart);
          // Look for .strict() after the closing brace (within 20 chars — just .strict())
          const afterSchema = content.slice(endPos, endPos + 20);
          if (!ZOD_STRICT_PATTERN.test(afterSchema)) {
            const id = `ZOD-${String(idCounter.value++).padStart(3, '0')}`;
            findings.push({
              id,
              scanner: 'zod-enforcer',
              severity: 'medium',
              title: 'Zod schema missing .strict()',
              description:
                'A z.object() schema was found without .strict(). Without .strict(), unknown keys are silently accepted, which can lead to mass-assignment vulnerabilities.',
              file,
              line: findLineNumber(content, match.index),
              category: 'security',
              owasp: 'A03:2021',
              cwe: 20,
            });
          }
        }
      }
    }

    return {
      scanner: 'zod-enforcer',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
