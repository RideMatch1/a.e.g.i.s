/**
 * Skill-loader — walks the `skills/` tree, reads each `SKILL.md` frontmatter,
 * and returns a structured list for the CLI to render or copy.
 *
 * Two layouts are supported, matching the published-vs-monorepo resolution
 * pattern already in use by `@aegis-wizard/cli`:
 *
 *   1. Installed layout — after `npm install`, `dist/bin.js` sits next to
 *      `dist/…` and the `skills/` tree lives at `<pkg-root>/skills/`.
 *      From `dist/` that is one `..` step up then into `skills/`.
 *
 *   2. Monorepo-dev layout — when tests run from the source tree under
 *      vitest, `src/` is the anchor and `skills/` lives one directory up.
 *
 * The installed layout is tried first. The monorepo layout is the
 * dev-loop fallback. If neither resolves, an error with both searched
 * paths surfaces.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface LoadedSkill {
  /** Skill id in `<category>-<name>` form, unique per package. */
  id: string;
  /** Category from the parent directory (`offensive`, `defensive`, etc). */
  category: string;
  /** Source-namespace directory (`snailsploit-fork`, future: `anthropic-pick`, etc). */
  source: string;
  /** Skill name from the leaf directory (e.g. `sqli`, `xss`). */
  name: string;
  /** Skill title taken from the first `# ` heading after any frontmatter. */
  title: string;
  /** Short description extracted from YAML frontmatter or `## Description` body. */
  description: string;
  /** Upstream source-url from `## Metadata > Source:` bullet, or null if YAML-only. */
  upstreamSourceUrl: string | null;
  /** Absolute on-disk path to the `SKILL.md` file. */
  absolutePath: string;
  /** Path relative to the package's `skills/` root, stable across install layouts. */
  relativePath: string;
}

export function resolveSkillsRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const installed = resolve(here, '..', 'skills');
  if (existsSync(installed) && statSync(installed).isDirectory()) {
    return installed;
  }
  const monorepo = resolve(here, '..', '..', 'skills');
  if (existsSync(monorepo) && statSync(monorepo).isDirectory()) {
    return monorepo;
  }
  throw new Error(
    `Skill directory not found. Searched:\n  ${installed}\n  ${monorepo}\n` +
      'This is a packaging bug in @aegis-scan/skills — please file an issue.',
  );
}

export function loadAllSkills(root: string = resolveSkillsRoot()): LoadedSkill[] {
  const out: LoadedSkill[] = [];
  const categories = safeReaddirDirs(root);
  for (const category of categories) {
    const categoryDir = join(root, category);
    // Each category either contains per-source namespace dirs (offensive/
    // holds snailsploit-fork/…) or holds a single placeholder README
    // pending future content. Skip everything that is not a directory of
    // directories that hold a SKILL.md file.
    const children = safeReaddirDirs(categoryDir);
    for (const child of children) {
      const childPath = join(categoryDir, child);
      const grandChildren = safeReaddirDirs(childPath);
      if (grandChildren.length === 0) {
        // `category/child/SKILL.md` layout — no source-namespace.
        const skill = tryLoadSkill(root, categoryDir, category, '', child, childPath);
        if (skill) out.push(skill);
        continue;
      }
      // `category/source/name/SKILL.md` layout (the v0.1.0 structure).
      for (const name of grandChildren) {
        const skillDir = join(childPath, name);
        const skill = tryLoadSkill(root, categoryDir, category, child, name, skillDir);
        if (skill) out.push(skill);
      }
    }
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

function safeReaddirDirs(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((entry) => !entry.startsWith('.'))
      .filter((entry) => statSync(join(dir, entry)).isDirectory());
  } catch {
    return [];
  }
}

function tryLoadSkill(
  root: string,
  _categoryDir: string,
  category: string,
  source: string,
  name: string,
  skillDir: string,
): LoadedSkill | null {
  const skillFile = join(skillDir, 'SKILL.md');
  if (!existsSync(skillFile)) return null;
  const raw = readFileSync(skillFile, 'utf-8');
  const { title, description, upstreamSourceUrl } = parseFrontmatter(raw, name);
  const id = source ? `${category}-${source}-${name}` : `${category}-${name}`;
  const rel = skillFile.startsWith(root) ? skillFile.slice(root.length + 1) : skillFile;
  return {
    id,
    category,
    source,
    name,
    title,
    description,
    upstreamSourceUrl,
    absolutePath: skillFile,
    relativePath: rel,
  };
}

interface FrontmatterFields {
  title: string;
  description: string;
  upstreamSourceUrl: string | null;
}

function parseFrontmatter(raw: string, fallbackName: string): FrontmatterFields {
  // Skip any leading aegis-local HTML header and blank lines so frontmatter
  // parsing starts at the first semantic line of the upstream content.
  const withoutHeader = stripLeadingHeader(raw);

  // Try YAML frontmatter first (--- … ---). When present, remove it from
  // the body before subsequent heading/paragraph extraction — otherwise a
  // YAML-description that contains a `# ` character, or the YAML block's
  // own delimiters, can confuse the H1-matcher.
  const yaml = extractYamlFrontmatter(withoutHeader);
  let description = '';
  let yamlName = '';
  let body = withoutHeader;
  if (yaml) {
    yamlName = extractScalarField(yaml, 'name');
    description = extractScalarField(yaml, 'description');
    body = stripYamlFrontmatter(withoutHeader);
  }

  // Extract the first `# ` heading of the post-frontmatter body as the
  // rendered title. Falls back to the YAML-declared name, then to the
  // leaf directory name.
  const title = extractFirstH1(body) || yamlName || fallbackName;

  // Look for an upstream Source URL in a `## Metadata` / `- Source:` style
  // bullet. Five upstream files use YAML-only and have no Source URL; return
  // null in that case.
  const upstreamSourceUrl = extractUpstreamSourceUrl(body);

  // If description is still empty, fall back to the first non-empty paragraph
  // after the title.
  if (!description) {
    description = extractFirstParagraph(body, title) || '';
  }

  return {
    title: title.trim(),
    description: description.trim(),
    upstreamSourceUrl,
  };
}

function stripYamlFrontmatter(body: string): string {
  return body.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/u, '');
}

function stripLeadingHeader(raw: string): string {
  // Remove the aegis-local HTML comment if present plus any blank lines
  // immediately following. Works whether the comment occupies one line or
  // spans a couple.
  const lines = raw.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && /^<!--/.test(lines[i])) {
    while (i < lines.length && !/-->/.test(lines[i])) i++;
    i++; // consume the line containing -->
    while (i < lines.length && lines[i].trim() === '') i++;
  }
  return lines.slice(i).join('\n');
}

function extractYamlFrontmatter(body: string): string | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(body);
  return match ? match[1] : null;
}

function extractScalarField(yaml: string, field: string): string {
  // Minimal YAML-scalar extraction for `name: value` and `description: "value"`.
  // Does not support nested objects or multi-line block-scalars — sufficient
  // for the shape produced by the upstream skill authors.
  const re = new RegExp(`^${field}\\s*:\\s*(.*)$`, 'm');
  const m = re.exec(yaml);
  if (!m) return '';
  let value = m[1].trim();
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
  return value;
}

/**
 * HARD-CONSTRAINT frontmatter fields introduced in @aegis-scan/skills@0.3.0
 * for the AEGIS Agent Foundation. All fields are strings (comma-separated for
 * lists) so that the minimal YAML-scalar parser can extract them without a
 * full YAML-array implementation. YAML-array support is deferred to a later
 * minor when 3+ skills need true arrays.
 *
 * Backward-compatible: pre-0.3.0 skills without these fields return undefined
 * for each, and the loader continues to function unchanged.
 */
export interface HardConstraintFrontmatter {
  /** Skill identifier from frontmatter `name:`. Required. */
  name: string;
  /** One-line description from frontmatter `description:`. Required. */
  description: string;
  /** Comma-separated tool-categories the skill needs at runtime. */
  required_tools?: string;
  /** Numeric-as-string — how many audit-passes before pre-done. */
  required_audit_passes?: string;
  /** Numeric-as-string — how many quality-gates the skill enforces. */
  enforced_quality_gates?: string;
  /** "true" | "false" — must run pre-done audit before declaring done. */
  pre_done_audit?: string;
  /** "opus" | "sonnet" | "haiku" — model selection hint. */
  model?: string;
  /** SPDX license id, typically "MIT". */
  license?: string;
}

/**
 * Extract a scalar field from a nested `metadata:` block in YAML frontmatter.
 *
 * Looks for an indented `<field>: <value>` line that follows a top-level
 * `metadata:` line. Indentation is two-or-more spaces (typical block style).
 * Returns the value as a string, with optional surrounding quotes stripped.
 * Returns '' if the metadata block or the requested field is absent.
 *
 * This is a minimal extractor matched to the conservative shape SkillForge's
 * Anthropic-skill-spec accepts: `metadata:` is the canonical container for
 * fields outside the small allowlist (agent, allowed-tools, context,
 * description, hooks, license, model, name, user-invocable). True YAML
 * nested-mapping support is deferred until at least one skill needs deeper
 * nesting than two levels.
 */
function extractMetadataField(yaml: string, field: string): string {
  const lines = yaml.split(/\r?\n/);
  let inMetadata = false;
  let metadataIndent = -1;
  for (const line of lines) {
    if (/^metadata\s*:\s*$/.test(line)) {
      inMetadata = true;
      metadataIndent = -1;
      continue;
    }
    if (!inMetadata) continue;
    if (line.trim() === '') continue;
    const indentMatch = /^(\s+)\S/.exec(line);
    if (!indentMatch) {
      // De-dented back to a top-level key — the metadata block has ended.
      inMetadata = false;
      continue;
    }
    const indent = indentMatch[1].length;
    if (metadataIndent === -1) metadataIndent = indent;
    if (indent < metadataIndent) {
      inMetadata = false;
      continue;
    }
    const fieldMatch = new RegExp(`^\\s+${field}\\s*:\\s*(.*)$`).exec(line);
    if (fieldMatch) {
      let value = fieldMatch[1].trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      return value;
    }
  }
  return '';
}

/**
 * Parse HARD-CONSTRAINT frontmatter fields from a SKILL.md raw content.
 * Returns name + description + model + license (top-level allowed by the
 * SkillForge / Anthropic skill spec) plus optional v0.3.0+ HARD-CONSTRAINT
 * fields nested under `metadata:` when the skill declares them.
 *
 * Backward-compat: also accepts the same fields at top-level (pre-canonical
 * v0.3.0-rc layout). Top-level wins if both are present.
 *
 * Tolerates a leading `<!-- aegis-local … -->` HTML header per the upstream
 * convention and ignores trailing body content. Designed to be used by the
 * agent-framework `skill-frontmatter-validator` independently of the broader
 * `loadAllSkills()` directory walker.
 */
export function parseHardConstraintFrontmatter(raw: string): HardConstraintFrontmatter {
  const withoutHeader = stripLeadingHeader(raw);
  const yaml = extractYamlFrontmatter(withoutHeader);
  if (!yaml) {
    return { name: '', description: '' };
  }
  const out: HardConstraintFrontmatter = {
    name: extractScalarField(yaml, 'name'),
    description: extractScalarField(yaml, 'description'),
  };
  // Top-level allowed-list fields per Anthropic skill spec.
  const model = extractScalarField(yaml, 'model');
  if (model) out.model = model;
  const license = extractScalarField(yaml, 'license');
  if (license) out.license = license;

  // HARD-CONSTRAINT fields: prefer metadata-nested (canonical v0.3.0), fall
  // back to top-level (transitional support).
  const pickField = (field: string): string =>
    extractScalarField(yaml, field) || extractMetadataField(yaml, field);

  const required_tools = pickField('required_tools');
  if (required_tools) out.required_tools = required_tools;
  const required_audit_passes = pickField('required_audit_passes');
  if (required_audit_passes) out.required_audit_passes = required_audit_passes;
  const enforced_quality_gates = pickField('enforced_quality_gates');
  if (enforced_quality_gates) out.enforced_quality_gates = enforced_quality_gates;
  const pre_done_audit = pickField('pre_done_audit');
  if (pre_done_audit) out.pre_done_audit = pre_done_audit;

  return out;
}

function extractFirstH1(body: string): string {
  // Walk lines and track code-fence state so `# comment` inside a bash
  // or similar code-block is not mistaken for a markdown H1 heading.
  // Five upstream files (jwt, osint, shellcode, sqli, fuzzing) use
  // YAML-only frontmatter and then dive straight into prose sections
  // where the first `# ` is a genuine top-level heading, but some of
  // those also embed bash code blocks earlier in the narrative, so
  // naive `^#\s+` regex picks the wrong line.
  const lines = body.split(/\r?\n/);
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^#\s+(.+)$/.exec(line);
    if (m) return m[1].trim();
  }
  return '';
}

function extractFirstParagraph(body: string, title: string): string {
  const afterTitle = title ? body.split(`# ${title}`)[1] ?? body : body;
  const para = afterTitle
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .find((p) => p.length > 0 && !p.startsWith('#') && !p.startsWith('---'));
  return para ? para.split(/\r?\n/).join(' ').slice(0, 400) : '';
}

function extractUpstreamSourceUrl(body: string): string | null {
  // Match `- Source: https://…` or `- **Source**: https://…` inside a
  // `## Metadata` section. Only returns URLs matching the known upstream
  // hosts (SnailSploit or sahar042) to avoid false positives from unrelated
  // Source-labeled content elsewhere in the skill.
  const metaIdx = body.indexOf('## Metadata');
  if (metaIdx < 0) return null;
  const segment = body.slice(metaIdx, metaIdx + 2000);
  const match =
    /-\s+\*?\*?Source\*?\*?\s*:\s*(https?:\/\/github\.com\/(?:SnailSploit|sahar042)\/[^\s)]+)/u.exec(
      segment,
    );
  return match ? match[1] : null;
}
