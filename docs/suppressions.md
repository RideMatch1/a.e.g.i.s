# Suppressions

AEGIS supports two layers of suppression that apply to **every scanner** —
`taint-analyzer`, `auth-enforcer`, `csrf-checker`, `header-checker`, and all
others. Filtering happens at the Orchestrator level, after findings are
collected, so one directive silences matching findings regardless of which
scanner produced them.

1. **Inline** — `// aegis-ignore` comments, scoped to the next line or a block
2. **Config-level** — `suppressions[]` in `aegis.config.json`, scoped by glob + rule

Inline is finer-grained and closer to the code. Config-level is coarser and
useful for whole directories (e.g., legacy modules scheduled for removal).

## Inline syntax

```typescript
// aegis-ignore — reason text                       <-- applies to next line
// aegis-ignore CWE-918 — legitimer proxy call      <-- CWE-specific
exec(cmd);

/* aegis-ignore-block CWE-78 — internal DSL runner */
exec(a);
exec(b);
/* aegis-ignore-end */

// Single-line block mode also works:
/* aegis-ignore-block */ exec(x); /* aegis-ignore-end */
```

Supported separators: em-dash `—`, en-dash `–`, `--`, `-`.

A suppression without a CWE is a catch-all for that line/block.
A suppression with a CWE only matches findings where `cwe === <number>`.

### Reasons are required

Naked suppressions (no reason) emit a warning on stderr. This is
opinionated: a suppression without a reason is a TODO disguised as a fix.
Add at least a short explanation so future readers (including you) can
judge whether the suppression is still valid.

### Unused suppressions

AEGIS tracks which suppressions matched a finding. Ones that never
matched are warned on stderr with the file and line, so you can clean
them up as the code evolves.

## Config-level syntax

```json
{
  "suppressions": [
    {
      "file": "src/legacy/**",
      "rule": "CWE-918",
      "reason": "legacy proxy calls to internal whitelisted hosts — removal Q2 2027"
    },
    {
      "file": "src/migration/old-*.ts",
      "reason": "scheduled deletion after DB migration 0045"
    }
  ]
}
```

| field   | required | description |
|---------|----------|-------------|
| file    | yes      | glob pattern relative to projectPath |
| rule    | no       | `CWE-<digits>` or scanner id (e.g., `taint-analyzer`) |
| reason  | yes, ≥10 | human explanation — too-short reasons are rejected |

Glob supports:
- `**` — any path segments
- `*` — any characters except `/`
- `?` — any single character

If `rule` is omitted, the suppression is catch-all for that file glob.

## Diagnostic opt-out

```json
{
  "suppressionOptions": {
    "warnUnused": false,
    "warnNaked": false
  }
}
```

Useful when integrating into CI systems that treat any stderr output as
a warning signal.

## Precedence

For a given finding, AEGIS checks in this order:

1. Inline `// aegis-ignore` on the same line/block
2. Config-level `suppressions[]` matching file + rule
3. If neither matches → emit finding

## When NOT to suppress

- If the same FP shows up in many files, fix the root cause or define a
  [custom sanitizer](./custom-rules.md)
- If the suppression explains a security design, that belongs in a code
  comment anyway — use inline with a meaningful reason
- Never suppress a finding you haven't personally read and understood
