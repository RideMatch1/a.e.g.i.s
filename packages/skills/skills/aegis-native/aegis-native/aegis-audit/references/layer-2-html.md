# Layer 2 Reference — HTML-Live-Probe

Layer 2 fetches the rendered HTML and analyzes structural + content patterns. Catches: missing alt-texts, broken meta-tags, SSR-skeleton-only pages, inline-script-leaks, missing footer/legal links. **Time:** ~3-5 min per target.

---

## Probe Pattern

```bash
# Static fetch (curl)
curl -sL -A "Mozilla/5.0 (compatible; aegis-audit/1.0)" "$TARGET" > /tmp/audit-html-static.html

# Dynamic fetch (Playwright — captures JS-rendered content)
npx -y playwright-core@latest <<EOF
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ userAgent: 'aegis-audit/1.0' });
  const p = await ctx.newPage();
  await p.goto('$TARGET', { waitUntil: 'networkidle', timeout: 30000 });
  console.log(await p.content());
  await b.close();
})();
EOF > /tmp/audit-html-dynamic.html

# Diff — large diff = heavy client-rendering (SSR/CSR balance check)
wc -l /tmp/audit-html-*.html
```

---

## Structural Checklist

| Check | How | Severity |
|---|---|---|
| `<!doctype html>` present | `head -1 audit-html-static.html` | HOCH (missing) |
| `<html lang="...">` set | `grep -oE '<html[^>]*lang=' audit-html-static.html` | MITTEL (missing) |
| `<title>` present + non-empty + < 60 chars | `grep -oE '<title>[^<]*</title>'` | HOCH (missing or empty) |
| `<meta charset="utf-8">` | `grep -oE '<meta[^>]*charset=' audit-html-static.html \| head -1` | MITTEL (missing) |
| `<meta name="viewport">` | `grep -oE '<meta[^>]*viewport='` | HOCH (missing — mobile broken) |
| `<meta name="description">` | `grep -oE '<meta[^>]*description='` | HOCH (missing) |
| Heading-hierarchy (one h1, h2 → h3 ordering) | parse + check | MITTEL (multiple h1) / LOW (skip h2 → h3) |
| Open-Graph tags (og:title, og:description, og:image, og:url) | `grep -E 'og:(title\|description\|image\|url)'` | MITTEL (missing) |
| Twitter card tags | `grep -E 'twitter:card'` | LOW (missing) |
| Schema.org JSON-LD | `grep -oE 'application/ld\+json'` | LOW (missing) |
| Canonical link | `grep -oE 'rel="canonical"'` | MITTEL (missing) |

---

## Image Checks (alt-text, lazy-load, dimensions)

```bash
# Find all img tags
grep -oE '<img[^>]*>' /tmp/audit-html-static.html > /tmp/audit-imgs.txt

# Count
total=$(wc -l < /tmp/audit-imgs.txt)

# Missing alt-text
missing_alt=$(grep -cv 'alt=' /tmp/audit-imgs.txt)
empty_alt=$(grep -c 'alt=""' /tmp/audit-imgs.txt)

# Missing dimensions (CLS issue)
missing_dim=$(grep -cE 'width=' /tmp/audit-imgs.txt | head -1)

echo "Images: $total, missing alt: $missing_alt, empty alt: $empty_alt"
```

| Check | Severity |
|---|---|
| Image without `alt=` | HOCH (A11y violation) |
| Image with `alt=""` (and not decorative-only) | MITTEL (A11y) |
| Image without `width` + `height` (causes CLS) | MITTEL |
| Image without `loading="lazy"` (below fold) | LOW (perf) |
| Image larger than render-size (e.g., 4000px-image rendered at 800px) | MITTEL (perf) |

---

## SSR-Skeleton Detection

```bash
# Static HTML body length vs dynamic
static_body_len=$(grep -oE '<body[^>]*>.*</body>' /tmp/audit-html-static.html | wc -c)
dynamic_body_len=$(grep -oE '<body[^>]*>.*</body>' /tmp/audit-html-dynamic.html | wc -c)

# If static body is < 20% of dynamic body — SSR-skeleton (SEO-bad)
ratio=$(echo "scale=2; $static_body_len / $dynamic_body_len" | bc)
[ $(echo "$ratio < 0.2" | bc) = 1 ] && echo "L2-SSR-SKELETON-ONLY: HOCH"
```

For Next.js App Router: SSR-skeleton + heavy client-side rendering = SEO penalty. Phase 2 architecture decisions should favor RSC.

---

## Inline-Script Detection (CSP cross-check)

```bash
# Count inline scripts (no src attr)
inline_count=$(grep -oE '<script[^s]*>' /tmp/audit-html-static.html | wc -l)

# Big inline scripts may indicate injected analytics or unsafe-inline patterns
grep -oE '<script[^s][^>]*>[^<]{100,}' /tmp/audit-html-static.html | head -5
```

If inline-scripts found AND Layer 1 CSP allows `'unsafe-inline'` on `script-src` → composite HOCH.

---

## Footer-Link Resolution (feeds Layer 3)

Layer 3 (Impressum) needs the footer-link to /impressum. Resolve via:

```bash
# Find footer
footer=$(grep -oE '<footer[^>]*>.*</footer>' /tmp/audit-html-static.html | head -1)

# Find links in footer
echo "$footer" | grep -oE '<a[^>]*href="[^"]*"[^>]*>[^<]*</a>'

# Extract the impressum-href
echo "$footer" | grep -oE 'href="[^"]*impressum[^"]*"' | head -1
```

If no `/impressum` link in footer or in main-nav — Layer 3 reports L3-IMPRESSUM-NO-FOOTER-LINK: HOCH.

If link exists but points to 404 — Layer 3 reports L3-IMPRESSUM-LINK-BROKEN: KRITISCH.

---

## Findings Format

```yaml
- id: L2-IMG-MISSING-ALT
  layer: 2
  severity: HOCH
  evidence:
    url: <target>
    img_count: 14
    missing_alt: 3
    affected: ["img[1]", "img[7]", "img[12]"]  # XPath-ish
  recommendation: "Add meaningful alt-text to each img per WCAG 2.1 1.1.1"
  citation: "WCAG 2.1 1.1.1, BFSG §3"
```

---

## Anti-Patterns specific to Layer 2

- ❌ Skipping Playwright fetch "because curl is faster" — JS-rendered content invisible to curl-only.
- ❌ Reporting "no h1" without parsing — DOM-order matters; first h1 might be inside a `<header role="banner">`.
- ❌ Marking `alt=""` as KRITISCH — empty alt is correct for purely-decorative images per WCAG; downgrade.
- ❌ Reporting "missing OG-tags" for an internal admin-page — admin-pages don't need OG.
- ❌ Inferring SSR-skeleton from static-body length alone — also check if `<noscript>` content fills the gap.
