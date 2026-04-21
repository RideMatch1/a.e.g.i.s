import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/**
 * Patterns that indicate file upload handling is present.
 * The Supabase storage pattern requires BOTH .storage.from( AND .upload( in the same file.
 */
const DIRECT_UPLOAD_PATTERNS = [
  /\.formData\s*\(/,        // any variable.formData() — request, req, r, etc.
  /formData\.get\s*\(\s*['"]file['"]\s*\)/,
  /\bmulter\b/,
  /\bformidable\b/,
];

const SUPABASE_STORAGE_UPLOAD_TRIGGER = /supabase\.storage\.from\s*\(/;
const SUPABASE_UPLOAD_METHOD = /\.upload\s*\(/;

/**
 * Patterns that indicate magic-byte or MIME-type validation is in place.
 * These confirm the file content is actually the declared type, preventing
 * polyglot files and content-type spoofing.
 */
const MAGIC_BYTE_VALIDATION_PATTERNS = [
  /['"]file-type['"]/,
  /['"]magic-bytes['"]/,
  /['"]mmmagic['"]/,
  /\bsharp\b/,
];

function findLineNumber(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

function detectScanDirs(projectPath: string): string[] {
  return [
    `${projectPath}/src/app/api`,
    `${projectPath}/app/api`,
    `${projectPath}/pages/api`,
    `${projectPath}/src/lib`,
    `${projectPath}/lib`,
  ];
}

/** Keywords that indicate actual file handling (not just text form submissions) */
const FILE_CONTEXT_PATTERN = /\b(?:file|blob|image|upload|attachment|document)\b/i;

function hasUploadPattern(content: string): boolean {
  // Check non-formData patterns first (multer, formidable, specific file getter)
  for (const p of DIRECT_UPLOAD_PATTERNS) {
    if (p.test(content)) {
      // If the trigger is .formData(), only flag when file-related keywords are also present
      if (p.source === DIRECT_UPLOAD_PATTERNS[0].source) {
        if (!FILE_CONTEXT_PATTERN.test(content)) continue;
      }
      return true;
    }
  }
  // Supabase storage: both .storage.from( AND .upload( must be present
  if (SUPABASE_STORAGE_UPLOAD_TRIGGER.test(content) && SUPABASE_UPLOAD_METHOD.test(content)) return true;
  return false;
}

function hasMagicByteValidation(content: string): boolean {
  return MAGIC_BYTE_VALIDATION_PATTERNS.some((p) => p.test(content));
}

/**
 * Detect Supabase `.upload(path, file, options)` calls and check whether
 * `options` includes a `contentType` field — without it, Supabase Storage
 * defaults to MIME-sniffing the bytes, opening a stored-XSS / browser-
 * interpretation attack surface (HTML masquerading as image, etc.).
 *
 * Returns array of { line, hasContentType } for each Supabase upload call.
 */
const SUPABASE_UPLOAD_CALL_RE =
  /\.upload\s*\(\s*[^,]+,\s*[^,)]+(?:,\s*\{([^}]*)\})?\s*\)/g;

function findSupabaseUploadsWithoutContentType(
  content: string,
): Array<{ line: number; matchIndex: number }> {
  if (!SUPABASE_STORAGE_UPLOAD_TRIGGER.test(content)) return [];
  const results: Array<{ line: number; matchIndex: number }> = [];
  let match: RegExpExecArray | null;
  // Reset lastIndex for stateful global regex
  SUPABASE_UPLOAD_CALL_RE.lastIndex = 0;
  while ((match = SUPABASE_UPLOAD_CALL_RE.exec(content)) !== null) {
    const optionsBody = match[1] ?? '';
    // Heuristic: if options object exists AND contains contentType key → safe
    const hasContentType = /contentType\s*:/.test(optionsBody);
    if (!hasContentType) {
      results.push({
        line: findLineNumber(content, match.index),
        matchIndex: match.index,
      });
    }
  }
  return results;
}

function findFirstUploadMatchIndex(content: string): number {
  for (const p of DIRECT_UPLOAD_PATTERNS) {
    const m = p.exec(content);
    if (m) {
      if (p.source === DIRECT_UPLOAD_PATTERNS[0].source) {
        if (!FILE_CONTEXT_PATTERN.test(content)) continue;
      }
      return m.index;
    }
  }
  const storageMatch = SUPABASE_STORAGE_UPLOAD_TRIGGER.exec(content);
  if (storageMatch) return storageMatch.index;
  return 0;
}

export const uploadValidatorScanner: Scanner = {
  name: 'upload-validator',
  description: 'Detects file upload handlers that lack magic-byte or MIME-type validation, which can lead to arbitrary file upload vulnerabilities',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const idCounter = { value: 1 };
    const ignore = [...new Set([...['node_modules', 'dist', '.next', '.git'], ...(config.ignore ?? [])])];

    const scanDirs = detectScanDirs(projectPath);

    for (const scanDir of scanDirs) {
      let files: string[];
      try {
        files = walkFiles(scanDir, ignore, ['ts', 'js']);
      } catch {
        continue;
      }

      for (const file of files) {
        const content = readFileSafe(file);
        if (content === null) continue;

        // Existing rule: missing magic-byte validation
        if (hasUploadPattern(content) && !hasMagicByteValidation(content)) {
          const id = `UPLOAD-${String(idCounter.value++).padStart(3, '0')}`;
          const matchIdx = findFirstUploadMatchIndex(content);
          findings.push({
            id,
            scanner: 'upload-validator',
            severity: 'high',
            title: 'File upload handler missing magic-byte validation',
            description:
              'This file handles uploads (formData, multer, formidable, or Supabase storage) but does not import any magic-byte validation library (file-type, magic-bytes, mmmagic) or use sharp for image processing. Without content-type verification, attackers can upload polyglot files or bypass MIME-type checks.',
            file,
            line: findLineNumber(content, matchIdx),
            category: 'security',
            owasp: 'A04:2021',
            cwe: 434,
            fix: {
              description:
                'Client-reported MIME types are user-controlled — a png extension can be a PHP payload. Read the first 4-32 bytes of the upload and compare against a magic-byte allowlist using a library like file-type, magic-bytes, or mmmagic, then reject anything that does not match the expected format. For images, piping through sharp also normalizes the output and strips EXIF.',
              links: [
                'https://cwe.mitre.org/data/definitions/434.html',
                'https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload',
              ],
            },
          });
        }

        // v0.6e enhancement: Supabase `.upload()` without `contentType` option
        // (separate from magic-byte validation — even with magic-byte check,
        // not setting contentType lets Supabase default to MIME-sniff which
        // can be exploited for stored-XSS via misinterpreted bytes)
        for (const hit of findSupabaseUploadsWithoutContentType(content)) {
          const id = `UPLOAD-${String(idCounter.value++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'upload-validator',
            severity: 'medium',
            title: 'Supabase Storage upload missing explicit contentType option',
            description:
              "supabase.storage.from(...).upload(path, file) was called without an explicit { contentType: '...' } option. " +
              'Without it, Supabase Storage falls back to MIME-sniffing the file bytes, which lets an attacker upload HTML masquerading as an image (stored-XSS via Content-Disposition / browser-interpretation). ' +
              "Add the option: `.upload(path, file, { contentType: file.type, upsert: false })`.",
            file,
            line: hit.line,
            category: 'security',
            owasp: 'A04:2021',
            cwe: 434,
            fix: {
              description:
                'Always set contentType on Supabase Storage uploads so the response carries the MIME you expect instead of whatever bytes the browser guesses. Pair with an allowlist check on the server-side (file-type magic bytes) so the client cannot lie about its own type either.',
              code: "await supabase.storage.from('uploads').upload(path, file, { contentType: file.type, upsert: false });",
              links: [
                'https://cwe.mitre.org/data/definitions/434.html',
                'https://supabase.com/docs/guides/storage/uploads#standard-uploads',
              ],
            },
          });
        }
      }
    }

    return {
      scanner: 'upload-validator',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
