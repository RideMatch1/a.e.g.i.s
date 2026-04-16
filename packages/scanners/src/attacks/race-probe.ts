import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { relative } from 'path';

// WARNING: This probe sends concurrent POST requests.
// It is intentionally limited to 5 parallel requests per endpoint.
// Routes containing 'delete', 'remove', or 'drop' are skipped to avoid
// triggering destructive operations on the target.
const CONCURRENT_REQUESTS = 5;

/**
 * Keywords in the URL path that suggest a booking/payment/voucher endpoint
 * worth probing for race conditions.
 */
const RACE_CONDITION_KEYWORDS = [
  'book', 'pay', 'redeem', 'claim', 'reserve', 'checkout', 'purchase',
];

/**
 * Keywords that indicate the route could be destructive — skip these entirely.
 */
const DESTRUCTIVE_KEYWORDS = ['delete', 'remove', 'drop'];

/**
 * Discovers POST routes whose path suggests a state-changing business operation
 * (booking, payment, voucher redemption, etc.).
 */
function discoverRaceConditionCandidates(projectPath: string): string[] {
  const routeFiles = walkFiles(projectPath, [
    'node_modules', '.git', '.next', 'dist', 'build', 'coverage',
  ], ['ts', 'js', 'tsx', 'jsx']);

  const candidates: string[] = [];

  for (const file of routeFiles) {
    const rel = relative(projectPath, file);

    const isApiRoute =
      /(?:^|\/)app\/api\/.*\/route\.[tj]sx?$/.test(rel) ||
      /(?:^|\/)pages\/api\/.*\.[tj]sx?$/.test(rel);

    if (!isApiRoute) continue;

    // Convert to route path first so we can test keywords against the URL
    let routePath = rel
      .replace(/^src\//, '')
      .replace(/^app\/api\//, '/api/')
      .replace(/^pages\/api\//, '/api/')
      .replace(/\/route\.[tj]sx?$/, '')
      .replace(/\.[tj]sx?$/, '');

    routePath = routePath.replace(/\[([^\]]+)\]/g, 'test-$1');

    const lowerPath = routePath.toLowerCase();

    // Skip routes that could trigger destructive operations
    if (DESTRUCTIVE_KEYWORDS.some((kw) => lowerPath.includes(kw))) continue;

    // Only probe paths that match race-condition-relevant keywords
    if (!RACE_CONDITION_KEYWORDS.some((kw) => lowerPath.includes(kw))) continue;

    // Confirm a POST handler is exported in the file
    const content = readFileSafe(file);
    if (!content) continue;
    if (!/export\s+(async\s+)?function\s+POST/.test(content)) continue;

    candidates.push(routePath);
  }

  return candidates;
}

export const raceProbeScanner: Scanner = {
  name: 'race-probe',
  description: 'Sends concurrent POST requests to booking/payment endpoints to detect race conditions',
  category: 'attack',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;

    if (!config.target) {
      return {
        scanner: 'race-probe',
        category: 'attack',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'No target URL provided — race probe requires --target',
      };
    }

    const baseUrl = config.target.replace(/\/$/, '');
    const candidates = discoverRaceConditionCandidates(projectPath);

    for (const route of candidates) {
      const url = `${baseUrl}${route}`;

      try {
        // WARNING: Sends CONCURRENT_REQUESTS (5) simultaneous POST requests.
        // Limited to 5 to minimise side-effects on real servers.
        const requests = Array.from({ length: CONCURRENT_REQUESTS }, () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);
          return fetch(url, {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'AEGIS-Security-Scanner/0.1',
            },
            body: JSON.stringify({ test: true }),
            redirect: 'follow',
          }).finally(() => clearTimeout(timeout));
        });

        const responses = await Promise.allSettled(requests);
        const fulfilled = responses.filter(
          (r): r is PromiseFulfilledResult<Response> => r.status === 'fulfilled',
        );

        // All concurrent requests returned 200 → no idempotency / conflict detection
        const allSucceeded =
          fulfilled.length === CONCURRENT_REQUESTS &&
          fulfilled.every((r) => r.value.status === 200);

        if (allSucceeded) {
          const id = `RACE-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'race-probe',
            category: 'attack',
            severity: 'medium',
            title: `Potential race condition — concurrent identical requests all succeeded: ${route}`,
            description: `${CONCURRENT_REQUESTS} simultaneous POST requests to ${url} all returned HTTP 200. A properly idempotency-protected endpoint should return 409 (Conflict) or 429 (Too Many Requests) for duplicate concurrent submissions. This may allow double-booking, double-spending, or duplicate voucher redemption.`,
            owasp: 'A04:2021',
            cwe: 362,
          });
        }
      } catch {
        // Request failed (timeout, network error) — not a finding
      }
    }

    return {
      scanner: 'race-probe',
      category: 'attack',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
