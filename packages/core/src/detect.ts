import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DetectedStack } from './types.js';

function readJsonSafe(filePath: string): Record<string, unknown> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readFileSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function hasDep(deps: Record<string, unknown>, ...names: string[]): boolean {
  return names.some((n) => n in deps);
}

export function detectStack(projectPath: string): DetectedStack {
  const pkgPath = path.join(projectPath, 'package.json');
  const pkg = readJsonSafe(pkgPath);

  const deps: Record<string, unknown> = {
    ...((pkg['dependencies'] as Record<string, unknown>) ?? {}),
    ...((pkg['devDependencies'] as Record<string, unknown>) ?? {}),
  };

  // ---- Language ----
  let language: DetectedStack['language'] = 'unknown';
  if (fs.existsSync(path.join(projectPath, 'tsconfig.json')) || hasDep(deps, 'typescript')) {
    language = 'typescript';
  } else if (fs.existsSync(path.join(projectPath, 'package.json'))) {
    language = 'javascript';
  } else if (fs.existsSync(path.join(projectPath, 'requirements.txt')) || fs.existsSync(path.join(projectPath, 'pyproject.toml'))) {
    language = 'python';
  } else if (fs.existsSync(path.join(projectPath, 'Gemfile'))) {
    language = 'ruby';
  } else if (fs.existsSync(path.join(projectPath, 'go.mod'))) {
    language = 'go';
  } else if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) {
    language = 'rust';
  } else if (fs.existsSync(path.join(projectPath, 'composer.json'))) {
    language = 'php';
  } else if (fs.existsSync(path.join(projectPath, 'pom.xml')) || fs.existsSync(path.join(projectPath, 'build.gradle'))) {
    language = 'java';
  }

  // ---- Framework ----
  let framework: DetectedStack['framework'] = 'unknown';

  // Check Node/JS frameworks first
  if (hasDep(deps, 'next')) {
    framework = 'nextjs';
  } else if (hasDep(deps, 'nuxt', '@nuxt/core')) {
    framework = 'nuxt';
  } else if (hasDep(deps, '@remix-run/react', '@remix-run/node', '@remix-run/serve')) {
    framework = 'remix';
  } else if (hasDep(deps, 'astro')) {
    framework = 'astro';
  } else if (hasDep(deps, 'svelte', '@sveltejs/kit')) {
    framework = 'svelte';
  } else if (hasDep(deps, 'vue', '@vue/core')) {
    framework = 'vue';
  } else if (hasDep(deps, 'react', 'react-dom')) {
    framework = 'react';
  } else if (hasDep(deps, 'fastify')) {
    framework = 'fastify';
  } else if (hasDep(deps, 'express')) {
    framework = 'express';
  } else if (fs.existsSync(path.join(projectPath, 'go.mod'))) {
    framework = 'go';
  } else if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) {
    framework = 'rust';
  } else if (fs.existsSync(path.join(projectPath, 'requirements.txt')) || fs.existsSync(path.join(projectPath, 'pyproject.toml'))) {
    const reqContent = readFileSafe(path.join(projectPath, 'requirements.txt'));
    const pyprojectContent = readFileSafe(path.join(projectPath, 'pyproject.toml'));
    const combined = reqContent + pyprojectContent;
    if (/\bdjango\b/i.test(combined)) {
      framework = 'django';
    } else if (/\bflask\b/i.test(combined)) {
      framework = 'flask';
    }
  } else if (fs.existsSync(path.join(projectPath, 'Gemfile'))) {
    const gemfileContent = readFileSafe(path.join(projectPath, 'Gemfile'));
    if (/\brails\b/i.test(gemfileContent)) {
      framework = 'rails';
    }
  } else if (fs.existsSync(path.join(projectPath, 'composer.json'))) {
    const composer = readJsonSafe(path.join(projectPath, 'composer.json'));
    const composerDeps: Record<string, unknown> = {
      ...((composer['require'] as Record<string, unknown>) ?? {}),
      ...((composer['require-dev'] as Record<string, unknown>) ?? {}),
    };
    if (hasDep(composerDeps, 'laravel/framework')) {
      framework = 'laravel';
    }
  }

  // ---- Database ----
  let database: DetectedStack['database'] = 'unknown';
  if (hasDep(deps, '@supabase/supabase-js', '@supabase/ssr', '@supabase/auth-helpers-nextjs')) {
    database = 'supabase';
  } else if (hasDep(deps, 'firebase', 'firebase-admin', '@firebase/firestore')) {
    database = 'firebase';
  } else if (hasDep(deps, '@prisma/client', 'prisma')) {
    database = 'prisma';
  } else if (hasDep(deps, 'drizzle-orm', 'drizzle-kit')) {
    database = 'drizzle';
  } else if (hasDep(deps, 'mongoose')) {
    database = 'mongoose';
  } else if (hasDep(deps, 'pg', 'postgres', 'node-postgres')) {
    database = 'raw-pg';
  } else if (
    !fs.existsSync(path.join(projectPath, 'package.json')) &&
    (fs.existsSync(path.join(projectPath, 'requirements.txt')) || fs.existsSync(path.join(projectPath, 'Gemfile')))
  ) {
    database = 'none';
  }

  // ---- Auth ----
  let auth: DetectedStack['auth'] = 'unknown';
  if (hasDep(deps, '@supabase/supabase-js', '@supabase/ssr', '@supabase/auth-helpers-nextjs')) {
    auth = 'supabase-auth';
  } else if (hasDep(deps, 'next-auth', '@auth/core', '@auth/nextjs')) {
    auth = 'next-auth';
  } else if (hasDep(deps, '@clerk/nextjs', '@clerk/clerk-react', '@clerk/clerk-sdk-node')) {
    auth = 'clerk';
  } else if (hasDep(deps, 'lucia')) {
    auth = 'lucia';
  } else if (hasDep(deps, 'passport', 'passport-local', 'passport-jwt')) {
    auth = 'passport';
  }

  // ---- AI ----
  let ai: DetectedStack['ai'] = 'unknown';
  if (hasDep(deps, 'openai', '@openai/openai')) {
    ai = 'openai';
  } else if (hasDep(deps, '@anthropic-ai/sdk', 'anthropic')) {
    ai = 'anthropic';
  } else if (hasDep(deps, '@mistralai/mistralai', 'mistral', 'mistralai')) {
    ai = 'mistral';
  } else if (hasDep(deps, 'ollama', '@ollama/ollama')) {
    ai = 'ollama';
  } else {
    // Check Python requirements for AI libs
    const reqContent = readFileSafe(path.join(projectPath, 'requirements.txt'));
    if (/\bopenai\b/i.test(reqContent)) {
      ai = 'openai';
    } else if (/\banthropic\b/i.test(reqContent)) {
      ai = 'anthropic';
    } else if (/\bmistral/i.test(reqContent)) {
      ai = 'mistral';
    } else if (/\bollama\b/i.test(reqContent)) {
      ai = 'ollama';
    } else {
      ai = 'none';
    }
  }

  // ---- Payment ----
  let payment: DetectedStack['payment'] = 'unknown';
  if (hasDep(deps, 'stripe', '@stripe/stripe-js', '@stripe/react-stripe-js')) {
    payment = 'stripe';
  } else {
    const reqContent = readFileSafe(path.join(projectPath, 'requirements.txt'));
    if (/\bstripe\b/i.test(reqContent)) {
      payment = 'stripe';
    } else {
      payment = 'none';
    }
  }

  // ---- Deploy ----
  let deploy: DetectedStack['deploy'] = 'unknown';
  if (fs.existsSync(path.join(projectPath, 'vercel.json')) || fs.existsSync(path.join(projectPath, '.vercel'))) {
    deploy = 'vercel';
  } else if (fs.existsSync(path.join(projectPath, 'Dockerfile')) || fs.existsSync(path.join(projectPath, 'docker-compose.yml')) || fs.existsSync(path.join(projectPath, 'docker-compose.yaml'))) {
    deploy = 'docker';
  } else if (fs.existsSync(path.join(projectPath, 'railway.toml')) || fs.existsSync(path.join(projectPath, 'railway.json'))) {
    deploy = 'railway';
  } else if (fs.existsSync(path.join(projectPath, 'fly.toml'))) {
    deploy = 'fly';
  } else if (fs.existsSync(path.join(projectPath, 'netlify.toml'))) {
    deploy = 'netlify';
  } else {
    deploy = 'none';
  }

  // ---- i18n ----
  const hasI18n =
    hasDep(deps, 'next-intl', 'react-i18next', 'i18next', 'vue-i18n', '@nuxtjs/i18n', 'react-intl', 'lingui') ||
    fs.existsSync(path.join(projectPath, 'messages')) ||
    fs.existsSync(path.join(projectPath, 'locales')) ||
    fs.existsSync(path.join(projectPath, 'i18n'));

  // ---- Tests ----
  const hasTests =
    hasDep(deps, 'vitest', 'jest', '@jest/core', 'mocha', 'jasmine', 'playwright', '@playwright/test', 'cypress') ||
    fs.existsSync(path.join(projectPath, '__tests__')) ||
    fs.existsSync(path.join(projectPath, 'tests')) ||
    fs.existsSync(path.join(projectPath, 'spec')) ||
    fs.existsSync(path.join(projectPath, 'e2e'));

  return {
    framework,
    database,
    auth,
    ai,
    payment,
    deploy,
    language,
    hasI18n,
    hasTests,
  };
}
