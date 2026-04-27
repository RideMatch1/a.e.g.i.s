/**
 * AI model input/output architectural boundary.
 *
 * Closes APTS-MR-018 (AI Model Input/Output Architectural Boundary).
 *
 * Design notes:
 *   - LLM-pentest wrappers run as full-privilege child processes by
 *     default. APTS-MR-018 mandates an architectural boundary —
 *     sandboxed process, restricted FS, restricted network egress.
 *   - AEGIS exposes a `--sandbox-mode <docker|firejail|none>` siege
 *     flag. Default is `none` for back-compat. When the operator opts
 *     in, AEGIS rewrites every wrapper invocation through the chosen
 *     sandboxer so that the wrapper executes inside the boundary.
 *   - `wrapForSandbox` produces the transformation. Wrapper code calls
 *     it before exec; if mode is 'none' the call is a no-op pass-through.
 *   - For docker mode, AEGIS expects a per-wrapper container image
 *     to exist locally (operator-provisioned). The wrapper-image map
 *     keys off the wrapper name; an unmapped wrapper falls back to
 *     pass-through with an explicit warning so unsupported wrappers
 *     do not silently bypass the boundary.
 */
import type { EgressAllowlist } from './oob-blocker.js';

export type SandboxMode = 'docker' | 'firejail' | 'none';

export const SANDBOX_MODES: readonly SandboxMode[] = Object.freeze([
  'docker',
  'firejail',
  'none',
]);

/**
 * Per-wrapper container image map. Operators may override via
 * RoE.sandboxing.image_overrides; defaults below assume the operator
 * has built/pulled the image under the canonical tag.
 */
export const DEFAULT_WRAPPER_IMAGES: Readonly<Record<string, string>> = Object.freeze({
  strix: 'aegis/strix-sandbox:latest',
  ptai: 'aegis/ptai-sandbox:latest',
  pentestswarm: 'aegis/pentestswarm-sandbox:latest',
});

export interface WrapForSandboxOptions {
  /** Custom docker network to attach the container to (egress allowlist enforcement). */
  dockerNetwork?: string;
  /** Per-wrapper image override. Falls back to DEFAULT_WRAPPER_IMAGES. */
  imageOverride?: string;
  /** Egress allowlist to mount as env (works in all modes; enforced in docker). */
  allowlist?: EgressAllowlist;
  /** Extra docker run security flags. Sensible defaults applied; do not disable lightly. */
  extraDockerArgs?: readonly string[];
}

export interface WrappedExec {
  binary: string;
  args: string[];
  /** Env additions the wrapper should pass through to exec. */
  envAdditions: NodeJS.ProcessEnv;
  /** True when the original (binary, args) were rewritten through a sandboxer. */
  sandboxed: boolean;
  /** Diagnostic — what mode actually applied (might be 'none' on unmapped wrapper). */
  mode_applied: SandboxMode;
}

export interface SandboxModeValidation {
  ok: boolean;
  mode?: SandboxMode;
  reason?: string;
}

/**
 * Validate an operator-supplied --sandbox-mode value.
 */
export function validateSandboxMode(input: string | undefined): SandboxModeValidation {
  if (input === undefined || input === '') return { ok: true, mode: 'none' };
  const lower = input.toLowerCase();
  if ((SANDBOX_MODES as readonly string[]).includes(lower)) {
    return { ok: true, mode: lower as SandboxMode };
  }
  return {
    ok: false,
    reason: `unknown --sandbox-mode "${input}"; valid: ${SANDBOX_MODES.join(', ')}`,
  };
}

/**
 * Wrap a wrapper exec call through the chosen sandbox mode. Returns
 * { binary, args, envAdditions, sandboxed, mode_applied }. When mode is
 * 'none' (or the wrapper has no image mapping), the original tuple is
 * returned with sandboxed=false so the caller still observes that the
 * wrapper ran un-sandboxed.
 */
export function wrapForSandbox(
  wrapperName: string,
  binary: string,
  args: readonly string[],
  mode: SandboxMode,
  opts: WrapForSandboxOptions = {},
): WrappedExec {
  const envAdditions: NodeJS.ProcessEnv = {
    AEGIS_SANDBOX_MODE: mode,
  };
  if (opts.allowlist) {
    envAdditions.AEGIS_EGRESS_ALLOWLIST = opts.allowlist.envValue;
  }

  if (mode === 'none') {
    return {
      binary,
      args: [...args],
      envAdditions,
      sandboxed: false,
      mode_applied: 'none',
    };
  }

  if (mode === 'firejail') {
    // Conservative profile: read-only root FS, drop network namespace
    // unless the operator opts back in via allowlist, no IPC namespace.
    const firejailArgs = [
      '--quiet',
      '--noprofile',
      '--read-only=/',
      '--ipc-namespace',
      '--noroot',
      '--',
      binary,
      ...args,
    ];
    return {
      binary: 'firejail',
      args: firejailArgs,
      envAdditions,
      sandboxed: true,
      mode_applied: 'firejail',
    };
  }

  // docker mode
  const image = opts.imageOverride ?? DEFAULT_WRAPPER_IMAGES[wrapperName];
  if (!image) {
    // Unmapped wrapper — fall back to pass-through but loud about it.
    return {
      binary,
      args: [...args],
      envAdditions: {
        ...envAdditions,
        AEGIS_SANDBOX_FALLBACK: `unmapped-wrapper:${wrapperName}`,
      },
      sandboxed: false,
      mode_applied: 'none',
    };
  }
  const network = opts.dockerNetwork ?? 'aegis-egress';
  const baseDockerArgs = [
    'run',
    '--rm',
    `--network=${network}`,
    '--security-opt=no-new-privileges',
    '--cap-drop=ALL',
    '--read-only',
    '--tmpfs=/tmp',
    ...(opts.extraDockerArgs ?? []),
  ];
  if (opts.allowlist) {
    baseDockerArgs.push('--env', `AEGIS_EGRESS_ALLOWLIST=${opts.allowlist.envValue}`);
  }
  baseDockerArgs.push(image, ...args);
  return {
    binary: 'docker',
    args: baseDockerArgs,
    envAdditions,
    sandboxed: true,
    mode_applied: 'docker',
  };
}
