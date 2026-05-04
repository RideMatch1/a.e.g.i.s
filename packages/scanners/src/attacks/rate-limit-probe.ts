import { walkFiles, applyOpsecHeaders } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { relative } from 'path';

const BURST_COUNT = 20;

/**
 * Discovers likely auth endpoints by scanning route files for login/signin patterns.
 * Falls back to common auth paths if no route files are found.
 */
function discoverAuthEndpoints(projectPath: string): string[] {
  const routeFiles = walkFiles(projectPath, [
    'node_modules', '.git', '.next', 'dist', 'build', 'coverage',
  ], ['ts', 'js', 'tsx', 'jsx']);

  const authPaths: string[] = [];

  for (const file of routeFiles) {
    const rel = relative(projectPath, file);
    const isApiRoute =
      /(?:^|\/)app\/api\/.*\/route\.[tj]sx?$/.test(rel) ||
      /(?:^|\/)pages\/api\/.*\.[tj]sx?$/.test(rel);

    if (!isApiRoute) continue;

    // Check if this is an auth-related route
    // Only test login/signin endpoints — NEVER register/signup (would create real accounts!)
    if (/auth|login|signin|sign-in/i.test(rel) && !/register|signup|sign-up/i.test(rel)) {
      let routePath = rel
        .replace(/^src\//, '')
        .replace(/^app\/api\//, '/api/')
        .replace(/^pages\/api\//, '/api/')
        .replace(/\/route\.[tj]sx?$/, '')
        .replace(/\.[tj]sx?$/, '');
      routePath = routePath.replace(/\[([^\]]+)\]/g, 'test-$1');
      authPaths.push(routePath);
    }
  }

  // Fallback: common auth endpoint paths
  if (authPaths.length === 0) {
    authPaths.push('/api/auth/login', '/api/auth/signin');
  }

  return authPaths;
}

export const rateLimitProbeScanner: Scanner = {
  name: 'rate-limit-probe',
  description: 'Sends burst requests to auth endpoints to verify rate limiting',
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
        scanner: 'rate-limit-probe',
        category: 'attack',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'No target URL provided — rate-limit probe requires --target',
      };
    }

    const authEndpoints = discoverAuthEndpoints(projectPath);
    const baseUrl = config.target.replace(/\/$/, '');

    for (const endpoint of authEndpoints) {
      const url = `${baseUrl}${endpoint}`;

      try {
        // Send BURST_COUNT rapid requests (no delay between them).
        // Phase-17 OPSEC: UA-only override; pacing/jitter is intentionally NOT
        // applied — the entire purpose of this probe is to verify the target
        // rate-limits a burst, so spacing AEGIS' own requests would defeat it.
        const requests = Array.from({ length: BURST_COUNT }, () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);
          const init = applyOpsecHeaders(
            {
              method: 'POST',
              signal: controller.signal,
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'AEGIS-Security-Scanner/0.1',
              },
              body: JSON.stringify({ email: 'test@aegis-probe.local', password: 'probe-test' }),
              redirect: 'follow',
            },
            config.opsec,
          );
          return fetch(url, init).finally(() => clearTimeout(timeout));
        });

        const responses = await Promise.allSettled(requests);
        const fulfilled = responses.filter(
          (r): r is PromiseFulfilledResult<Response> => r.status === 'fulfilled',
        );

        // Check if any response was 429 (Too Many Requests)
        const got429 = fulfilled.some((r) => r.value.status === 429);

        if (!got429 && fulfilled.length === BURST_COUNT) {
          const id = `ATK-RL-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'rate-limit-probe',
            category: 'attack',
            severity: 'high',
            title: `No rate limiting on auth endpoint: ${endpoint}`,
            description: `Sent ${BURST_COUNT} rapid POST requests to ${url} — none returned 429. Auth endpoints must rate-limit to prevent credential stuffing and brute-force attacks.`,
            owasp: 'A07:2021',
            cwe: 307,
          });
        }
      } catch {
        // Endpoint unreachable — not a finding
      }
    }

    return {
      scanner: 'rate-limit-probe',
      category: 'attack',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
