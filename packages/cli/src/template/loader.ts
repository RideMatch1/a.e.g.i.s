import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { TemplateManifestSchema, type TemplateManifest } from './types.js';

export interface LoadedTemplate {
  root: string;
  manifest: TemplateManifest;
  /** Paths relative to `<root>/files/`, sorted, forward-slash separators. */
  files: string[];
}

export async function loadTemplate(templateRoot: string): Promise<LoadedTemplate> {
  const manifestPath = join(templateRoot, 'template.json');
  let manifestRaw: string;
  try {
    manifestRaw = await readFile(manifestPath, 'utf-8');
  } catch (err) {
    throw new Error(`Template manifest missing: ${manifestPath} (${(err as Error).message})`);
  }

  const manifestJson = JSON.parse(manifestRaw);
  const manifest = TemplateManifestSchema.parse(manifestJson);

  const filesDir = join(templateRoot, 'files');
  try {
    const s = await stat(filesDir);
    if (!s.isDirectory()) throw new Error(`files/ is not a directory`);
  } catch {
    throw new Error(`Template files/ directory missing: ${filesDir}`);
  }

  const files = await walkFilesDir(filesDir, filesDir);
  files.sort();

  return { root: templateRoot, manifest, files };
}

async function walkFilesDir(base: string, current: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(current, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkFilesDir(base, full)));
    } else if (entry.isFile()) {
      out.push(relative(base, full).split(/[\\/]/).join('/'));
    }
  }
  return out;
}
