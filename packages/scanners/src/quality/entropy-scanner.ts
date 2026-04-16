import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/**
 * Shannon entropy calculator.
 * H = -Sum(p_i * log2(p_i)) where p_i is the frequency of each character.
 */
function shannonEntropy(str: string): number {
  if (str.length <= 1) return 0;

  const freq = new Map<string, number>();
  for (const ch of str) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }

  let entropy = 0;
  const len = str.length;
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/** Files that generate many false positives (lock files, SBOM, generated output) */
const SKIP_FILENAMES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  'composer.lock',
  'Gemfile.lock',
  'Cargo.lock',
  'go.sum',
  'poetry.lock',
  'shrinkwrap.json',
  'npm-shrinkwrap.json',
]);

/** Directories to skip entirely */
const SKIP_DIRS = ['node_modules', '.git', 'dist', '.next', 'coverage', '.turbo', '.cache', 'build', 'out'];

/** File extensions to scan */
const EXTENSIONS = ['ts', 'js', 'tsx', 'jsx', 'json', 'yml', 'yaml', 'env', 'cfg', 'conf', 'ini', 'toml'];

/**
 * Match alphanumeric strings > 20 chars that look like potential secrets.
 * Captures sequences of hex, base64, or mixed alphanumeric characters.
 */
const HIGH_ENTROPY_PATTERN = /(?<![a-zA-Z0-9_/\-.])([a-zA-Z0-9+/=_\-]{21,})(?![a-zA-Z0-9_/\-.])/g;

/**
 * Patterns that are known-safe and should NOT be flagged.
 */
function isSafePattern(match: string, filePath: string, line: string): boolean {
  // UUIDs (8-4-4-4-12)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match)) return true;

  // CSS hex colors (#aabbcc or #abc)
  if (/^[0-9a-fA-F]{3,8}$/.test(match) && line.includes('#')) return true;

  // Import paths / module specifiers
  if (line.includes('import ') || line.includes('require(') || line.includes('from ')) return true;

  // Test files — base64 test fixtures are expected
  if (/\.(test|spec)\.(ts|js|tsx|jsx)$/.test(filePath) || filePath.includes('__tests__/')) return true;

  // Known safe prefixes: data URIs, integrity hashes, sourcemap references
  if (line.includes('data:') || line.includes('integrity=') || line.includes('sourceMappingURL=')) return true;

  // Common hash output in comments (SHA sums, commit SHAs)
  if (/^[0-9a-f]{40,64}$/i.test(match)) {
    // Git commit SHAs or content-hashes in generated files
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('#') || line.trimStart().startsWith('*')) return true;
  }

  // Version strings and semver-like patterns
  if (/^\d+\.\d+\.\d+/.test(match)) return true;

  // Package name patterns (e.g., @scope/package-name-with-lots-of-chars)
  if (line.includes('@') && (line.includes('/') || line.includes('scope'))) return true;

  // JSON keys that commonly hold hashes (checksums, digests, content-hashes)
  if (/["'](?:checksum|digest|hash|sha\d*|md5|integrity|etag)["']/i.test(line)) return true;

  // Base64-encoded strings in config that are clearly data, not secrets
  if (match.endsWith('==') && filePath.endsWith('.json') && line.includes('"description"')) return true;

  return false;
}

export const entropyScanner: Scanner = {
  name: 'entropy-scanner',
  description: 'Detects high-entropy strings that may be leaked secrets using Shannon entropy analysis (VibeSafe-inspired)',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;
    const ignore = [...new Set([...SKIP_DIRS, ...(config.ignore ?? [])])];

    const files = walkFiles(projectPath, ignore, EXTENSIONS);

    for (const file of files) {
      // Skip lock files and generated files by filename
      const fileName = file.split('/').pop() ?? '';
      if (SKIP_FILENAMES.has(fileName)) continue;

      const content = readFileSafe(file);
      if (content === null) continue;

      const lines = content.split('\n');
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];

        let match: RegExpExecArray | null;
        const re = new RegExp(HIGH_ENTROPY_PATTERN.source, HIGH_ENTROPY_PATTERN.flags);
        while ((match = re.exec(line)) !== null) {
          const candidate = match[1];

          // Skip short strings (redundant with regex but defensive)
          if (candidate.length <= 20) continue;

          // Skip known safe patterns
          if (isSafePattern(candidate, file, line)) continue;

          const entropy = shannonEntropy(candidate);

          // Only flag strings with entropy > 4.5 bits/char
          if (entropy <= 4.5) continue;

          const severity = entropy > 5.0 ? 'high' : 'medium';
          const id = `ENTROPY-${String(idCounter++).padStart(3, '0')}`;

          findings.push({
            id,
            scanner: 'entropy-scanner',
            severity,
            title: `High-entropy string detected (${entropy.toFixed(2)} bits/char)`,
            description:
              `String of length ${candidate.length} with Shannon entropy ${entropy.toFixed(2)} bits/char exceeds threshold (4.5). ` +
              `This may be a leaked secret, API key, or token. Review and move to environment variables if sensitive.`,
            file,
            line: lineIdx + 1,
            category: 'security',
            owasp: 'A07:2021',
            cwe: 798,
          });
        }
      }
    }

    return {
      scanner: 'entropy-scanner',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
