/**
 * Out-of-Band communication egress allowlist composition.
 *
 * Closes APTS-MR-011 (Out-of-Band Communication Prevention).
 *
 * Design notes:
 *   - LLM-pentest wrappers spawn as child processes with full network
 *     access by default. AEGIS composes a per-engagement egress
 *     allowlist from RoE in_scope hosts plus a fixed orchestrator
 *     essentials list (LLM provider APIs, wrapper update endpoints).
 *   - Allowlist is propagated to wrappers via the AEGIS_EGRESS_ALLOWLIST
 *     environment variable. Wrappers running in `--sandbox-mode docker`
 *     have it hard-enforced via `docker run --network=<name>`; in
 *     `--sandbox-mode none` the allowlist is a soft signal that
 *     cooperative wrappers consume.
 *   - The fixed orchestrator essentials list is intentionally short —
 *     anything not strictly required for the wrapper to function is
 *     omitted. Operators extend via RoE in_scope.
 */
import type { RoE } from '../roe/types.js';

/**
 * Fixed orchestrator essentials — endpoints that any LLM-pentest
 * wrapper must reach to function (LLM provider APIs). Operators
 * cannot remove these via RoE; they can extend via in_scope. If a
 * wrapper does not need LLM access (subfinder, semgrep), it should
 * be invoked without these in its env.
 */
export const ORCHESTRATOR_ESSENTIALS: readonly string[] = Object.freeze([
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'api.cohere.ai',
  'api.mistral.ai',
]);

export interface EgressAllowlist {
  /** Hostnames + IP-literals + bare-domain entries (RoE in_scope.domains, ip_ranges, plus essentials). */
  hosts: string[];
  /** Comma-joined form for AEGIS_EGRESS_ALLOWLIST env var. */
  envValue: string;
  /** Whether LLM-provider essentials are included. False for non-LLM wrappers. */
  includes_llm_essentials: boolean;
}

export interface ComposeEgressAllowlistOptions {
  /** Whether the wrapper needs LLM provider access. False for subfinder/SAST. */
  includeLlmEssentials?: boolean;
  /**
   * Operator-defined extra entries — additional CDN / package mirror /
   * artifact registry hosts the wrapper needs that are not in RoE
   * in_scope (RoE in_scope is for *targets*, not infrastructure).
   */
  extras?: readonly string[];
}

/**
 * Compose the per-engagement egress allowlist from RoE in_scope plus
 * orchestrator essentials. Returns the structured list and the
 * AEGIS_EGRESS_ALLOWLIST env value.
 */
export function composeEgressAllowlist(
  roe: RoE,
  opts: ComposeEgressAllowlistOptions = {},
): EgressAllowlist {
  const { includeLlmEssentials = true, extras = [] } = opts;
  const hosts = new Set<string>();

  for (const dom of roe.in_scope.domains) {
    hosts.add(dom.pattern.toLowerCase());
    if (dom.includeSubdomains && !dom.pattern.startsWith('*.')) {
      hosts.add(`*.${dom.pattern.toLowerCase()}`);
    }
  }
  for (const cidr of roe.in_scope.ip_ranges) {
    hosts.add(cidr);
  }
  if (includeLlmEssentials) {
    for (const e of ORCHESTRATOR_ESSENTIALS) hosts.add(e);
  }
  for (const e of extras) hosts.add(e.toLowerCase());

  const sorted = [...hosts].sort();
  return {
    hosts: sorted,
    envValue: sorted.join(','),
    includes_llm_essentials: includeLlmEssentials,
  };
}

/**
 * Helper to merge the AEGIS_EGRESS_ALLOWLIST env var into a wrapper's
 * spawn env without clobbering the operator's own env. Returns a copy.
 */
export function withEgressEnv(
  baseEnv: NodeJS.ProcessEnv,
  allowlist: EgressAllowlist,
): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    AEGIS_EGRESS_ALLOWLIST: allowlist.envValue,
  };
}
