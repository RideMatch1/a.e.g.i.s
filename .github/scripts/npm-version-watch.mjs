#!/usr/bin/env node
/**
 * Weekly npm-version-watch.
 *
 * Reads the committed baseline in `.github/npm-versions-baseline.json`,
 * queries the live npm registry for each package's current `latest`
 * version, and diffs. On any drift it opens a GitHub issue titled
 * `[security/tamper-alert] npm-version drift detected (…)` so the
 * maintainer sees it in their inbox on the next login.
 *
 * Two classes of drift are possible:
 *
 *   1. Intentional publish that wasn't reflected in the baseline yet.
 *      The issue is a housekeeping reminder: bump the baseline via PR
 *      and close the issue. This is the expected common case.
 *
 *   2. Unintentional publish (account compromise, stolen token,
 *      registry tamper, accidental laptop-publish). The issue is a
 *      real incident — follow `SECURITY-INCIDENT-RESPONSE.md`.
 *
 * We cannot distinguish the two classes automatically; the maintainer
 * triages. The workflow runs weekly (Tuesday 07:30 UTC) so the worst
 * case exposure is ~7 days between unintentional publish and alert.
 *
 * Exit codes:
 *   0 — baseline matches registry, no drift
 *   1 — drift detected, issue opened (or will be opened by caller)
 *   2 — internal error (network failure, missing baseline, etc.)
 *
 * Environment:
 *   GH_TOKEN           — required when NODE_ENV !== 'dry-run'.
 *                        Passed through to `gh issue create`.
 *   GITHUB_REPOSITORY  — set automatically by GitHub Actions;
 *                        used to form the issue-endpoint URL.
 *   DRY_RUN=1          — skip issue-creation; print what would be
 *                        sent to stdout. Used by the unit-test.
 */

import { readFileSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const baselinePath = resolve(repoRoot, '.github', 'npm-versions-baseline.json');

function die(message, code = 2) {
  console.error(`[npm-version-watch] ERROR: ${message}`);
  process.exit(code);
}

function readBaseline() {
  if (!existsSync(baselinePath)) {
    die(`baseline not found at ${baselinePath}`);
  }
  try {
    const parsed = JSON.parse(readFileSync(baselinePath, 'utf-8'));
    if (!parsed.packages || typeof parsed.packages !== 'object') {
      die('baseline must contain a top-level "packages" object');
    }
    return parsed;
  } catch (err) {
    die(`baseline is not valid JSON: ${(err).message}`);
  }
}

function npmLatestVersion(packageName) {
  try {
    const raw = execSync(`npm view ${JSON.stringify(packageName)} version`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return raw.trim();
  } catch (err) {
    return `ERROR: ${(err).message.split('\n')[0]}`;
  }
}

function formatIssueBody(driftEntries) {
  const rows = driftEntries.map(
    (d) => `| \`${d.name}\` | \`${d.expected}\` | \`${d.actual}\` |`,
  );
  return [
    'Automated weekly npm-version-watch detected registry versions that do',
    'not match the committed baseline in',
    '`.github/npm-versions-baseline.json`.',
    '',
    '| Package | Baseline (expected) | Currently on npm |',
    '|---|---|---|',
    ...rows,
    '',
    '## If you intentionally published these versions',
    '',
    '1. Update `.github/npm-versions-baseline.json` via PR to reflect the',
    '   new versions.',
    '2. Verify the SLSA v1 provenance on each new version via',
    '   `npm view <pkg>@<version> dist.attestations.provenance.predicateType`',
    '   (expected value: `https://slsa.dev/provenance/v1`).',
    '3. Close this issue once the baseline PR merges.',
    '',
    '## If you did NOT publish these versions',
    '',
    'This is a potential account-compromise, stolen-token, or',
    'registry-tamper event. Follow `SECURITY-INCIDENT-RESPONSE.md`',
    'immediately:',
    '',
    '- Rotate all npm tokens (`NPM_TOKEN`, `NPM_TOKEN_WIZARD`, and any',
    '  future scope-tokens).',
    '- `npm deprecate` the unintentional versions with a security note',
    '  (do NOT `npm unpublish`).',
    '- Verify 2FA is still active on the npm account.',
    '- Check the npm account activity log for recent logins.',
    '- Do NOT close this issue until the investigation concludes and',
    '  the incident response runbook has been followed end-to-end.',
    '',
    '---',
    '',
    '<sub>Automated by `.github/workflows/npm-version-watch.yml` +',
    '`.github/scripts/npm-version-watch.mjs` — G-12 fortress-plan closeout.',
    'Baseline was last reviewed on the `_last_reviewed` date in the',
    'baseline JSON file.</sub>',
  ].join('\n');
}

function openIssue(title, body) {
  const dryRun = process.env.DRY_RUN === '1';
  if (dryRun) {
    console.log('---DRY-RUN issue payload---');
    console.log(`title: ${title}`);
    console.log('body:');
    console.log(body);
    console.log('---end dry-run---');
    return;
  }
  // gh CLI is pre-installed on ubuntu-latest runners and uses GH_TOKEN
  // from the workflow env. The body travels through a temp file so the
  // command-line length and shell-escape rules do not matter.
  const tmp = mkdtempSync(join(tmpdir(), 'npm-watch-'));
  const bodyPath = join(tmp, 'body.md');
  writeFileSync(bodyPath, body, 'utf-8');
  execSync(
    `gh issue create --title ${JSON.stringify(title)} --body-file ${JSON.stringify(bodyPath)}`,
    { stdio: 'inherit' },
  );
}

function main() {
  const baseline = readBaseline();
  const drift = [];
  for (const [name, expected] of Object.entries(baseline.packages)) {
    const actual = npmLatestVersion(name);
    if (actual !== expected) {
      drift.push({ name, expected, actual });
    }
  }

  if (drift.length === 0) {
    console.log(
      `[npm-version-watch] clean — ${Object.keys(baseline.packages).length} package(s) match baseline`,
    );
    process.exit(0);
  }

  const count = drift.length;
  const title = `[security/tamper-alert] npm-version drift detected (${count} package${count === 1 ? '' : 's'})`;
  const body = formatIssueBody(drift);

  console.error(`[npm-version-watch] DRIFT detected on ${count} package(s):`);
  for (const d of drift) {
    console.error(`  ${d.name}: baseline=${d.expected} actual=${d.actual}`);
  }

  openIssue(title, body);
  process.exit(1);
}

main();
