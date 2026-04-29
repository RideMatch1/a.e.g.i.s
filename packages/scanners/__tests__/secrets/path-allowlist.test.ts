import { describe, it, expect } from 'vitest';
import { isSecretsNoisePath } from '../../src/secrets/path-allowlist.js';

describe('isSecretsNoisePath — v0.17.5 F5.1 path-allowlist for gitleaks/trufflehog', () => {
  it('handles null/undefined/empty inputs safely', () => {
    expect(isSecretsNoisePath(null)).toBe(false);
    expect(isSecretsNoisePath(undefined)).toBe(false);
    expect(isSecretsNoisePath('')).toBe(false);
  });

  describe('documentation paths (skip)', () => {
    it.each([
      'README.md',
      'docs/getting-started.md',
      'docs/api-reference/oauth.mdx',
      'CHANGELOG.md',
      'LICENSE',
      'CONTRIBUTING.md',
      'SECURITY.md',
      'CODE_OF_CONDUCT.md',
      'docs/api-reference/v2/openapi.json',
      'documentation/setup.adoc',
    ])('skips %s', (path) => {
      expect(isSecretsNoisePath(path)).toBe(true);
    });
  });

  describe('lockfile paths (skip)', () => {
    it.each([
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'pnpm-lock.yml',
      'bun.lockb',
      'composer.lock',
      'Gemfile.lock',
      'poetry.lock',
      'Cargo.lock',
      'go.sum',
      'apps/web/yarn.lock',
      'i18n.lock',
    ])('skips %s', (path) => {
      expect(isSecretsNoisePath(path)).toBe(true);
    });
  });

  describe('i18n paths (skip)', () => {
    it.each([
      'i18n.lock',
      'i18n-en.json',
      'locales/en.json',
      'locales/de/messages.json',
      'translations/fr.po',
      'messages/en-US.json',
      'lang/de.yaml',
    ])('skips %s', (path) => {
      expect(isSecretsNoisePath(path)).toBe(true);
    });
  });

  describe('example/template paths (skip)', () => {
    it.each([
      '.env.example',
      '.env.local.example',
      '.env.production.example',
      '.env.template',
      'config.json.example',
      'docker-compose.example.yml',
      'examples/01-create-document.ts',
      'samples/auth-flow.ts',
    ])('skips %s', (path) => {
      expect(isSecretsNoisePath(path)).toBe(true);
    });
  });

  describe('test/fixture paths (skip)', () => {
    it.each([
      'tests/auth.test.ts',
      'test/integration/login.ts',
      '__tests__/setup.ts',
      'src/components/Button.test.tsx',
      'src/lib/auth.spec.ts',
      'src/lib/auth.e2e.ts',
      'apps/web/playwright/payment-apps.e2e.ts',
      'cypress/integration/checkout.spec.ts',
      'e2e/oauth-flow.test.ts',
      'fixtures/sample-users.json',
      '__mocks__/stripe.ts',
      'spec/api.spec.ts',
    ])('skips %s', (path) => {
      expect(isSecretsNoisePath(path)).toBe(true);
    });
  });

  describe('OpenAPI / API spec paths (skip)', () => {
    it.each([
      'openapi.json',
      'openapi.yaml',
      'docs/api/openapi-v2.yaml',
      'swagger.json',
      'api.openapi.yml',
      'collection.postman_collection.json',
      'env.postman_environment.json',
    ])('skips %s', (path) => {
      expect(isSecretsNoisePath(path)).toBe(true);
    });
  });

  describe('vendor / build artifacts (skip)', () => {
    it.each([
      'node_modules/some-lib/dist.js',
      'vendor/lib/something.go',
      'dist/main.js',
      'build/static/main.css',
      '.next/server/page.js',
      'out/static.html',
      'coverage/lcov-report/index.html',
      '.turbo/cache/abc123',
      'public/lib.min.js',
    ])('skips %s', (path) => {
      expect(isSecretsNoisePath(path)).toBe(true);
    });
  });

  describe('REAL source paths (do NOT skip — must allow)', () => {
    it.each([
      'src/lib/config.ts',
      'src/app/api/auth/route.ts',
      'apps/web/lib/secrets.ts',
      'pages/api/login.ts',
      'app/components/Header.tsx',
      'lib/api/client.ts',
      'server/db.ts',
      'backend/routes/users.ts',
      'utils/crypto.ts',
      'config.ts',
      'next.config.js',
      'Dockerfile',
      '.env',
      '.env.local',
      '.env.production',
    ])('does NOT skip %s', (path) => {
      expect(isSecretsNoisePath(path)).toBe(false);
    });
  });

  describe('cross-platform path separators', () => {
    it('handles Windows backslashes', () => {
      expect(isSecretsNoisePath('docs\\setup.md')).toBe(true);
      expect(isSecretsNoisePath('node_modules\\lib\\index.js')).toBe(true);
      expect(isSecretsNoisePath('src\\lib\\auth.ts')).toBe(false);
    });

    it('handles mixed separators', () => {
      expect(isSecretsNoisePath('apps\\web/playwright/checkout.e2e.ts')).toBe(true);
    });
  });

  describe('case-insensitivity', () => {
    it.each([
      'README.MD',
      'YARN.LOCK',
      'docs/SETUP.MDX',
      'DOCS/api.md',
      'PlayWright/test.spec.ts',
    ])('matches %s case-insensitively', (path) => {
      expect(isSecretsNoisePath(path)).toBe(true);
    });
  });
});
