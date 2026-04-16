import { walkFiles, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * German words that appear in UI code with ASCII substitutions for umlauts.
 * Each entry is: the wrong ASCII form that signals a missing umlaut.
 * The pattern matches these strings inside quotes, JSX text, template literals,
 * and common prop values (title, placeholder, aria-label, label, toast, throw).
 *
 * Rationale: ue/oe/ae ARE legitimate in URLs and DB keys, so we only flag them
 * when they appear inside string literals / JSX text in .tsx/.jsx files.
 */
const UMLAUT_PATTERNS: Array<{ pattern: RegExp; correct: string; example: string }> = [
  { pattern: /\bUbersicht\b/, correct: 'Übersicht', example: 'Ubersicht' },
  { pattern: /\bUbertragen\b/, correct: 'Übertragen', example: 'Ubertragen' },
  { pattern: /\bUbergabe\b/, correct: 'Übergabe', example: 'Ubergabe' },
  { pattern: /\bUbersetzen\b/, correct: 'Übersetzen', example: 'Ubersetzen' },
  { pattern: /\bLoschen\b/, correct: 'Löschen', example: 'Loschen' },
  { pattern: /\bOffnen\b/, correct: 'Öffnen', example: 'Offnen' },
  { pattern: /\bAndern\b/, correct: 'Ändern', example: 'Andern' },
  { pattern: /\bPrufen\b/, correct: 'Prüfen', example: 'Prufen' },
  { pattern: /\bAusfuhren\b/, correct: 'Ausführen', example: 'Ausfuhren' },
  { pattern: /\bZurucksetzen\b/, correct: 'Zurücksetzen', example: 'Zurucksetzen' },
  { pattern: /\bBestatigen\b/, correct: 'Bestätigen', example: 'Bestatigen' },
  { pattern: /\bZuruckkehren\b/, correct: 'Zurückkehren', example: 'Zuruckkehren' },
  { pattern: /\bAusfullen\b/, correct: 'Ausfüllen', example: 'Ausfullen' },
  { pattern: /\bHinzufugen\b/, correct: 'Hinzufügen', example: 'Hinzufugen' },
  { pattern: /\bLosung\b/, correct: 'Lösung', example: 'Losung' },
  { pattern: /\bVerfugbar\b/, correct: 'Verfügbar', example: 'Verfugbar' },
  { pattern: /\bGrosse\b/, correct: 'Größe', example: 'Grosse' },
  { pattern: /\bStrasse\b/, correct: 'Straße', example: 'Strasse' },
  { pattern: /\bSchliessen\b/, correct: 'Schließen', example: 'Schliessen' },
  { pattern: /\bHeissen\b/, correct: 'Heißen', example: 'Heissen' },
  { pattern: /\bGrussen\b/, correct: 'Grüßen', example: 'Grussen' },
];

/** French accent ASCII substitutions — only checked when locale is 'fr' */
const FRENCH_ACCENT_PATTERNS: Array<{ pattern: RegExp; correct: string; example: string }> = [
  { pattern: /\bResume\b/, correct: 'Résumé', example: 'Resume' },
  { pattern: /\bCafe\b/, correct: 'Café', example: 'Cafe' },
  { pattern: /\bElegant\b/, correct: 'Élégant', example: 'Elegant' },
  { pattern: /\bEtude\b/, correct: 'Étude', example: 'Etude' },
  { pattern: /\bEtat\b/, correct: 'État', example: 'Etat' },
  { pattern: /\bEcole\b/, correct: 'École', example: 'Ecole' },
  { pattern: /\bEtape\b/, correct: 'Étape', example: 'Etape' },
  { pattern: /\bEvenement\b/, correct: 'Événement', example: 'Evenement' },
  { pattern: /\bPrenom\b/, correct: 'Prénom', example: 'Prenom' },
  { pattern: /\bNumero\b/, correct: 'Numéro', example: 'Numero' },
];

/** Spanish accent ASCII substitutions — only checked when locale is 'es' */
const SPANISH_ACCENT_PATTERNS: Array<{ pattern: RegExp; correct: string; example: string }> = [
  { pattern: /\bInformacion\b/, correct: 'Información', example: 'Informacion' },
  { pattern: /\bDireccion\b/, correct: 'Dirección', example: 'Direccion' },
  { pattern: /\bTelefono\b/, correct: 'Teléfono', example: 'Telefono' },
  { pattern: /\bBusqueda\b/, correct: 'Búsqueda', example: 'Busqueda' },
  { pattern: /\bPagina\b/, correct: 'Página', example: 'Pagina' },
  { pattern: /\bContrasena\b/, correct: 'Contraseña', example: 'Contrasena' },
  { pattern: /\bAno\b/, correct: 'Año', example: 'Ano' },
  { pattern: /\bEspanol\b/, correct: 'Español', example: 'Espanol' },
  { pattern: /\bSesion\b/, correct: 'Sesión', example: 'Sesion' },
  { pattern: /\bNavegacion\b/, correct: 'Navegación', example: 'Navegacion' },
];

// Contexts where we look for these patterns (lines containing string indicators)
const STRING_CONTEXT = /["'`>]|title=|placeholder=|aria-label=|label=|toast|throw\s/;

// Pattern 2: hardcoded visible text in JSX (strings > 3 chars, not in attr values for className/key/href/src/id)
const JSX_ATTR_SKIP = /(?:className|key|href|src|id|style|data-\w+)\s*=\s*["'`{]/;
const JSX_TEXT_PATTERN = />\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s,.:!?-]{3,})\s*</g;

/** Files where we expect the <html> tag with lang attribute */
const ROOT_FILENAMES = ['layout.tsx', 'layout.jsx', '_app.tsx', '_app.jsx', '_document.tsx', '_document.jsx', 'index.html'];

function findLineNumber(content: string, matchIndex: number): number {
  return content.slice(0, matchIndex).split('\n').length;
}

function getLocaleAccentPatterns(locale?: string): Array<{ pattern: RegExp; correct: string; example: string }> {
  if (!locale) return [];
  const prefix = locale.slice(0, 2).toLowerCase();
  switch (prefix) {
    case 'fr':
      return FRENCH_ACCENT_PATTERNS;
    case 'es':
      return SPANISH_ACCENT_PATTERNS;
    default:
      return [];
  }
}

export const i18nQualityScanner: Scanner = {
  name: 'i18n-quality',
  description:
    'Detects missing German umlauts (ASCII substitutions), locale-specific accent issues, missing lang attribute, and hardcoded UI strings in JSX/TSX files',
  category: 'i18n',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;
    const defaultIgnore = ['node_modules', 'dist', '.next', '.git'];
    const ignore = [...new Set([...defaultIgnore, ...(config.ignore ?? [])])];

    // Build the full set of accent patterns to check
    const accentPatterns = [
      ...UMLAUT_PATTERNS,
      ...getLocaleAccentPatterns(config.locale),
    ];

    const files = walkFiles(
      projectPath,
      ignore,
      ['tsx', 'jsx'],
    );

    for (const file of files) {
      const content = readFileSafe(file);
      if (content === null) continue;

      const lines = content.split('\n');

      // Pattern 1: umlaut/accent substitutions
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];

        // Only check lines that appear to be in a string/JSX context
        if (!STRING_CONTEXT.test(line)) continue;

        for (const { pattern, correct, example } of accentPatterns) {
          if (pattern.test(line)) {
            const id = `I18N-${String(idCounter++).padStart(3, '0')}`;
            findings.push({
              id,
              scanner: 'i18n-quality',
              severity: 'high',
              title: `Missing accent/umlaut: "${example}" should be "${correct}"`,
              description: `Found ASCII substitution "${example}" in UI text. Proper locale-specific characters must be used in all visible text. Correct form: "${correct}".`,
              file,
              line: lineIdx + 1,
              category: 'i18n',
            });
          }
        }
      }

      // Pattern 2: hardcoded visible JSX text — only flag if project uses i18n
      if (!config.stack.hasI18n) continue;
      let match: RegExpExecArray | null;
      const re = new RegExp(JSX_TEXT_PATTERN.source, 'g');
      while ((match = re.exec(content)) !== null) {
        const text = match[1].trim();
        if (text.length <= 3) continue;

        // Skip if the surrounding line looks like a skippable attribute
        const lineNum = findLineNumber(content, match.index);
        const lineContent = lines[lineNum - 1] ?? '';
        if (JSX_ATTR_SKIP.test(lineContent)) continue;

        const id = `I18N-${String(idCounter++).padStart(3, '0')}`;
        findings.push({
          id,
          scanner: 'i18n-quality',
          severity: 'info',
          title: 'Hardcoded visible text in JSX',
          description: `Text "${text}" appears hardcoded in JSX. Consider extracting to an i18n translation key for multi-language support.`,
          file,
          line: lineNum,
          category: 'i18n',
        });
      }
    }

    // Pattern 3: Missing lang attribute on <html> tag in root layout files
    const rootSearchDirs = [
      join(projectPath, 'src', 'app'),
      join(projectPath, 'app'),
      join(projectPath, 'src', 'pages'),
      join(projectPath, 'pages'),
      join(projectPath, 'src'),
      projectPath,
    ];

    for (const dir of rootSearchDirs) {
      for (const rootFile of ROOT_FILENAMES) {
        const fullPath = join(dir, rootFile);
        if (!existsSync(fullPath)) continue;

        const content = readFileSafe(fullPath);
        if (!content) continue;

        // Check if file has <html without lang=
        const hasHtmlTag = /<html[\s>]/i.test(content);
        if (!hasHtmlTag) continue;

        const hasLangAttr = /<html[^>]*\blang\s*=/i.test(content);
        if (!hasLangAttr) {
          const id = `I18N-${String(idCounter++).padStart(3, '0')}`;
          findings.push({
            id,
            scanner: 'i18n-quality',
            severity: 'high',
            title: 'Missing lang attribute on <html> tag',
            description: `The <html> tag in ${rootFile} does not have a lang attribute. The lang attribute is required for accessibility (WCAG 3.1.1) and helps search engines and screen readers determine the page language.`,
            file: fullPath,
            line: 1,
            fileLevel: true,
            category: 'i18n',
          });
        }
      }
    }

    return {
      scanner: 'i18n-quality',
      category: 'i18n',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
