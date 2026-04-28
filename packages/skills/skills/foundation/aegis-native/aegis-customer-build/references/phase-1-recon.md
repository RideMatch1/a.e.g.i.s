# Phase 1 Reference — Recon (Briefing Parser + Tech-Stack Detection)

Phase 1 of the customer-build pipeline. Inputs: a configurator-output briefing.md. Outputs: structured `briefing-parsed.json` + identified tech-stack + pages-list + brand-identity-distilled.

**Time budget:** 20-30 min. **Subagent dispatch:** Research-subagent (model: opus) recommended for complex briefings (>1000 lines).

---

## Briefing-Completeness Checklist

The skill refuses to start Phase 2 if any of these fields is missing or malformed. The checklist IS the contract.

| Field | Required | Validator |
|---|---|---|
| `project_slug` | yes | `[a-z][a-z0-9-]{2,40}`, unique within `customers/` |
| `brand.name` | yes | non-empty string |
| `brand.tagline` | yes | non-empty string, ≤ 80 chars |
| `brand.colors` | yes | object with `primary`, `secondary`, `accent` (hex) |
| `pages[]` | yes | array, length ≥ 3, each item has `slug`, `title`, `purpose`, `sections[]` |
| `tech_stack` | yes | one of `next-app-router`, `next-pages-router`, `remix`, `sveltekit`, `astro`, `vite-react` |
| `content_plan` | yes | object with `tone`, `voice`, `keywords[]` |
| `brand_identity` | yes | object with `target_audience`, `value_proposition`, `differentiators[]` |
| `design_prefs` | yes | object with `typography`, `mood`, `references[]` |
| `integrations` | optional | array of `forms`, `chatbot`, `scanner`, `analytics`, `commerce` (any subset) |
| `legal` | yes | object with `impressum_data`, `dse_provider`, `cookie_strategy` |
| `seo` | yes | object with `target_keywords[]`, `gmb_url` (if local biz) |

If a field is missing — STOP, print:
```
Pre-Build-Validation FAILED — missing fields:
- brand.colors.accent
- pages[3].sections (page "Kontakt")
Operator: please complete the briefing and re-run.
```

---

## Parser-Workflow

```
1. Read briefing.md → gray-matter (YAML frontmatter) + markdown body
2. Validate frontmatter against schema (above table)
3. Parse markdown sections (## Pages, ## Brand, ## Content-Plan, ## Design)
4. Cross-check: every page in frontmatter pages[] has a corresponding ## section in body
5. Extract pages-list with full structured data per page
6. Write briefing-parsed.json under customers/<slug>/.aegis/briefing-parsed.json
7. Print "Briefing pages: N expected, will build: N" for the operator-confirm
```

Parser reads a single file (`briefing.md`). Multi-file briefings (`briefing.md` + `pages.json` + `brand.json`) are an extension-point per Extension Points in SKILL.md.

---

## Tech-Stack Detection Patterns

The briefing's `tech_stack` field is authoritative. If present, use that. If absent, infer:

| Briefing signal | Inferred stack |
|---|---|
| Mentions "App Router" or "RSC" or "use server" | next-app-router |
| Mentions "getServerSideProps" or "getStaticProps" | next-pages-router |
| Mentions "loaders" or "actions" or "Remix" | remix |
| Mentions "+page.svelte" or "+layout.svelte" | sveltekit |
| Mentions "Astro" or "MDX islands" | astro |
| Mentions "Vite" without server-rendering | vite-react |
| Default fallback | next-app-router |

Once inferred, ask the operator to confirm before Phase 2 commits to the architecture.

---

## Brand-Identity Distillation

Extract a 1-paragraph "brand essence" from the briefing's `brand_identity` block. Used in Phase 4 (Content) for tone-matching:

```
Essence: [target_audience] looking for [value_proposition]; differentiated by [differentiators], speaking in a [tone] voice with [voice] (e.g., "Sie", "Du", "lockerer Plural-Wir").
```

The essence becomes the system-prompt header for any LLM-call in Phase 4 (copy-writing). It also drives the chatbot's persona if a chatbot is mounted in Phase 5.

---

## Pages-List Schema

Each page in the briefing's `pages[]` MUST conform to:

```yaml
- slug: home              # url-path-segment
  title: "Startseite"     # navigation-title (≤ 30 chars)
  purpose: "..."          # 1-sentence why-this-page-exists
  sections:               # ordered list of in-page sections
    - hero
    - intro
    - features
    - cta
    - testimonials
    - footer-cta
  meta:
    title: "..."          # SEO-meta title
    description: "..."    # SEO-meta description (120-160 chars)
    canonical: "/"        # canonical URL-path
```

If `sections` is empty — STOP. The operator must specify in-page sections; the build cannot guess them.

---

## Integrations Detection

The `integrations` array drives Phase 5 mounting. Common values:

- `forms.contact` — contact-form with double-opt-in
- `forms.newsletter` — newsletter-signup
- `chatbot.public-llm` — chat-widget routing to /api/chat
- `scanner.aegis` — embed AEGIS public scanner at /scan
- `analytics.plausible` — Plausible analytics (privacy-friendly, no consent-banner gate)
- `analytics.matomo` — Matomo (self-hosted, may need consent depending on config)
- `commerce.stripe` — Stripe checkout
- `commerce.paypal` — PayPal checkout

Phase 5 reads each enabled integration and mounts via `references/phase-5-integration.md` template per integration.

---

## Anti-Patterns specific to Phase 1

- ❌ Skipping schema validation "because the briefing came from the official configurator" — configurator-output drift happens; always validate.
- ❌ Inferring tech_stack from page-content (e.g., "they wrote 'use client', so it's RSC") — too brittle; require explicit briefing field.
- ❌ Writing a partial `briefing-parsed.json` and proceeding to Phase 2 with "we'll fix it later" — Phase 2 architecture decisions depend on a complete briefing.
- ❌ Treating an empty `integrations` array as "no integrations needed" — clarify with the operator; many briefings forget to enumerate.

---

## Recovery / Resume

If a previous run crashed in Phase 1, the resume-flow:

```
1. Read .aegis/state.json — confirm phase: 1 status: incomplete
2. Re-validate briefing.md (changes possible)
3. If briefing-parsed.json exists: load it, validate freshness against briefing.md mtime
4. If stale: re-parse from scratch
5. Resume Phase 2
```

Always re-validate — never trust a stale checkpoint blindly.
