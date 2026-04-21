import { defineConfig } from 'vitest/config';

// v0.16.1 D-T-001 — bump testTimeout from the vitest default 5000ms to
// 15000ms so the six AST tests that build ts-morph Programs (function-
// summary, module-graph, program, taint-analyzer, taint-tracker,
// type-resolve) stop timing out when `pnpm turbo test --force` runs all
// 10 packages' test-suites concurrently on multi-core developer hosts.
// Isolated per-package runtime of the affected tests is ~7-8s each; the
// parallel-CPU-contention path adds ~50% margin, so 15000ms (3× default)
// gives ~1.5× headroom above both the isolation-time and the observed
// parallel-time without masking real performance regressions.
export default defineConfig({
  test: {
    testTimeout: 15000,
  },
});
