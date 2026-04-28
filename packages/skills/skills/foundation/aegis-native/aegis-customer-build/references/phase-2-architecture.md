# Phase 2 Reference — Architecture (Routing + Component-Tree + Data-Flow)

Phase 2 turns parsed-briefing into concrete architecture decisions. Outputs: `architecture.md` under `customers/<slug>/`. **Time budget:** 20-30 min. **Model:** opus (Strategist subagent).

---

## Decision 1: Routing-Pattern

For Next.js (canonical default):

| Briefing signal | Routing |
|---|---|
| ≥ 80% pages have server-side data + auth-aware | App Router (`app/`) |
| Largely static + client-heavy interactivity | Pages Router (`pages/`) |
| Pre-existing legacy site being incrementally rebuilt | Pages Router with App Router islands |
| Default for new projects | App Router |

**Decision criterion:** App Router unless the briefing explicitly forbids it. Document the decision in `architecture.md` under `## Routing`.

For Remix / SvelteKit / Astro: routing follows the framework's idiomatic file-based pattern. No alternatives to evaluate.

---

## Decision 2: Component-Tree

Distinguish between:

- **Page-level components** — unique to one page (e.g., `app/leistungen/components/PricingTable.tsx`).
- **Shared components** — used by ≥ 2 pages (e.g., `components/Hero.tsx`).
- **Library-bound components** — instances of project's component-library that get assembled per page (e.g., the project's component-library provides 80+ pre-built blocks; a page picks 8-12 of them).

Rule of thumb: every page in the briefing produces ≥ 1 page-level + ≥ 3 library-bound + ≥ 5 shared imports. If a page is pure library-binding with zero page-level components — flag in `architecture.md` for operator review (might indicate a too-generic page).

---

## Decision 3: Data-Flow

| Data shape | Pattern |
|---|---|
| Server-side data fetched at request time | RSC + fetch (App Router) or getServerSideProps (Pages Router) |
| Client-side state shared across components | React Context or Zustand (no Redux for new builds) |
| Form-state | React Hook Form + Zod resolver |
| Real-time data (chat-stream, scanner-stream) | Server-Sent Events (SSE) |
| Persistent client-state | localStorage with a typed wrapper |

Avoid `useEffect`-driven data-fetching in App Router; prefer RSC. Document the decision in `architecture.md` under `## Data-Flow`.

---

## Decision 4: Tech-Stack-Decision-Matrix

For ambiguous parts of the stack, decide and record:

| Choice | Default | Alternative | When alternative |
|---|---|---|---|
| Styling | Tailwind v4 | CSS Modules | If briefing mentions corporate design-system |
| UI primitives | shadcn/ui | Radix-only | If shadcn templates clash with briefing aesthetic |
| Forms | React Hook Form + Zod | TanStack Form | If briefing mentions multi-step wizards (≥ 5 steps) |
| Icons | lucide-react | Custom SVG | Always lucide unless briefing forbids |
| Fonts | Local-bundled .woff2 | Next/font | Always local-bundled (DSGVO + perf reasons) |
| Image optimization | next/image with `quality={95}` + WebP source | Plain `<img>` | Always next/image with quality prop |
| API-route security | secureApiRoute wrapper + Zod-strict + requireRole | None | Always wrap |

**Hard rules** (non-negotiable):

- DSGVO: no Google Fonts via Google CDN — always local-bundled.
- Performance: image quality = 95 (default 75 re-compresses uploaded images poorly).
- Security: every API-route wraps secureApiRoute (rate-limit + Origin-check + body-validation).

---

## Decision 5: Folder-Structure

Canonical Next.js App Router layout:

```
customers/<slug>/
  app/
    layout.tsx              # root + chatbot mount + viewport
    page.tsx                # home
    [slug]/page.tsx         # dynamic for catalog-style pages
    api/
      chat/route.ts         # if chatbot integration enabled
      scan/route.ts         # if scanner integration enabled
      contact/route.ts      # contact form submission
    leistungen/
      page.tsx
      [...]
    impressum/page.tsx
    datenschutz/page.tsx
    cookies/page.tsx        # if cookie-banner used
    agb/page.tsx
  components/
    layout/
      Navbar.tsx
      Footer.tsx
      CookieBanner.tsx
    library/                # bound from project component-library (Phase 3)
    page-level/             # page-unique components
  lib/
    seo.ts                  # SEO meta helpers
    api/
      secure-route.ts       # secureApiRoute wrapper
      rate-limit.ts
    schemas/                # Zod schemas
  public/
    images/                 # WebP-optimised
    fonts/                  # .woff2 local bundle
  .aegis/
    state.json              # checkpoint
    briefing-parsed.json
    architecture.md
  briefing.md               # original input (left in place)
  audits/                   # populated in Phase 6 + 7
```

For non-Next.js stacks: replace `app/` and `pages/` paths with the framework-idiomatic equivalents. The semantic structure (components, lib, public, .aegis) stays the same.

---

## architecture.md Output Template

Phase 2 writes a structured architecture doc under `customers/<slug>/architecture.md`:

```markdown
# Architecture — <project_slug>

**Date:** YYYY-MM-DD
**Tech-Stack:** <chosen-stack>
**Routing:** <App Router | Pages Router | ...>
**Style:** Tailwind v4 + shadcn/ui

## Component-Tree

(table of pages × components, with ratio of page-level vs shared vs library-bound)

## Data-Flow

(per-page-section: where data comes from, how it's passed)

## API-Routes

(list per integration: chat, scan, contact, ...)

## Decisions Log

(any non-default-path choices, with rationale referencing the briefing)

## Pre-Phase-3 Confirmations

- [ ] Operator-confirmed tech-stack
- [ ] Operator-confirmed page-list (re-counted from briefing)
- [ ] Operator-confirmed integrations
```

---

## Anti-Patterns specific to Phase 2

- ❌ Choosing Pages Router for a new build "because it's simpler" — App Router is the canonical path; Pages Router only for legacy continuity.
- ❌ Skipping the architecture.md write "because we know what we're doing" — Phase 4 + 5 + 6 + 7 read this doc; missing it breaks downstream phases.
- ❌ Mixing styling approaches (Tailwind + CSS Modules + styled-components) — choose one, document, stick to it.
- ❌ Using `useEffect` for server-side data in App Router — that's Pages Router thinking; use RSC.
- ❌ Skipping `secureApiRoute` wrapping for "internal-only" routes — every API-route gets the wrapper, no exceptions.
