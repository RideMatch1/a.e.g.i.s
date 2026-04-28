# Phase 3 Reference — Component-Build (Library-Binding + Per-Page Iteration)

Phase 3 is the longest phase (60-90 min). Outputs: a working `app/` (or framework-equivalent) directory with one file per page, each page binding library-components + page-level components per the architecture.md.

**Subagent dispatch:** strongly recommended. One Executor-subagent (model: sonnet) per page-batch.

---

## Library-Binding Workflow

Before iterating pages, scan the project's component-library inventory:

```
1. Read library-inventory: <library-root>/components/*.tsx (or framework-equivalent)
2. Build map: { component-name: { props-shape, suggested-use-cases, dependencies } }
3. Cross-check each briefing page's sections against library-components
4. For each section in each page, choose: library-bound vs custom page-level
```

**Heuristic for library-vs-custom:**

| Section type | Default |
|---|---|
| Hero with image + headline + CTA | library-bound (HeroBlock) |
| Logo-bar / press-mentions | library-bound (LogoBar) |
| Feature-grid (3-6 features) | library-bound (FeatureGrid) |
| Testimonials carousel | library-bound (Testimonials) |
| Pricing-table (≥ 2 tiers) | library-bound (PricingTable) |
| FAQ accordion | library-bound (FaqAccordion) |
| CTA banner | library-bound (CtaBanner) |
| Founder-story / origin-narrative | page-level (custom prose) |
| Industry-specific module (e.g., scanner-widget for security business) | page-level (project-specific) |
| Custom data-visualization | page-level |

**Rule:** ≥ 60% of sections per page should be library-bound. Higher = better (consistent quality-bar). If a page is < 60% library-bound, flag for operator review.

---

## Per-Page Iteration Pattern

For each page in `briefing.pages[]`:

```
1. Create file at app/<slug>/page.tsx (or root for slug == "home")
2. Pull metadata from briefing-parsed.json[<slug>]
3. Generate metadata export: { title, description, canonical }
4. Compose JSX:
   a. Import library-bound components for sections marked library
   b. Define page-level components for sections marked custom
   c. Order sections per briefing's page.sections[]
5. Apply props per briefing-parsed.json (headlines, copy stubs from Phase 1)
6. Verify file compiles: tsc --noEmit on the single file
7. Checkpoint: .aegis/state.json `pages_built: [<slug>]` updated
```

Repeat for every page. Use TaskCreate per page to track progress; mark each page completed as soon as the file compiles.

---

## Component-File Template (page-level)

For a page-level (custom) component, the canonical shape:

```tsx
// app/<slug>/components/UniqueSection.tsx
'use client';  // omit if pure RSC

import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

interface Props extends ComponentProps<'section'> {
  headline: string;
  subline?: string;
  // ... other props per briefing
}

export function UniqueSection({ headline, subline, className, ...rest }: Props) {
  return (
    <section className={cn('py-16 md:py-24', className)} {...rest}>
      <div className="container mx-auto max-w-7xl px-4">
        <h2 className="text-3xl font-bold md:text-5xl">{headline}</h2>
        {subline && <p className="mt-4 text-lg text-muted-foreground">{subline}</p>}
        {/* ... */}
      </div>
    </section>
  );
}
```

**Discipline:**
- Always typed props (no `any`).
- Always `cn()` for className composition.
- Always responsive (`md:`, `lg:` breakpoints).
- Always semantic HTML (`section`, `article`, `nav`, `header`, `footer`).
- Never mutate the imported library-component's internals — extend by composition, not inheritance.

---

## Common Library-Component Shapes

The project's component-library typically exposes these well-known shapes. The actual implementation depends on the bound library; here's the **conceptual contract** the customer-build expects:

```tsx
// Hero
<HeroBlock
  variant="image-left" | "image-right" | "centered" | "split"
  headline={string}
  subline={string}
  primaryCta={{ label, href }}
  secondaryCta?={{ label, href }}
  imageSrc={string}
  imageAlt={string}
/>

// FeatureGrid
<FeatureGrid
  variant="3-col" | "2-col" | "asymmetric"
  features={Array<{ icon, title, description }>}
/>

// Testimonials
<Testimonials
  variant="carousel" | "grid" | "single"
  items={Array<{ quote, name, role, avatarSrc? }>}
/>

// PricingTable
<PricingTable
  tiers={Array<{ name, price, description, features[], cta }>}
  highlightTier?={string}
/>

// CtaBanner
<CtaBanner
  headline={string}
  subline?={string}
  cta={{ label, href }}
/>
```

If the bound library uses different prop-names — read the library's component-inventory in pre-build, then map briefing-shape to library-shape per a `references/library-mapping.md` (extension-point).

---

## Page-Level Composition Example

```tsx
// app/page.tsx (home page)
import { HeroBlock, FeatureGrid, Testimonials, CtaBanner } from '@/components/library';
import { OriginStory } from './components/OriginStory';

export const metadata = {
  title: '...',
  description: '...',
};

export default function HomePage() {
  return (
    <>
      <HeroBlock
        variant="image-right"
        headline="..."
        subline="..."
        primaryCta={{ label: 'Jetzt anfragen', href: '/kontakt' }}
        imageSrc="/images/hero.webp"
        imageAlt="..."
      />
      <FeatureGrid
        variant="3-col"
        features={[/* per briefing */]}
      />
      <OriginStory />
      <Testimonials variant="carousel" items={[/* per briefing */]} />
      <CtaBanner
        headline="Bereit für den nächsten Schritt?"
        cta={{ label: 'Kontakt aufnehmen', href: '/kontakt' }}
      />
    </>
  );
}
```

---

## Quality-Gate Per Page

Before marking a page complete:

- [ ] File compiles (`tsc --noEmit` clean for that page's tree)
- [ ] Page renders without runtime errors (smoke-test via dev-server: `curl -s localhost:3000/<slug> | head -50` returns HTML, not 500)
- [ ] All briefing.sections[] are present in the JSX (count match)
- [ ] All required props are filled (no `headline=""` placeholders left)
- [ ] Image-paths point to actual files (not 404s) — placeholders for Phase 4 are OK if explicitly marked

If any unmet → page is incomplete; checkpoint stays `pages_built: [...without this page]`.

---

## Subagent-Dispatch Pattern

For builds with > 5 pages, dispatch parallel Executor-subagents:

```
Master-agent:
  for each batch in chunked(pages, 3):
    dispatch Executor-subagent with prompt:
      "Build pages [a, b, c] per architecture.md + briefing-parsed.json.
       Library-mapping: <map>. Output: 3 page.tsx files.
       Verify: tsc + curl smoke-test. Return checkpoint."

  await all Executor-subagents
  aggregate checkpoints into .aegis/state.json
```

Subagent-prompt MUST include:
- The architecture.md path
- The briefing-parsed.json path
- The component-library mapping
- The verification-checklist (tsc + curl + sections-count)

Don't dispatch without these — subagents shouldn't have to rediscover them from chat-context.

---

## Anti-Patterns specific to Phase 3

- ❌ Hand-cobbling a section that has a library-component for it — drift from quality-bar.
- ❌ Skipping the per-page tsc + curl smoke-test "because the page looks fine" — page-renders-without-runtime-errors is gate-critical.
- ❌ Marking pages_built[<slug>] without actually verifying — checkpoints are honest, not optimistic.
- ❌ Building all pages in one Master-agent monologue when parallel Executor-subagents are available — wastes wall-clock time.
- ❌ Forgetting to copy library-component CSS / dependencies — verify the imports compile + the runtime CSS bundle includes the components.
