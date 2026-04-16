import type { AuditResult, Finding, Reporter } from '@aegis-scan/core';
import { getVersion } from '@aegis-scan/core';

const SARIF_SCHEMA =
  'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json';

type SarifLevel = 'error' | 'warning' | 'note';

function severityToLevel(severity: string): SarifLevel {
  switch (severity.toLowerCase()) {
    case 'blocker':
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    default:
      // low, info, and anything else
      return 'note';
  }
}

interface SarifLocation {
  physicalLocation: {
    artifactLocation: { uri: string };
    region?: { startLine: number };
  };
  /**
   * Free-form message attached to the location. Used on
   * `relatedLocations` for cross-file findings so SARIF consumers can
   * distinguish "the primary site" from "the cross-module origin" in UI.
   */
  message?: { text: string };
}

interface SarifResult {
  ruleId: string;
  level: SarifLevel;
  message: { text: string };
  locations?: SarifLocation[];
  /**
   * SARIF 2.1.0 §3.27.22 — additional locations that supply supporting
   * context for the primary result. AEGIS uses this to point at the
   * cross-file origin of v0.7 cross-file taint findings.
   */
  relatedLocations?: SarifLocation[];
}

interface SarifOutput {
  $schema: string;
  version: '2.1.0';
  runs: Array<{
    tool: {
      driver: {
        name: string;
        version: string;
        rules: Array<{ id: string; name: string; shortDescription: { text: string } }>;
      };
    };
    results: SarifResult[];
  }>;
}

/**
 * Compute the longest common directory prefix of all absolute file paths.
 * Returns empty string if no absolute paths exist.
 */
function computeCommonPrefix(findings: Finding[]): string {
  const absolutePaths = findings
    .map((f) => f.file)
    .filter((f): f is string => typeof f === 'string' && f.startsWith('/'));

  if (absolutePaths.length === 0) return '';

  const sep = '/';
  const parts = absolutePaths.map((p) => p.split(sep));
  const first = parts[0];
  let prefixLength = 0;

  for (let i = 0; i < first.length; i++) {
    if (parts.every((p) => p[i] === first[i])) {
      prefixLength = i + 1;
    } else {
      break;
    }
  }

  if (prefixLength === 0) return '';
  return first.slice(0, prefixLength).join(sep) + sep;
}

function makeRelative(file: string, prefix: string): string {
  if (!prefix || !file.startsWith('/')) return file;
  if (file.startsWith(prefix)) return file.slice(prefix.length);
  return file;
}

function findingToSarifResult(finding: Finding, commonPrefix: string): SarifResult {
  const result: SarifResult = {
    ruleId: finding.id,
    level: severityToLevel(finding.severity),
    message: {
      text: finding.description
        ? `${finding.title}: ${finding.description}`
        : finding.title,
    },
  };

  if (finding.file) {
    const location: SarifLocation = {
      physicalLocation: {
        artifactLocation: { uri: makeRelative(finding.file, commonPrefix) },
      },
    };
    if (finding.line != null) {
      location.physicalLocation.region = { startLine: finding.line };
    }
    result.locations = [location];
  }

  // v0.7 Phase 2: cross-file findings add a relatedLocations entry for
  // the origin file of the cross-module function. No specific line is
  // attached because the taint-tracker only resolves the origin at file
  // granularity in this pass. SARIF consumers show this as "see also".
  if (finding.crossFile === true && finding.crossFileOrigin !== undefined) {
    result.relatedLocations = [
      {
        physicalLocation: {
          artifactLocation: {
            uri: makeRelative(finding.crossFileOrigin, commonPrefix),
          },
        },
        message: {
          text: 'Cross-module origin of the vulnerability',
        },
      },
    ];
  }

  return result;
}

function format(result: AuditResult): string {
  // Compute common path prefix so SARIF URIs are relative
  const commonPrefix = computeCommonPrefix(result.findings);

  // Deduplicate rules — one rule entry per unique finding id
  const seenRules = new Set<string>();
  const rules: SarifOutput['runs'][0]['tool']['driver']['rules'] = [];

  for (const finding of result.findings) {
    if (!seenRules.has(finding.id)) {
      seenRules.add(finding.id);
      rules.push({
        id: finding.id,
        name: finding.title,
        shortDescription: { text: finding.description ?? finding.title },
      });
    }
  }

  const sarif: SarifOutput = {
    $schema: SARIF_SCHEMA,
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'AEGIS',
            version: getVersion(),
            rules,
          },
        },
        results: result.findings.map((f) => findingToSarifResult(f, commonPrefix)),
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

export const sarifReporter: Reporter = {
  name: 'sarif',
  format,
};
