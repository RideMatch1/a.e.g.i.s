import { readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Licenses that are problematic when included in non-GPL / proprietary projects.
 * SSPL and AGPL have network-copyleft provisions that can affect SaaS products.
 */
const PROBLEMATIC_LICENSES = [
  { pattern: /^GPL-3\.0/, label: 'GPL-3.0', reason: 'Copyleft license — may require open-sourcing your code' },
  { pattern: /^AGPL/, label: 'AGPL', reason: 'Strong copyleft with network-use provision — affects SaaS products' },
  { pattern: /^SSPL/, label: 'SSPL', reason: 'Server Side Public License — requires open-sourcing the full service stack' },
  { pattern: /^LGPL-2\.0/, label: 'LGPL-2.0', reason: 'Lesser GPL v2 — review compatibility with your project licence' },
  { pattern: /Commons Clause/, label: 'Commons Clause', reason: 'Commons Clause restricts commercial use' },
  { pattern: /BSL-1\.1|Business Source/, label: 'BSL-1.1', reason: 'Business Source License restricts production use until conversion date' },
];

interface PackageJson {
  name?: string;
  version?: string;
  license?: string | { type: string };
  licenses?: Array<{ type: string }>;
}

export const licenseCheckerScanner: Scanner = {
  name: 'license-checker',
  description: 'Checks installed npm dependencies for problematic open-source licenses',
  category: 'dependencies',

  async isAvailable(_projectPath: string): Promise<boolean> {
    // Always available — we check for node_modules in scan() with the correct projectPath
    return true;
  },

  async scan(projectPath: string, _config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const idCounter = { value: 1 };

    const nodeModulesPath = join(projectPath, 'node_modules');
    if (!existsSync(nodeModulesPath)) {
      return {
        scanner: 'license-checker',
        category: 'dependencies',
        findings: [],
        duration: Date.now() - start,
        available: false,
        error: 'node_modules not found — run npm/pnpm install first',
      };
    }

    let packages: string[];
    try {
      packages = readdirSync(nodeModulesPath);
    } catch {
      return {
        scanner: 'license-checker',
        category: 'dependencies',
        findings: [],
        duration: Date.now() - start,
        available: false,
        error: 'Cannot read node_modules directory',
      };
    }

    for (const pkg of packages) {
      // Handle scoped packages (@org/pkg)
      if (pkg.startsWith('@')) {
        const scopeDir = join(nodeModulesPath, pkg);
        let scopedPackages: string[] = [];
        try {
          scopedPackages = readdirSync(scopeDir);
        } catch {
          continue;
        }
        for (const scopedPkg of scopedPackages) {
          await checkPackage(
            join(scopeDir, scopedPkg),
            `${pkg}/${scopedPkg}`,
            findings,
            idCounter,
          );
        }
        continue;
      }

      await checkPackage(join(nodeModulesPath, pkg), pkg, findings, idCounter);
    }

    return {
      scanner: 'license-checker',
      category: 'dependencies',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};

async function checkPackage(
  pkgPath: string,
  pkgName: string,
  findings: Finding[],
  idCounter: { value: number },
): Promise<void> {
  const pkgJsonPath = join(pkgPath, 'package.json');
  if (!existsSync(pkgJsonPath)) return;

  const content = readFileSafe(pkgJsonPath);
  if (content === null) return;

  let pkgJson: PackageJson;
  try {
    pkgJson = JSON.parse(content) as PackageJson;
  } catch {
    return;
  }

  const licenseStr = extractLicense(pkgJson);
  if (!licenseStr) return;

  for (const problematic of PROBLEMATIC_LICENSES) {
    if (problematic.pattern.test(licenseStr)) {
      findings.push({
        id: `LIC-${String(idCounter.value++).padStart(3, '0')}`,
        scanner: 'license-checker',
        severity: 'high',
        title: `Problematic license: ${pkgName} (${problematic.label})`,
        description: `Package "${pkgName}" uses the ${licenseStr} license. ${problematic.reason}. Review your legal obligations before including this dependency.`,
        category: 'dependencies',
      });
    }
  }
}

function extractLicense(pkg: PackageJson): string | null {
  if (typeof pkg.license === 'string') return pkg.license;
  if (typeof pkg.license === 'object' && pkg.license?.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses) && pkg.licenses.length > 0) return pkg.licenses[0].type;
  return null;
}
