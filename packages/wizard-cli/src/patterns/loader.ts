/**
 * Pattern-loader — walks `docs/patterns/<category>/*.md`, parses gray-matter
 * frontmatter, validates with PatternFrontmatterSchema, returns typed pattern
 * objects ready for brief-composition.
 *
 * Contract invariants:
 *   1. `category` frontmatter MUST match the parent directory name
 *      (category lives in the path, duplicated in frontmatter for visibility).
 *   2. `name` frontmatter MUST match the basename (without .md).
 *   3. Files that fail either invariant OR Zod validation are rejected with
 *      a precise error — loader is fail-fast by design so one bad pattern
 *      never silently ships in a brief.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, basename, dirname, extname, relative } from 'node:path';
import matter from 'gray-matter';
import {
  PatternFrontmatterSchema,
  type PatternCategory,
  type PatternFrontmatter,
} from './schema.js';

// ============================================================================
// Public types
// ============================================================================

export interface LoadedPattern {
  /** Parsed + validated frontmatter. */
  frontmatter: PatternFrontmatter;
  /** Markdown body (everything after the closing `---`). */
  body: string;
  /** Absolute path to the source file (for diagnostics). */
  sourcePath: string;
  /** Repo-relative path (e.g. `docs/patterns/foundation/multi-tenant-supabase.md`). */
  relativePath: string;
}

// ============================================================================
// Single-file loader
// ============================================================================

export async function loadPattern(
  filePath: string,
  rootDir?: string,
): Promise<LoadedPattern> {
  const raw = await readFile(filePath, 'utf-8');
  const parsed = matter(raw);

  let frontmatter: PatternFrontmatter;
  try {
    frontmatter = PatternFrontmatterSchema.parse(parsed.data);
  } catch (err) {
    throw new Error(
      `Pattern ${filePath} failed frontmatter validation: ${(err as Error).message}`,
    );
  }

  // Invariant 1: category matches parent dir
  const parentDir = basename(dirname(filePath));
  if (parentDir !== frontmatter.category) {
    throw new Error(
      `Pattern ${filePath}: frontmatter.category="${frontmatter.category}" does not match parent directory "${parentDir}"`,
    );
  }

  // Invariant 2: name matches basename
  const bare = basename(filePath, extname(filePath));
  if (bare !== frontmatter.name) {
    throw new Error(
      `Pattern ${filePath}: frontmatter.name="${frontmatter.name}" does not match basename "${bare}"`,
    );
  }

  return {
    frontmatter,
    body: parsed.content,
    sourcePath: filePath,
    relativePath: rootDir ? relative(rootDir, filePath) : filePath,
  };
}

// ============================================================================
// Recursive directory walker
// ============================================================================

async function walkMarkdownFiles(dir: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e);
    const st = await stat(p).catch(() => null);
    if (!st) continue;
    if (st.isDirectory()) {
      await walkMarkdownFiles(p, out);
    } else if (st.isFile() && e.endsWith('.md') && !e.startsWith('_') && e !== 'SCHEMA.md' && e !== 'index.md') {
      out.push(p);
    }
  }
}

/**
 * Load every valid pattern-file under `baseDir` (recursively). Invalid files
 * throw on first encounter — caller can catch and report aggregate errors.
 */
export async function loadAllPatterns(baseDir: string): Promise<LoadedPattern[]> {
  const files: string[] = [];
  await walkMarkdownFiles(baseDir, files);
  files.sort();

  const loaded: LoadedPattern[] = [];
  for (const f of files) {
    const p = await loadPattern(f, baseDir);
    loaded.push(p);
  }
  return loaded;
}

/**
 * Filter by category — convenience for brief-composition where only one
 * category's patterns are needed at a given step.
 */
export function filterByCategory(
  patterns: readonly LoadedPattern[],
  category: PatternCategory,
): LoadedPattern[] {
  return patterns.filter((p) => p.frontmatter.category === category);
}
