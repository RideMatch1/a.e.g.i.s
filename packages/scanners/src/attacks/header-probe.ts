import { opsecPace, applyOpsecHeaders } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

interface SecurityHeader {
  name: string;
  severity: 'high' | 'medium';
  description: string;
  owasp: string;
  cwe: number;
}

const REQUIRED_HEADERS: SecurityHeader[] = [
  {
    name: 'strict-transport-security',
    severity: 'high',
    description: 'HSTS not set — browsers can be downgraded to HTTP, enabling MitM attacks.',
    owasp: 'A02:2021',
    cwe: 319,
  },
  {
    name: 'content-security-policy',
    severity: 'high',
    description: 'CSP not set — no restriction on which resources the browser can load, enabling XSS.',
    owasp: 'A03:2021',
    cwe: 693,
  },
  {
    name: 'x-frame-options',
    severity: 'medium',
    description: 'X-Frame-Options not set — page can be embedded in iframes, enabling clickjacking.',
    owasp: 'A05:2021',
    cwe: 1021,
  },
  {
    name: 'x-content-type-options',
    severity: 'medium',
    description: 'X-Content-Type-Options not set — browser may MIME-sniff responses.',
    owasp: 'A05:2021',
    cwe: 693,
  },
  {
    name: 'referrer-policy',
    severity: 'medium',
    description: 'Referrer-Policy not set — full URL may leak to third parties in Referer header.',
    owasp: 'A05:2021',
    cwe: 200,
  },
  {
    name: 'permissions-policy',
    severity: 'medium',
    description: 'Permissions-Policy not set — browser APIs (camera, mic, geolocation) unrestricted.',
    owasp: 'A05:2021',
    cwe: 693,
  },
  {
    name: 'cross-origin-opener-policy',
    severity: 'medium',
    description: 'COOP not set — cross-origin documents may share a process, enabling Spectre attacks.',
    owasp: 'A05:2021',
    cwe: 693,
  },
];

export const headerProbeScanner: Scanner = {
  name: 'header-probe',
  description: 'Verifies security response headers on live target via HTTP request',
  category: 'attack',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(_projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;

    if (!config.target) {
      return {
        scanner: 'header-probe',
        category: 'attack',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'No target URL provided — header probe requires --target',
      };
    }

    try {
      await opsecPace(config.opsec);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const init = applyOpsecHeaders(
        {
          method: 'GET',
          signal: controller.signal,
          headers: { 'User-Agent': 'AEGIS-Security-Scanner/0.1' },
          redirect: 'follow',
        },
        config.opsec,
      );
      const response = await fetch(config.target, init);

      clearTimeout(timeout);

      for (const header of REQUIRED_HEADERS) {
        const value = response.headers.get(header.name);
        if (!value) {
          const id = `ATK-HDR-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'header-probe',
            category: 'attack',
            severity: header.severity,
            title: `Missing header on live target: ${header.name}`,
            description: `${header.description} Verified via HTTP GET to ${config.target}.`,
            owasp: header.owasp,
            cwe: header.cwe,
          });
        }
      }
    } catch (err) {
      return {
        scanner: 'header-probe',
        category: 'attack',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: `Failed to reach target: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    return {
      scanner: 'header-probe',
      category: 'attack',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
