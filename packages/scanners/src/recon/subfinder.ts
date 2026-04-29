import { exec, commandExists } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/**
 * Subfinder Adapter — Passive Subdomain Discovery (Project Discovery)
 *
 * Subfinder enumerates subdomains for a target domain by querying public
 * passive sources (crt.sh, AlienVault, BufferOver, Hackertarget, etc).
 * No active probing of the target's own DNS infrastructure — strictly
 * passive intelligence collection.
 *
 * Coverage: subdomain inventory for the target domain. Surfaces dev/
 * staging/admin/internal subdomains that should not be externally
 * resolvable but are. Common precursor to deeper recon (httpx probing,
 * DNS resolution via dnsx).
 *
 * Repository: https://github.com/projectdiscovery/subfinder (MIT)
 * Install: `brew install subfinder` or `go install
 *   github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest`
 *
 * Mode-gate: --mode pentest only. Although subfinder itself is passive
 * (no traffic to the target), the *intent* of running it is reconnaissance,
 * which the operator should opt into rather than running by default in
 * standard scan/audit modes.
 *
 * Severity policy: every discovered subdomain emits as `severity: info`
 * by default — recon output is intelligence, not a vulnerability per se.
 * Operators can post-filter by interesting-subdomain-pattern (e.g.
 * `dev.`, `staging.`, `admin.`, `test.`, `internal.`) using the standard
 * AEGIS finding-filter pipeline.
 */

interface SubfinderEntry {
  host?: string;
  input?: string;
  source?: string;
}

export const subfinderScanner: Scanner = {
  name: 'subfinder',
  description:
    'Passive subdomain discovery via public sources (Subfinder, MIT, ProjectDiscovery)',
  category: 'infrastructure',
  isExternal: true,

  async isAvailable(_projectPath: string): Promise<boolean> {
    return commandExists('subfinder');
  },

  async scan(_projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    const target = config.target;
    if (!target) {
      return {
        scanner: 'subfinder',
        category: 'infrastructure',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'subfinder requires --target <domain> (e.g. example.com)',
      };
    }

    if (config.mode !== 'pentest' && config.mode !== 'siege') {
      return {
        scanner: 'subfinder',
        category: 'infrastructure',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error:
          'subfinder requires --mode pentest or --mode siege (active reconnaissance — opt-in only via aegis pentest / aegis siege with --confirm)',
      };
    }

    // Strip protocol + path if the operator passed a URL — subfinder wants a
    // bare domain. argv-style exec: no shell interpolation.
    const domain = stripToDomain(target);
    if (!domain) {
      return {
        scanner: 'subfinder',
        category: 'infrastructure',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: `subfinder: could not derive bare domain from --target ${target}`,
      };
    }

    // -oJ = JSON-Lines output (one JSON object per line, not a single JSON document)
    // -silent = suppress banner / progress chatter (we still want stdout-only output)
    // -all is intentionally OMITTED — defaulting to the curated source set keeps
    //   runtimes bounded; operator can override via subfinder's own config
    const result = await exec('subfinder', ['-d', domain, '-oJ', '-silent'], {
      timeout: 5 * 60_000,
    });

    if (result.exitCode > 1) {
      return {
        scanner: 'subfinder',
        category: 'infrastructure',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: `subfinder exited ${result.exitCode}: ${result.stderr.slice(0, 200)}`,
      };
    }

    // Parse JSON Lines — one entry per line. Tolerate blank lines and the
    // occasional progress line that escaped -silent.
    const findings: Finding[] = [];
    let idCounter = 1;
    const seenHosts = new Set<string>();

    for (const line of result.stdout.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) continue;
      let entry: SubfinderEntry;
      try {
        entry = JSON.parse(trimmed) as SubfinderEntry;
      } catch {
        continue;
      }
      const host = entry.host?.trim();
      if (!host || seenHosts.has(host)) continue;
      seenHosts.add(host);

      const severity = classifySubdomain(host);

      findings.push({
        id: `SUBFINDER-${String(idCounter++).padStart(4, '0')}`,
        scanner: 'subfinder',
        category: 'infrastructure',
        severity,
        title: `Subdomain discovered: ${host}`,
        description:
          `Passive enumeration surfaced \`${host}\` for target \`${domain}\`.` +
          (entry.source ? ` Source: ${entry.source}.` : '') +
          severityRationale(severity, host),
      });
    }

    return {
      scanner: 'subfinder',
      category: 'infrastructure',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};

/**
 * Strip an operator-provided URL down to a bare domain. Subfinder wants
 * the eTLD+1; passing a URL or path causes a parse error.
 */
function stripToDomain(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Try URL parsing first — handles full URLs cleanly.
  try {
    const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    const hostname = u.hostname;
    // Reject empty, IP-literal, or RFC 1918 — subfinder is for public DNS
    if (!hostname) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;
    return hostname;
  } catch {
    return null;
  }
}

/**
 * Classify a discovered subdomain by interest level.
 *
 * Defaults to `info` — most subdomains are routine. Bumps to `low` for
 * common-but-noteworthy patterns that frequently surface internal-only
 * infrastructure on public DNS (the most useful recon signal).
 */
function classifySubdomain(host: string): Finding['severity'] {
  const lower = host.toLowerCase();
  // Common interesting-prefix patterns — flag as `low` so they bubble up
  // in default reports without overwhelming the operator with all subs.
  const interesting = [
    /^dev[.-]/,
    /^staging[.-]/,
    /^stg[.-]/,
    /^test[.-]/,
    /^uat[.-]/,
    /^admin[.-]/,
    /^internal[.-]/,
    /^intranet[.-]/,
    /^vpn[.-]/,
    /^jenkins[.-]/,
    /^gitlab[.-]/,
    /^jira[.-]/,
    /^confluence[.-]/,
    /^sentry[.-]/,
    /^grafana[.-]/,
    /^kibana[.-]/,
    /^prometheus[.-]/,
    /\.dev\./,
    /\.staging\./,
    /\.internal\./,
    /\.admin\./,
  ];
  for (const re of interesting) {
    if (re.test(lower)) return 'low';
  }
  return 'info';
}

function severityRationale(severity: Finding['severity'], host: string): string {
  if (severity === 'low') {
    return ` Subdomain prefix on \`${host}\` matches a common-internal-asset pattern (dev/staging/admin/CI/observability). Verify externally-resolvable status is intentional; if not, restrict to internal DNS or VPN-only.`;
  }
  return '';
}
