import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

function fileExistsInDirs(projectPath: string, patterns: RegExp[]): boolean {
  const searchDirs = [
    join(projectPath, 'src', 'app'),
    join(projectPath, 'app'),
    join(projectPath, 'src', 'pages'),
    join(projectPath, 'pages'),
    join(projectPath, 'src'),
  ];

  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue;
    try {
      // Note: { recursive: true } requires Node 20+. AEGIS enforces "engines.node": ">=20.0.0".
      const entries = readdirSync(dir, { recursive: true }) as string[];
      for (const entry of entries) {
        if (patterns.some((p) => p.test(entry))) return true;
      }
    } catch {
      // ignore unreadable dirs
    }
  }
  return false;
}

async function contentExistsInFiles(
  projectPath: string,
  searchDirs: string[],
  patterns: RegExp[],
  extensions: string[],
  ignoreList: string[] = ['node_modules', 'dist', '.next'],
): Promise<boolean> {
  for (const dir of searchDirs) {
    if (!existsSync(join(projectPath, dir))) continue;
    try {
      const files = walkFiles(
        join(projectPath, dir),
        ignoreList,
        extensions,
      );
      for (const file of files) {
        const content = readFileSafe(file);
        if (content === null) continue;
        if (patterns.some((p) => p.test(content))) return true;
      }
    } catch {
      // skip
    }
  }
  return false;
}

async function migrationContains(projectPath: string, patterns: RegExp[]): Promise<boolean> {
  const migrationDirs = [
    join(projectPath, 'supabase', 'migrations'),
    join(projectPath, 'migrations'),
    join(projectPath, 'db', 'migrations'),
  ];

  for (const dir of migrationDirs) {
    if (!existsSync(dir)) continue;
    try {
      const files = walkFiles(dir, [], ['sql', 'ts', 'js']);
      for (const file of files) {
        const content = readFileSafe(file);
        if (content === null) continue;
        if (patterns.some((p) => p.test(content))) return true;
      }
    } catch {
      // skip
    }
  }
  return false;
}

/** EU member state locale prefixes (2-letter ISO 639-1 codes) */
const EU_LOCALE_PREFIXES = [
  'de', // German (Germany, Austria, Luxembourg)
  'fr', // French (France, Belgium, Luxembourg)
  'it', // Italian (Italy)
  'es', // Spanish (Spain)
  'nl', // Dutch (Netherlands, Belgium)
  'pl', // Polish (Poland)
  'pt', // Portuguese (Portugal)
  'sv', // Swedish (Sweden)
  'da', // Danish (Denmark)
  'fi', // Finnish (Finland)
  'el', // Greek (Greece, Cyprus)
  'cs', // Czech (Czech Republic)
  'sk', // Slovak (Slovakia)
  'hu', // Hungarian (Hungary)
  'ro', // Romanian (Romania)
  'bg', // Bulgarian (Bulgaria)
  'hr', // Croatian (Croatia)
  'sl', // Slovenian (Slovenia)
  'lt', // Lithuanian (Lithuania)
  'lv', // Latvian (Latvia)
  'et', // Estonian (Estonia)
  'mt', // Maltese (Malta)
  'ga', // Irish (Ireland)
  'lb', // Luxembourgish (Luxembourg)
];

function isEuLocale(locale: string): boolean {
  const prefix = locale.slice(0, 2).toLowerCase();
  return EU_LOCALE_PREFIXES.includes(prefix);
}

/** DACH locales get higher severity for German IT-law checks */
function isDachLocale(locale?: string): boolean {
  if (!locale) return false;
  const lower = locale.toLowerCase();
  return lower.startsWith('de') || lower.startsWith('at') || lower.startsWith('ch');
}

/**
 * Find files matching name patterns and return their full paths.
 * Used when we need to locate AND read specific files.
 */
function findFilesInDirs(projectPath: string, namePatterns: RegExp[], exts: string[], ignoreList: string[] = ['node_modules', 'dist', '.next']): string[] {
  const searchDirs = [
    join(projectPath, 'src', 'app'),
    join(projectPath, 'app'),
    join(projectPath, 'src', 'pages'),
    join(projectPath, 'pages'),
    join(projectPath, 'src'),
    join(projectPath, 'src', 'components'),
    join(projectPath, 'components'),
  ];
  const results: string[] = [];

  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue;
    try {
      const files = walkFiles(dir, ignoreList, exts);
      for (const file of files) {
        const basename = file.split('/').pop() ?? '';
        const relPath = file.replace(projectPath, '');
        if (namePatterns.some((p) => p.test(basename) || p.test(relPath))) {
          results.push(file);
        }
      }
    } catch {
      // skip
    }
  }
  return results;
}

/**
 * Scan files for content patterns and return matches with file path and content.
 */
async function findContentInFiles(
  projectPath: string,
  searchDirs: string[],
  contentPatterns: RegExp[],
  extensions: string[],
  ignoreList: string[] = ['node_modules', 'dist', '.next'],
): Promise<{ file: string; content: string }[]> {
  const matches: { file: string; content: string }[] = [];
  for (const dir of searchDirs) {
    if (!existsSync(join(projectPath, dir))) continue;
    try {
      const files = walkFiles(
        join(projectPath, dir),
        ignoreList,
        extensions,
      );
      for (const file of files) {
        const content = readFileSafe(file);
        if (content === null) continue;
        if (contentPatterns.some((p) => p.test(content))) {
          matches.push({ file, content });
        }
      }
    } catch {
      // skip
    }
  }
  return matches;
}

export const gdprEngineScanner: Scanner = {
  name: 'gdpr-engine',
  description:
    'Checks GDPR/DSGVO compliance: privacy page, imprint, cookie consent, data export/deletion, PII safety, encryption, logging, audit trail, consent table, Google Fonts, CDN IP transfer, YouTube embeds, newsletter opt-in, Impressum completeness',
  category: 'compliance',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const defaultIgnore = ['node_modules', 'dist', '.next', '.git'];
    const ignore = [...new Set([...defaultIgnore, ...(config.ignore ?? [])])];

    const locale = config.locale;
    const compliance = config.compliance;
    const isDach = isDachLocale(locale);

    // --- Universal checks (GDPR-013 to GDPR-018) ---
    // These run for ALL projects since GDPR applies to anyone processing EU citizen data.
    // DACH locales get higher severity due to specific German/Austrian/Swiss IT-law rulings.

    // GDPR-013: Google Fonts CDN Detection
    const fontFiles = walkFiles(
      projectPath,
      ignore,
      ['tsx', 'jsx', 'html', 'css'],
    );
    for (const file of fontFiles) {
      const content = readFileSafe(file);
      if (content === null) continue;
      if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(content)) {
        findings.push({
          id: 'GDPR-013',
          scanner: 'gdpr-engine',
          severity: isDach ? 'critical' : 'high',
          title: 'Google Fonts loaded from CDN',
          description:
            'Google Fonts loaded from CDN transfers visitor IPs to Google without consent. Self-host fonts locally. (LG München I, Az. 3 O 17493/20 — up to €100/visitor fine in Germany)',
          file,
          category: 'compliance',
        });
        break; // One finding is enough
      }
    }

    // GDPR-014: External Resource IP Transfer
    const cdnPatterns = /cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|bootstrapcdn\.com/;
    const resourceFiles = walkFiles(
      projectPath,
      ignore,
      ['tsx', 'jsx', 'html', 'css', 'ts', 'js'],
    );
    for (const file of resourceFiles) {
      const content = readFileSafe(file);
      if (content === null) continue;
      if (cdnPatterns.test(content)) {
        findings.push({
          id: 'GDPR-014',
          scanner: 'gdpr-engine',
          severity: isDach ? 'high' : 'medium',
          title: 'External CDN transfers visitor IPs',
          description:
            'External CDN references transfer visitor IP addresses to third parties. Disclose in Datenschutzerklärung or self-host resources.',
          file,
          category: 'compliance',
        });
        break;
      }
    }

    // GDPR-015: Cookie Consent Quality
    const cookieBannerFiles = await findContentInFiles(
      projectPath,
      ['src', 'components', 'app', 'pages'],
      [/cookie[-_]?consent/i, /cookieBanner/i, /CookieConsent/i, /consentBanner/i, /cookie[-_]?banner/i],
      ['ts', 'tsx', 'js', 'jsx'],
      ignore,
    );
    if (cookieBannerFiles.length > 0) {
      const hasReject = cookieBannerFiles.some(({ content }) =>
        /reject|ablehnen|decline|deny|refuse/i.test(content),
      );
      if (!hasReject) {
        findings.push({
          id: 'GDPR-015',
          scanner: 'gdpr-engine',
          severity: isDach ? 'high' : 'medium',
          title: 'Cookie banner missing reject option',
          description:
            'Cookie banner found but missing an equally prominent reject/decline option. TTDSG §25 requires that rejection is as easy as acceptance.',
          file: cookieBannerFiles[0].file,
          category: 'compliance',
        });
      }
    }

    // GDPR-016: Newsletter Double-Opt-In
    const newsletterFiles = await findContentInFiles(
      projectPath,
      ['src', 'app', 'pages', 'lib'],
      [/newsletter/i, /email.*subscribe|subscribe.*email|subscribe.*newsletter/i, /mailing[-_]?list/i],
      ['ts', 'js'],
      ignore,
    );
    if (newsletterFiles.length > 0) {
      const hasDoubleOptIn = newsletterFiles.some(({ content }) =>
        /confirm|verify|double[-_]?opt[-_]?in|bestätigung|bestaetigung|verification[-_]?token/i.test(content),
      );
      if (!hasDoubleOptIn) {
        findings.push({
          id: 'GDPR-016',
          scanner: 'gdpr-engine',
          severity: isDach ? 'high' : 'medium',
          title: 'Newsletter signup without double-opt-in',
          description:
            'Newsletter/subscribe API found without double-opt-in verification pattern. TTDSG §25 and German case law require confirmed opt-in for email marketing.',
          file: newsletterFiles[0]?.file,
          category: 'compliance',
        });
      }
    }

    // GDPR-017: YouTube Embed Check
    const youtubeFiles = walkFiles(
      projectPath,
      ignore,
      ['tsx', 'jsx'],
    );
    for (const file of youtubeFiles) {
      const content = readFileSafe(file);
      if (content === null) continue;
      if (/youtube\.com\/embed/.test(content) && !/youtube-nocookie\.com/.test(content)) {
        findings.push({
          id: 'GDPR-017',
          scanner: 'gdpr-engine',
          severity: isDach ? 'high' : 'medium',
          title: 'YouTube embed transfers data to Google',
          description:
            'YouTube embed detected without privacy-enhanced mode. Use youtube-nocookie.com or implement a consent gate to prevent data transfer to Google before user consent.',
          file,
          category: 'compliance',
        });
        break;
      }
    }

    // GDPR-018: Impressum Completeness
    const impressumFiles = findFilesInDirs(projectPath, [/impressum/i, /imprint/i], ['tsx', 'jsx', 'ts', 'js', 'html'], ignore);
    if (impressumFiles.length > 0) {
      const impressumContent = readFileSafe(impressumFiles[0]);
      if (impressumContent) {
        const checks: { field: string; pattern: RegExp }[] = [
          { field: 'Business name / Firmenname', pattern: /GmbH|UG|AG|e\.K\.|OHG|KG|Inc\.|LLC|Ltd|Einzelunternehm/i },
          { field: 'Address / Anschrift', pattern: /Str\.|Straße|Strasse|Weg\s|Platz\s|Allee\s|Gasse|street|address|Anschrift/i },
          { field: 'Email / E-Mail', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|e-?mail|kontakt/i },
          { field: 'Phone / Telefon', pattern: /telefon|phone|tel\.|fon:|fax:|anruf|\+\d{2}/i },
          { field: 'Handelsregister / HRB', pattern: /handelsregister|HRB|HRA|Amtsgericht|Registergericht|commercial register/i },
          { field: 'USt-IdNr / VAT ID', pattern: /USt[-.]?Id|Umsatzsteuer|VAT|UID|Steuernummer|tax.?id/i },
        ];

        for (const check of checks) {
          if (!check.pattern.test(impressumContent)) {
            findings.push({
              id: 'GDPR-018',
              scanner: 'gdpr-engine',
              severity: isDach ? 'medium' : 'low',
              title: `Impressum incomplete — missing ${check.field}`,
              description:
                `Impressum page appears to be missing ${check.field}. Required under TMG §5 / DDG for commercial websites.`,
              file: impressumFiles[0],
              category: 'compliance',
            });
          }
        }
      }
    }

    // --- GDPR-scope checks (GDPR-001 to GDPR-012) ---
    // These only run for EU locales or when compliance includes 'gdpr'
    const isGdprScope =
      (typeof locale === 'string' && isEuLocale(locale)) ||
      (Array.isArray(compliance) &&
        compliance.some((c) => typeof c === 'string' && c.includes('gdpr')));

    if (!isGdprScope) {
      return {
        scanner: 'gdpr-engine',
        category: 'compliance',
        findings,
        duration: Date.now() - start,
        available: true,
      };
    }

    // GDPR-001: Privacy page exists
    const hasPrivacyPage = fileExistsInDirs(projectPath, [
      /datenschutz/i,
      /privacy[-_]?policy/i,
      /privacy/i,
    ]);
    if (!hasPrivacyPage) {
      findings.push({
        id: 'GDPR-001',
        scanner: 'gdpr-engine',
        severity: 'critical',
        title: 'Missing privacy policy page',
        description:
          'No Datenschutzerklärung (privacy policy) page was found. Under DSGVO Art. 13/14 this is mandatory. Expected path: /datenschutz or /privacy-policy.',
        category: 'compliance',
      });
    }

    // GDPR-002: Imprint page exists
    const hasImprintPage = fileExistsInDirs(projectPath, [/impressum/i, /imprint/i]);
    if (!hasImprintPage) {
      findings.push({
        id: 'GDPR-002',
        scanner: 'gdpr-engine',
        severity: 'critical',
        title: 'Missing imprint (Impressum) page',
        description:
          'No Impressum page was found. Under §5 DDG (ehemals TMG) this is mandatory for commercial websites in Germany.',
        category: 'compliance',
      });
    }

    // GDPR-003: Cookie consent component exists
    const hasCookieConsent = await contentExistsInFiles(
      projectPath,
      ['src', 'components', 'app', 'pages'],
      [/cookie[-_]?consent/i, /cookieBanner/i, /CookieConsent/i, /consentBanner/i],
      ['ts', 'tsx', 'js', 'jsx'],
      ignore,
    );
    if (!hasCookieConsent) {
      findings.push({
        id: 'GDPR-003',
        scanner: 'gdpr-engine',
        severity: 'high',
        title: 'Missing cookie consent component',
        description:
          'No cookie consent component was found. TTDSG §25 requires explicit consent before setting non-essential cookies.',
        category: 'compliance',
      });
    }

    // GDPR-004: Data export API (Art. 15 DSGVO — Auskunftsrecht)
    const hasDataExport = await contentExistsInFiles(
      projectPath,
      ['src', 'app', 'pages'],
      [/data[-_]?export/i, /export[-_]?data/i, /daten[-_]?export/i, /auskunft/i],
      ['ts', 'js'],
      ignore,
    );
    if (!hasDataExport) {
      findings.push({
        id: 'GDPR-004',
        scanner: 'gdpr-engine',
        severity: 'medium',
        title: 'Missing data export API (Art. 15 DSGVO)',
        description:
          'No data export API endpoint was found. Art. 15 DSGVO gives data subjects the right to obtain a copy of their personal data.',
        category: 'compliance',
      });
    }

    // GDPR-005: Data deletion API (Art. 17 DSGVO — Recht auf Vergessenwerden)
    const hasDataDeletion = await contentExistsInFiles(
      projectPath,
      ['src', 'app', 'pages'],
      [/data[-_]?delet/i, /delet[-_]?account/i, /account[-_]?delet/i, /loeschung/i, /löschung/i],
      ['ts', 'js'],
      ignore,
    );
    if (!hasDataDeletion) {
      findings.push({
        id: 'GDPR-005',
        scanner: 'gdpr-engine',
        severity: 'medium',
        title: 'Missing data deletion API (Art. 17 DSGVO)',
        description:
          'No data deletion API endpoint was found. Art. 17 DSGVO gives data subjects the right to erasure ("right to be forgotten").',
        category: 'compliance',
      });
    }

    // GDPR-006: PII not in profiles table (email/phone columns)
    const profilesHasPII = await migrationContains(projectPath, [
      /CREATE TABLE[^;]*profiles[^;]*(email|phone|telefon|handynummer)/is,
      /ALTER TABLE[^;]*profiles[^;]*ADD[^;]*(email|phone)/is,
    ]);
    if (profilesHasPII) {
      findings.push({
        id: 'GDPR-006',
        scanner: 'gdpr-engine',
        severity: 'high',
        title: 'PII (email/phone) found in profiles table',
        description:
          'The profiles table appears to store email or phone number columns. PII should not be duplicated from auth.users into the profiles table — this violates the DSGVO data-minimisation principle (Art. 5(1)(c)) and creates dual-deletion complexity.',
        category: 'compliance',
      });
    }

    // GDPR-007: Encryption utility exists
    const hasEncryptUtil = await contentExistsInFiles(
      projectPath,
      ['src/lib', 'src/utils', 'lib', 'utils'],
      [/AES-256-GCM/i, /createCipheriv/i, /export.*encrypt/i],
      ['ts', 'js'],
      ignore,
    );
    if (!hasEncryptUtil) {
      findings.push({
        id: 'GDPR-007',
        scanner: 'gdpr-engine',
        severity: 'medium',
        title: 'Missing encryption utility for sensitive data',
        description:
          'No AES-256-GCM encryption utility was found. Sensitive fields (API keys, passwords stored in DB) must be encrypted at the application layer in addition to storage encryption.',
        category: 'compliance',
      });
    }

    // GDPR-008: PII-safe logger exists
    const hasSafeLogger = await contentExistsInFiles(
      projectPath,
      ['src/lib', 'src/utils', 'lib', 'utils'],
      [/sanitiz/i, /redact/i, /pii/i],
      ['ts', 'js'],
      ignore,
    );
    if (!hasSafeLogger) {
      findings.push({
        id: 'GDPR-008',
        scanner: 'gdpr-engine',
        severity: 'medium',
        title: 'Missing PII-safe logger',
        description:
          'No logger with PII sanitization/redaction was found. Logging personal data without filtering violates DSGVO Art. 32 (security of processing). Implement a logger that redacts sensitive fields before writing to logs.',
        category: 'compliance',
      });
    }

    // GDPR-009: Audit log table/API
    const hasAuditLog = await migrationContains(projectPath, [
      /CREATE TABLE[^;]*audit/i,
      /audit_log/i,
      /audit_trail/i,
    ]);
    const hasAuditApi = await contentExistsInFiles(
      projectPath,
      ['src', 'app', 'pages', 'lib'],
      [/audit[-_]?log/i, /auditLog/i, /audit_log/i],
      ['ts', 'js'],
      ignore,
    );
    if (!hasAuditLog && !hasAuditApi) {
      findings.push({
        id: 'GDPR-009',
        scanner: 'gdpr-engine',
        severity: 'medium',
        title: 'Missing audit log table/API',
        description:
          'No audit log table or API was found. An audit trail is required for accountability under DSGVO Art. 5(2) (accountability principle) and is essential for breach investigations.',
        category: 'compliance',
      });
    }

    // GDPR-010: Consent table in migrations
    const hasConsentTable = await migrationContains(projectPath, [
      /CREATE TABLE[^;]*consent/i,
      /consent_log/i,
      /cookie_consent/i,
    ]);
    if (!hasConsentTable) {
      findings.push({
        id: 'GDPR-010',
        scanner: 'gdpr-engine',
        severity: 'high',
        title: 'Missing consent table in database',
        description:
          'No consent table was found in the database migrations. DSGVO Art. 7 requires that consent can be proven — a consent_log or cookie_consent table is needed to record when and what users consented to.',
        category: 'compliance',
      });
    }

    // GDPR-011: Rate-limiting on auth endpoints (Art. 32 — security of processing)
    const hasRateLimit = await contentExistsInFiles(
      projectPath,
      ['src', 'app', 'pages', 'lib', 'utils', 'middleware'],
      [/rate[-_]?limit/i, /rateLimit/i, /throttle/i, /brute[-_]?force/i, /checkIPRateLimit/i],
      ['ts', 'js'],
      ignore,
    );
    if (!hasRateLimit) {
      findings.push({
        id: 'GDPR-011',
        scanner: 'gdpr-engine',
        severity: 'medium',
        title: 'Missing rate-limiting on authentication endpoints',
        description:
          'No rate-limiting mechanism was found. GDPR Art. 32 requires appropriate technical measures to ensure security of processing. Rate-limiting on auth endpoints prevents brute-force attacks against user accounts.',
        category: 'compliance',
      });
    }

    // GDPR-012: Logging/audit trail for data access
    const hasAccessLogging = await contentExistsInFiles(
      projectPath,
      ['src', 'app', 'lib', 'utils'],
      [/access[-_]?log/i, /accessLog/i, /data[-_]?access[-_]?log/i, /logAccess/i, /log_access/i, /audit[-_]?trail/i, /auditTrail/i],
      ['ts', 'js'],
      ignore,
    );
    if (!hasAccessLogging && !hasAuditLog && !hasAuditApi) {
      findings.push({
        id: 'GDPR-012',
        scanner: 'gdpr-engine',
        severity: 'medium',
        title: 'Missing logging/audit trail for data access',
        description:
          'No data access logging or audit trail was found. GDPR Art. 5(2) (accountability) and Art. 30 (records of processing) require organisations to maintain records of when and how personal data is accessed. Implement access logging for sensitive data endpoints.',
        category: 'compliance',
      });
    }

    return {
      scanner: 'gdpr-engine',
      category: 'compliance',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
