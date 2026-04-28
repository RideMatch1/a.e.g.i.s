# Phase 4 Reference — Content (Copy + Images + SEO)

Phase 4 fills the page-shells from Phase 3 with real content: copy in the briefing's tone, images placed per the design-prefs, SEO-meta + Open-Graph + Schema.org structured data. **Time budget:** 30-45 min.

---

## Copy-Writing — Tone-Match per Page

For each page, follow the brand-essence captured in `briefing-parsed.json.brand_identity`:

```
Essence: <target_audience> looking for <value_proposition>; differentiated by <differentiators>, speaking in a <tone> voice with <voice>.
```

**Example tone-matrices:**

| Tone | Voice | Lexical pattern |
|---|---|---|
| Vertraut, professionell | Sie + Plural-Wir | "Wir liefern Ihnen..." |
| Locker, modern | Du | "Du bekommst..." |
| Premium, gehoben | Sie + reduzierte Adjektive | "Unsere Manufaktur..." |
| Tech, präzise | Wir + Fachbegriffe | "Unsere Engine berechnet..." |

**Hard rules:**
- Don't mix Sie / Du within one site. Pick one per the briefing.
- Avoid Anglizisms unless the briefing uses them. "kostenlos" not "free", "Anmeldung" not "Sign-up".
- Avoid Marketing-Phrasen-Müll ("revolutionär", "einzigartig", "innovativ" without a concrete claim) — concrete > superlative.
- Avoid passive-voice when active works ("Wir bauen" > "Es wird gebaut").

---

## Per-Section Copy-Slot Workflow

For each page section that needs copy:

```
1. Read briefing-parsed.json.pages[<slug>].sections[<section>] for any provided copy
2. If briefing has copy: use it verbatim
3. If briefing has bullets but no prose: expand bullets into prose matching brand-essence
4. If briefing has only intent ("hero CTA pointing at /kontakt"): generate per intent + tone-match
5. Write copy into the JSX — no placeholder strings left
```

**LLM-assist pattern** (for prose generation):

```
System: <brand-essence-paragraph>
User: Generate hero subline for the home page.
Constraints: 1-2 sentences, ≤ 160 characters, mentions <key-differentiator>, ends with action-verb.
```

Always operator-review LLM-generated copy. The briefing is the contract; LLM-fill is a placeholder until operator confirms in mid-audit.

---

## Image-Placement Workflow

The image-pipeline follows the operator's existing convention:

```
1. Read briefing.assets[] for image-references
2. For each referenced image:
   a. If a local file exists at briefing.assets[*].src: copy to public/images/<slug>-<section>.webp
   b. If a placeholder is needed: generate via the operator's image-pipeline (e.g., Midjourney + cwebp-conversion to WebP)
   c. Always WebP at quality 88 (cwebp -q 88) — saves ~40% bytes vs PNG/JPG
   d. Always responsive sources at 1920w + 1280w + 640w breakpoints
3. Update JSX: <Image src="/images/<file>.webp" alt="<alt-text>" width={...} height={...} quality={95} />
```

**Hard rules:**
- Always `quality={95}` prop on `next/image` — default 75 re-compresses operator-uploaded high-quality images poorly.
- Always WebP for raster (PNG/JPG only for legacy logos that need transparency in browsers without WebP fallback — rare).
- Always alt-text — write meaningful alt-text per image-content, not "image.webp" or empty.

---

## Alt-Text Generation

For each image, alt-text MUST:

1. Describe what's in the image (factual, concrete).
2. Be ≤ 120 characters.
3. Not start with "Image of..." or "Picture showing..." — redundant; screenreaders announce "image" already.
4. Match the image-context (e.g., for a hero-image, the alt-text relates to the hero-headline).
5. Be unique across the page (no two images with identical alt-text).

**Example:**

- ❌ "image.webp"
- ❌ "Picture of a person"
- ✅ "Frau am Laptop, fokussiert beim Coden im hellen Atelier"

---

## SEO-Meta per Page

Every page exports `metadata` (App Router) or sets `<head>` (Pages Router) with:

```tsx
export const metadata: Metadata = {
  title: '<unique-per-page>',           // 50-60 chars, includes brand at end
  description: '<unique-per-page>',     // 120-160 chars, includes target_keyword
  alternates: {
    canonical: '/<slug>',
  },
  openGraph: {
    title: '<og-title>',
    description: '<og-description>',
    images: ['/images/og-<slug>.webp'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '<twitter-title>',
    description: '<twitter-description>',
    images: ['/images/og-<slug>.webp'],
  },
};
```

**Per-page-uniqueness check:** every page's `title` is unique (no duplicates). Same for `description`. Phase 7 briefing-coverage gate verifies this.

---

## Schema.org Structured Data

Inject JSON-LD per page-type:

| Page-type | Schema |
|---|---|
| Home (organization) | `Organization` + `LocalBusiness` (if local biz) |
| Service-page | `Service` |
| Blog-post | `BlogPosting` |
| FAQ-page | `FAQPage` |
| Product | `Product` |
| Contact | `ContactPage` |
| About | `AboutPage` |

Render via a `JsonLdScript` component:

```tsx
<JsonLdScript
  schema={{
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: '<brand>',
    url: '<canonical-url>',
    logo: '<logo-url>',
    sameAs: [/* social-links from briefing */],
  }}
/>
```

Use a Next.js Script component (strategy="beforeInteractive") to ensure Google sees the schema before user-interaction.

---

## Open-Graph Images

Generate one OG-image per page (or share a default for sub-pages):

```
1. Use a generator (e.g., next/og or Vercel OG) at /api/og?page=<slug>
2. Or pre-generate static .webp/.png at public/images/og-<slug>.webp
3. 1200x630 for Facebook/LinkedIn; 1200x675 for Twitter (use 1200x630 for both, slight crop OK)
```

If briefing doesn't specify per-page OG-images, reuse the home-page OG for sub-pages.

---

## Content-Completion Checklist

Before marking Phase 4 complete:

- [ ] Every page has copy in every section (no `Lorem ipsum` or `<placeholder>` left)
- [ ] Every image is placed (no `<img src="">` or 404 paths)
- [ ] Every image has meaningful alt-text
- [ ] Every page has unique SEO-meta title + description
- [ ] Every page has canonical URL set
- [ ] Every page has OG + Twitter card meta
- [ ] Every applicable page-type has Schema.org JSON-LD
- [ ] No anglicisms / marketing-müll / placeholder-prose

If any unmet → Phase 4 is incomplete. List failing items in `.aegis/state.json.phase_4_open[]`.

---

## Anti-Patterns specific to Phase 4

- ❌ Leaving "Lorem ipsum" or "<placeholder>" strings — they survive into production. Grep before commit.
- ❌ Using `<Image quality={75}>` (default) — re-compresses high-quality uploads poorly.
- ❌ Same SEO-title across pages — Google will deduplicate and one page wins.
- ❌ Empty or duplicate alt-texts — fails A11y.
- ❌ Schema.org JSON-LD with placeholder URLs — Google flags "Site doesn't match schema."
- ❌ Mixing Sie/Du within one page — operator-confirms one or the other in Phase 1.
