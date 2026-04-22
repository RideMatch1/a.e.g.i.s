#!/usr/bin/env node
/**
 * Auto-generate docs/patterns/index.md from pattern frontmatter.
 *
 * Reads every docs/patterns/<category>/<name>.md via the wizard-cli
 * pattern-loader (so the same Zod validation applies), groups by
 * category, sorts alphabetically within each group, and writes a static
 * Markdown listing committed at docs/patterns/index.md.
 *
 * Usage:
 *   pnpm -F @aegis-wizard/cli build          # build loader first
 *   node scripts/gen-pattern-index.mjs
 *
 * The output is deterministic per the input patterns, so regenerating
 * over a clean tree produces a byte-identical file. CI can run this as
 * a drift-check if needed.
 */
import { loadAllPatterns } from '../packages/wizard-cli/dist/patterns/loader.js';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const patternsDir = join(repoRoot, 'docs', 'patterns');
const outPath = join(patternsDir, 'index.md');

const patterns = await loadAllPatterns(patternsDir);

// Group by category
const byCategory = {};
for (const p of patterns) {
  const cat = p.frontmatter.category;
  (byCategory[cat] ||= []).push(p);
}

// Sort within each category
for (const cat of Object.keys(byCategory)) {
  byCategory[cat].sort((a, b) => a.frontmatter.name.localeCompare(b.frontmatter.name));
}

// Fixed category-order for deterministic output
const CATEGORY_ORDER = ['foundation', 'compliance', 'integration', 'feature'];

let md = '# AEGIS Wizard Pattern Catalog\n\n';
md += '> Auto-generated from pattern frontmatter. Regenerate via `node scripts/gen-pattern-index.mjs`.\n\n';
md += `Total patterns: ${patterns.length}. Grouped by category; within each category sorted alphabetically by name.\n\n`;

for (const category of CATEGORY_ORDER) {
  if (!byCategory[category]) continue;
  const label = category[0].toUpperCase() + category.slice(1);
  md += `## ${label}\n\n`;
  for (const p of byCategory[category]) {
    const desc = p.frontmatter.description.replace(/\s+/g, ' ').trim();
    md += `- **[${p.frontmatter.title}](./${category}/${p.frontmatter.name}.md)** — ${desc}\n`;
  }
  md += '\n';
}

writeFileSync(outPath, md);
console.log(`Wrote ${outPath} (${patterns.length} patterns)`);
