import { readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

function parseJson<T>(content: string): T | null {
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/** Well-known PUBLIC npm scopes — these are NOT dependency confusion risks */
const PUBLIC_SCOPES = new Set([
  // Build tools & test
  '@types', '@babel', '@rollup', '@vitejs', '@vitest', '@jest',
  '@testing-library', '@swc', '@esbuild', '@parcel', '@turbo',
  '@typescript-eslint', '@eslint', '@biomejs',
  // UI frameworks & components
  '@tanstack', '@radix-ui', '@shadcn', '@headlessui', '@heroicons',
  '@lucide', '@iconify', '@phosphor-icons', '@tabler',
  '@emotion', '@mui', '@mantine', '@chakra-ui', '@base-ui',
  '@dnd-kit', '@floating-ui', '@popperjs',
  // Forms & validation
  '@hookform', '@t3-oss', '@trpc', '@zod',
  // Frameworks
  '@next', '@remix-run', '@sveltejs', '@angular', '@vue', '@nuxt',
  '@nestjs', '@fastify', '@hono', '@koa', '@feathersjs',
  // Cloud & infrastructure
  '@supabase', '@prisma', '@auth', '@clerk',
  '@google-cloud', '@aws-sdk', '@azure', '@vercel', '@netlify',
  '@cloudflare', '@railway', '@fly',
  // AI & ML
  '@anthropic-ai', '@mistralai', '@openai', '@huggingface',
  '@modelcontextprotocol', '@langchain',
  // Payment & services
  '@stripe', '@paypal', '@adyen', '@twilio', '@sendgrid',
  '@sentry', '@datadog', '@elastic', '@grafana',
  // Content & rich text
  '@tiptap', '@lexical', '@codemirror', '@uiw', '@toast-ui',
  // Misc well-known
  '@fontsource', '@fortawesome', '@nivo', '@recharts',
  '@storybook', '@chromatic', '@changesets',
  '@playwright', '@tailwindcss', '@postcss', '@autoprefixer',
  '@hugeicons', '@total-typescript', '@antfu',
  '@aegis-security', '@aegis-scan', '@cyclonedx', '@ossf',
]);

function extractScopedPackages(pkg: PackageJson): string[] {
  const allDeps: Record<string, string> = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.peerDependencies ?? {}),
  };
  return Object.keys(allDeps)
    .filter((name) => name.startsWith('@'))
    .filter((name) => {
      const scope = name.split('/')[0];
      return !PUBLIC_SCOPES.has(scope); // Only keep potentially private scopes
    });
}

interface RegistryConfig {
  hasPrivateRegistry: boolean;
  registryUrls: string[];
}

function detectPrivateRegistry(projectPath: string): RegistryConfig {
  const registryUrls: string[] = [];

  const npmrcFiles = [
    join(projectPath, '.npmrc'),
    join(projectPath, '.yarnrc'),
    join(projectPath, '.yarnrc.yml'),
    join(projectPath, '.npmrc.local'),
  ];

  for (const rcFile of npmrcFiles) {
    const content = readFileSafe(rcFile);
    if (!content) continue;

    // Match registry lines in .npmrc / .yarnrc
    // e.g. @myco:registry=https://npm.myco.com
    // e.g. registry=https://registry.example.com
    // .yarnrc.yml: npmRegistryServer: "https://..."
    const registryPatterns = [
      /:registry\s*=\s*(.+)/gi,
      /^registry\s*=\s*(.+)/gim,
      /npmRegistryServer:\s*["']?(.+?)["']?\s*$/gim,
      /npmScopes:\s*[\s\S]*?url:\s*["']?(.+?)["']?\s*$/gim,
    ];

    for (const pattern of registryPatterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const url = match[1].trim().replace(/['"]/g, '');
        if (url && url !== 'https://registry.npmjs.org') {
          registryUrls.push(url);
        }
      }
    }
  }

  // Also check package.json publishConfig
  const pkgContent = readFileSafe(join(projectPath, 'package.json'));
  if (pkgContent) {
    const pkg = parseJson<{ publishConfig?: { registry?: string } }>(pkgContent);
    if (pkg?.publishConfig?.registry) {
      registryUrls.push(pkg.publishConfig.registry);
    }
  }

  return {
    hasPrivateRegistry: registryUrls.length > 0,
    registryUrls,
  };
}

export const depConfusionCheckerScanner: Scanner = {
  name: 'dep-confusion-checker',
  description: 'Checks for dependency confusion vulnerabilities — scoped private packages without a configured private registry',
  category: 'dependencies',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return true;
  },

  async scan(projectPath: string, _config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let idCounter = 1;

    function addFinding(
      severity: Finding['severity'],
      title: string,
      description: string,
      file?: string,
    ): void {
      findings.push({
        id: `DEPCONF-${String(idCounter++).padStart(3, '0')}`,
        scanner: 'dep-confusion-checker',
        severity,
        title,
        description,
        category: 'dependencies',
        owasp: 'A06:2021',
        cwe: 427,
        ...(file ? { file } : {}),
      });
    }

    const pkgPath = join(projectPath, 'package.json');
    if (!existsSync(pkgPath)) {
      return {
        scanner: 'dep-confusion-checker',
        category: 'dependencies',
        findings,
        duration: Date.now() - start,
        available: true,
      };
    }

    const pkgContent = readFileSafe(pkgPath);
    if (!pkgContent) {
      return {
        scanner: 'dep-confusion-checker',
        category: 'dependencies',
        findings,
        duration: Date.now() - start,
        available: true,
      };
    }

    const pkg = parseJson<PackageJson>(pkgContent);
    if (!pkg) {
      return {
        scanner: 'dep-confusion-checker',
        category: 'dependencies',
        findings,
        duration: Date.now() - start,
        available: true,
      };
    }

    const scopedPackages = extractScopedPackages(pkg);

    if (scopedPackages.length === 0) {
      // No scoped packages — nothing to check
      return {
        scanner: 'dep-confusion-checker',
        category: 'dependencies',
        findings,
        duration: Date.now() - start,
        available: true,
      };
    }

    const { hasPrivateRegistry, registryUrls } = detectPrivateRegistry(projectPath);

    if (!hasPrivateRegistry) {
      // Scoped packages exist but no private registry configured
      const scopedList = scopedPackages.slice(0, 10).join(', ') + (scopedPackages.length > 10 ? '…' : '');
      addFinding(
        'high',
        `Dependency confusion risk: ${scopedPackages.length} scoped package(s) without private registry`,
        `The project uses ${scopedPackages.length} scoped package(s) (${scopedList}) but no private npm registry is configured in .npmrc, .yarnrc, or .yarnrc.yml. If any of these scoped packages are internal/private, an attacker could publish a malicious package with the same name to the public npm registry and hijack the install. Configure a private registry scope mapping (e.g., "@myco:registry=https://npm.myco.com" in .npmrc).`,
        pkgPath,
      );
    } else {
      // Private registry configured — check that all URLs are HTTPS
      for (const url of registryUrls) {
        if (url.startsWith('http://')) {
          addFinding(
            'medium',
            `Private registry configured over HTTP: ${url}`,
            `A private npm registry is configured at "${url}" using plain HTTP. Registry connections over HTTP are vulnerable to man-in-the-middle attacks, which could allow injection of malicious package contents. Use HTTPS for all private registry URLs.`,
            pkgPath,
          );
        }
      }

      // Check that all scoped packages have a scope-specific registry mapping
      const npmrcContent = readFileSafe(join(projectPath, '.npmrc')) ?? '';
      const scopesWithMapping = new Set<string>();
      const scopeMappingRe = /(@[^:]+):registry\s*=/gi;
      let scopeMatch: RegExpExecArray | null;
      while ((scopeMatch = scopeMappingRe.exec(npmrcContent)) !== null) {
        scopesWithMapping.add(scopeMatch[1].toLowerCase());
      }

      if (scopesWithMapping.size > 0) {
        // We have scope-level mappings — check each scoped package
        for (const pkg of scopedPackages) {
          const scope = pkg.split('/')[0].toLowerCase();
          if (!scopesWithMapping.has(scope)) {
            addFinding(
              'medium',
              `Scoped package "${pkg}" has no private registry mapping`,
              `The package "${pkg}" uses scope "${scope}" but no registry mapping for that scope was found in .npmrc (e.g. "${scope}:registry=https://..."). Without an explicit scope mapping, npm may resolve this package from the public registry, enabling a dependency confusion attack.`,
              pkgPath,
            );
          }
        }
      }
    }

    return {
      scanner: 'dep-confusion-checker',
      category: 'dependencies',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
