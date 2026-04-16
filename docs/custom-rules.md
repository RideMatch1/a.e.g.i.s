# Custom Rules DSL

AEGIS lets you extend the built-in taint sources, sinks, and sanitizers via
`aegis.config.json`. This is how you adapt the scanner to project-specific
patterns without forking the codebase.

All custom rules are **additive** — built-in detection stays intact. Custom
entries augment the registries for the duration of one scan, then are
rolled back.

## Schema overview

```json
{
  "customSources": [
    { "pattern": "ctx.userInput", "cwe": "CWE-89" }
  ],
  "customSinks": [
    {
      "pattern": "internalExec",
      "type": "call",
      "cwe": "CWE-78",
      "severity": "critical",
      "category": "Internal CmdInjection"
    },
    {
      "pattern": "UnsafeBuilder",
      "type": "constructor",
      "cwe": "CWE-94"
    },
    {
      "pattern": "dangerousProp",
      "type": "property",
      "cwe": "CWE-79"
    }
  ],
  "customSanitizers": [
    { "pattern": "validateAndSanitize", "cwes": ["CWE-78", "CWE-89"] }
  ],
  "allowOverrides": false
}
```

## `customSources`

Each entry registers a new taint source pattern that matches the same way as
built-in entries (prefix / suffix on expression text).

| field   | required | description |
|---------|----------|-------------|
| pattern | yes      | exact prefix/suffix string (e.g., `ctx.userInput`) |
| cwe     | no       | hint for reporting (inherits sink CWE at finding time) |

## `customSinks`

`type` selects which built-in registry the pattern extends:

| type          | matches                                           |
|---------------|---------------------------------------------------|
| `call` (default) | `pattern(tainted)` — call expressions          |
| `constructor` | `new pattern(tainted)` — constructor expressions  |
| `property`    | `obj.pattern = tainted` — property assignments    |

| field    | required | description |
|----------|----------|-------------|
| pattern  | yes      | exact function/class/property name (e.g., `internalExec`) |
| type     | no       | `call` / `constructor` / `property` (default: `call`) |
| cwe      | **yes**  | must be `CWE-<digits>` — AEGIS will not guess |
| severity | no       | `critical` / `high` / `medium` / `low` / `info` (default: `high`) |
| category | no       | free-text label shown in findings (default: `Custom`) |

If the pattern collides with a built-in, the custom entry wins for this scan
and a warning is logged. To avoid confusion, prefer distinct names.

## `customSanitizers`

| field   | required | description |
|---------|----------|-------------|
| pattern | yes      | function name (e.g., `validateAndSanitize`) |
| cwes    | yes      | one or more CWEs this sanitizer neutralizes |

### Security defaults — `allowOverrides`

AEGIS protects a blocklist called `PARSE_NOT_SANITIZER` that prevents
notorious bypass patterns (`JSON.parse`, `URL.parse`, `querystring.parse`,
etc.) from being treated as sanitizers. These patterns **have been abused
historically** to hide taint flow from scanners.

Defining a custom sanitizer with one of these patterns is rejected with
`AegisConfigError` unless you explicitly set `allowOverrides: true`:

```json
{
  "customSanitizers": [
    { "pattern": "JSON.parse", "cwes": ["CWE-89"] }
  ],
  "allowOverrides": true
}
```

Only do this if you genuinely know what you're doing — e.g., you've wrapped
`JSON.parse` in a strict-typed validation layer.

## Example — matching an internal DSL

Your codebase uses `internalDbRaw(sqlString)` for raw queries that bypass
the Supabase client:

```json
{
  "customSinks": [
    {
      "pattern": "internalDbRaw",
      "type": "call",
      "cwe": "CWE-89",
      "severity": "critical",
      "category": "Internal SQLi"
    }
  ]
}
```

AEGIS will now flag any tainted flow into `internalDbRaw()` exactly like it
flags built-in `db.query()` / `client.query()`.

## Validation

- All CWE strings must match `/^CWE-\d+$/`
- `suppressions[].reason` must be at least 10 chars (force documentation)
- Unknown top-level fields in `aegis.config.json` are rejected — the
  scanner will fall back to auto-detection with a warning

## When NOT to use custom rules

- If the pattern is common enough to benefit other users, open an issue at
  [anthropics/claude-code](https://github.com/anthropics/claude-code) — it
  likely belongs in the built-in registry
- Don't use custom sanitizers to silence noisy findings; use
  [inline suppression](./suppressions.md) (`// aegis-ignore`) instead
