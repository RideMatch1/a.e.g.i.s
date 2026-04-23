/**
 * `aegis-skills list` — print every skill grouped by category and source.
 *
 * Flags:
 *   --category <name>  Filter to a single category: offensive / defensive
 *                      / mitre-mapped / ops / all (default).
 *   --source <name>    Filter to a single source-namespace within a
 *                      category (e.g. snailsploit-fork). Default: all.
 *   --json             Machine-readable output for scripts or tests.
 */
import { loadAllSkills, type LoadedSkill } from '../skills-loader.js';

export interface ListOptions {
  category?: string;
  source?: string;
  json?: boolean;
}

const VALID_CATEGORIES = new Set(['all', 'offensive', 'defensive', 'mitre-mapped', 'ops']);

export function runList(options: ListOptions = {}): number {
  const categoryFilter = (options.category ?? 'all').toLowerCase();
  if (!VALID_CATEGORIES.has(categoryFilter)) {
    console.error(`Error: --category must be one of ${[...VALID_CATEGORIES].join(', ')}`);
    return 1;
  }

  let skills: LoadedSkill[];
  try {
    skills = loadAllSkills();
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    return 2;
  }

  if (categoryFilter !== 'all') {
    skills = skills.filter((s) => s.category === categoryFilter);
  }
  if (options.source) {
    skills = skills.filter((s) => s.source === options.source);
  }

  if (options.json) {
    const payload = skills.map((s) => ({
      id: s.id,
      category: s.category,
      source: s.source,
      name: s.name,
      title: s.title,
      upstream: s.upstreamSourceUrl,
    }));
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    return 0;
  }

  if (skills.length === 0) {
    console.log(`(no skills found for filter category=${categoryFilter}${options.source ? ` source=${options.source}` : ''})`);
    console.log('');
    console.log('Available categories — see README for coming-soon placeholders.');
    return 0;
  }

  const byCategory = groupBy(skills, (s) => s.category);
  const categories = [...byCategory.keys()].sort();
  for (const category of categories) {
    const groupSkills = byCategory.get(category)!;
    console.log(`## ${category} (${groupSkills.length})`);
    const bySource = groupBy(groupSkills, (s) => s.source || '(uncategorized)');
    const sources = [...bySource.keys()].sort();
    for (const source of sources) {
      const sourceSkills = bySource.get(source)!;
      console.log(`  source: ${source} (${sourceSkills.length})`);
      for (const skill of sourceSkills) {
        console.log(`    ${skill.name.padEnd(24)} ${skill.title}`);
      }
    }
    console.log('');
  }

  console.log(`Total: ${skills.length} skill(s).`);
  return 0;
}

function groupBy<T, K>(items: readonly T[], key: (t: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const existing = out.get(k);
    if (existing) existing.push(item);
    else out.set(k, [item]);
  }
  return out;
}
