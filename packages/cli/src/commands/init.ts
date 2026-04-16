import { detectStack } from '@aegis-scan/core';
import { writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import chalk from 'chalk';

export async function runInit(path: string): Promise<void> {
  const resolvedPath = resolve(path || process.cwd());

  // Create directory if it doesn't exist
  const { mkdirSync, existsSync } = await import('node:fs');
  if (!existsSync(resolvedPath)) {
    mkdirSync(resolvedPath, { recursive: true });
  }

  console.log(chalk.bold('AEGIS — Initializing configuration...'));
  console.log(chalk.dim(`Project path: ${resolvedPath}`));

  const stack = await detectStack(resolvedPath);

  console.log('');
  console.log(chalk.bold('Detected stack:'));
  console.log(`  Framework:  ${chalk.cyan(stack.framework)}`);
  console.log(`  Database:   ${chalk.cyan(stack.database)}`);
  console.log(`  Auth:       ${chalk.cyan(stack.auth)}`);
  console.log(`  Language:   ${chalk.cyan(stack.language)}`);
  console.log(`  AI:         ${chalk.cyan(stack.ai)}`);
  console.log(`  Payment:    ${chalk.cyan(stack.payment)}`);
  console.log(`  Deploy:     ${chalk.cyan(stack.deploy)}`);
  console.log(`  i18n:       ${chalk.cyan(String(stack.hasI18n))}`);
  console.log(`  Tests:      ${chalk.cyan(String(stack.hasTests))}`);
  console.log('');

  const configContent = generateConfig(stack);
  const configPath = join(resolvedPath, 'aegis.config.json');

  await writeFile(configPath, configContent, 'utf8');

  console.log(chalk.green(`✓ Created ${configPath}`));
  console.log('');
  console.log('Next steps:');
  console.log(`  ${chalk.bold('aegis scan .')}   — Quick scan (security, dependencies, quality, compliance, i18n)`);
  console.log(`  ${chalk.bold('aegis audit .')}  — Full audit (all scanners)`);
}

function generateConfig(
  stack: Awaited<ReturnType<typeof detectStack>>,
): string {
  const config = {
    stack: {
      framework: stack.framework,
      database: stack.database,
      auth: stack.auth,
      ai: stack.ai,
      payment: stack.payment,
      deploy: stack.deploy,
      language: stack.language,
      hasI18n: stack.hasI18n,
      hasTests: stack.hasTests,
    },
    locale: 'en',
    compliance: [],
    ignore: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      'coverage/**',
    ],
    scanners: {},
    rules: {},
  };
  return JSON.stringify(config, null, 2) + '\n';
}
