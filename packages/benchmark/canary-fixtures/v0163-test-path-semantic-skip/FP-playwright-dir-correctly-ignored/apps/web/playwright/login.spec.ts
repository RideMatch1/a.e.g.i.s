// Playwright e2e-test in the canonical `playwright/` directory
// convention. E2E-test JWTs are intentional test-fixtures.
// Scanner must skip via isTestFile() e2e-framework match on
// `playwright/` segment (v0.6.1 console-checker extension preserved
// through the v0.16.3 canonical helper).
import { test, expect } from '@playwright/test';

const E2E_TEST_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

test('login with JWT', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate((jwt) => {
    document.cookie = `session=${jwt}`;
  }, E2E_TEST_JWT);
  await expect(page).toHaveURL('/dashboard');
});
