# Layer 5 Reference — Cookie + Consent (TTDSG/TDDDG §25)

Layer 5 verifies cookie-banner + consent-flow against TTDSG/TDDDG §25 (formerly TTDSG, renamed 2024-05-14 with TDDDG enactment) + BGH cookie-decision (2020-05-28) + EU-Cookie-Banner-Guidelines. **Time:** ~5-10 min per target.

---

## Probe Pattern

```bash
# Fresh page-load (no prior consent-cookies)
mkdir -p /tmp/audit-cookie-jar
rm -f /tmp/audit-cookie-jar/*
curl -sL -A "Mozilla/5.0" -c /tmp/audit-cookie-jar/cookies.txt "$TARGET" > /tmp/audit-fresh.html

# What cookies were set BEFORE consent?
cat /tmp/audit-cookie-jar/cookies.txt
```

Then a Playwright-based probe to detect dynamic cookies (set by JS) AND verify the consent-banner appears + works:

```bash
npx -y playwright-core@latest <<EOF
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  
  // Capture all requests + responses
  const requests = [];
  p.on('request', r => requests.push({ url: r.url(), type: r.resourceType() }));
  
  // Navigate
  await p.goto('$TARGET', { waitUntil: 'networkidle' });
  
  // Capture cookies pre-consent
  const preConsentCookies = await ctx.cookies();
  
  // Check for consent-banner
  const bannerSelector = 'div[id*="cookie"], div[class*="cookie"], div[class*="consent"]';
  const banner = await p.$(bannerSelector);
  const bannerHasBoth = banner ? await banner.evaluate(el => {
    const text = el.innerText.toLowerCase();
    return text.includes('akzeptieren') && (text.includes('ablehnen') || text.includes('reject'));
  }) : false;
  
  console.log(JSON.stringify({
    preConsentCookies,
    requests: requests.length,
    bannerPresent: !!banner,
    bannerHasBoth,
  }, null, 2));
  
  await b.close();
})();
EOF > /tmp/audit-cookie-probe.json
```

---

## TTDSG/TDDDG §25 Pre-Consent-Tracker Detection

```bash
# Pre-consent cookies (any technically-non-required cookie set before consent = §25 violation)
pre_count=$(jq -r '.preConsentCookies | length' /tmp/audit-cookie-probe.json)

# Filter for tracking-cookies (heuristic: 3rd-party domain or known-tracking-pattern)
tracking_pre=$(jq -r '.preConsentCookies[] | select(.domain | test("google|facebook|meta|doubleclick|hotjar|matomo|fathom|plausible|gtag|gads|fb_pixel|tiktok"))' /tmp/audit-cookie-probe.json)

[ -n "$tracking_pre" ] && echo "L5-PRE-CONSENT-TRACKER: KRITISCH"
```

---

## Banner-Pattern Compliance

| Check | Severity if violated |
|---|---|
| Banner appears on first page-load | KRITISCH (no banner = no consent collected) |
| Banner has equal-prominence "Accept" + "Reject all" | KRITISCH (BGH I ZR 7/16 — dark-pattern) |
| Banner is granular (per-vendor opt-in for non-essential) | HOCH (BGH 2020-05-28 — global-opt-in invalid) |
| Banner appears BEFORE any tracking-cookie set | KRITISCH (TTDSG §25) |
| User can opt-out at any time (e.g., footer-link to /cookies/einstellungen) | HOCH |
| Pre-checked checkboxes for opt-in | KRITISCH (DSGVO Art. 7 Abs. 2 — explicit consent required) |
| Bundling consent (e.g., AGB + Cookie consent in one checkbox) | HOCH |
| Continuing-to-use-site interpreted as consent | KRITISCH (BGH 2020-05-28 — mere browsing ≠ consent) |
| Re-prompt period reasonable (≥ 6 months between prompts unless settings changed) | LOW |

---

## Granular vs Global

| Pattern | Compliance |
|---|---|
| "Akzeptieren" + "Ablehnen" only (no granular) | HOCH (BGH-line — granular better) |
| "Akzeptieren" + "Ablehnen" + per-vendor toggle | OK (granular) |
| "Akzeptieren" + "Einstellungen" (where settings = granular) | OK if reachable in 1 click |
| "Akzeptieren" + tiny "Ablehnen" (visual asymmetry) | KRITISCH (dark-pattern, BGH-line) |
| "Akzeptieren" only (no reject-button on first banner) | KRITISCH |

---

## Consent-Mode-v2 (Google) Detection

If site uses Google products (Analytics, Ads, Tag Manager), check for Consent-Mode-v2:

```bash
grep -E 'gtag\(.consent.,\s*.default.|consentDefault' /tmp/audit-fresh.html

# default state should be 'denied' for ad_storage, ad_user_data, ad_personalization, analytics_storage
```

Default-`granted` for analytics_storage = pre-consent-tracking even with Consent-Mode = KRITISCH.

---

## Cookie-Categories Mapping

For each cookie set on the site, classify:

| Category | Consent-required | Examples |
|---|---|---|
| Strictly necessary | NO | session-id, csrf-token, cookie-consent-state |
| Functional | Implicitly OK | language-preference, theme |
| Analytics (anonymized) | YES (per §25) | matomo (with anonymize_ip), google-analytics-with-anonymize |
| Marketing / Advertising | YES (explicit, granular) | _ga, _gid (without anonymize_ip), _fbp, fr, doubleclick |
| Third-party content | YES (depending on data) | YouTube embed, Google Maps with API-key |

If a cookie is "Strictly necessary" — must be on a justified business-need; not just "we want it".

---

## Cookie-Banner-Library Detection

```bash
# Common libraries used on DACH sites
grep -iE '(usercentrics|cookiefirst|cookieyes|borlabs|webcm|consent-manager|onetrust|cookiepro|privacymanager|cookieinformation|complianz|iubenda)' /tmp/audit-fresh.html | head -3
```

If a recognized library is used — check its current-version compliance (via library-CHANGELOG cross-reference; e.g., Borlabs Cookie ≥ 2.2.0 is compliant; older versions had known dark-pattern bugs).

---

## CMP IAB-Framework Detection

```bash
# IAB-TCF-API presence
grep -E '__tcfapi\(|TCF_API|cmp\.openWindow' /tmp/audit-fresh.html
```

If TCF-v2 used — verify Vendor-List up-to-date + Purposes match what's actually loaded.

---

## Findings Format

```yaml
- id: L5-PRE-CONSENT-TRACKER
  layer: 5
  severity: KRITISCH
  evidence:
    target: <target>
    pre_consent_cookies: ["_ga", "_gid", "_fbp"]
    banner_present: true
    banner_appears_after_load: true  # but cookies were already set
  recommendation: "Move all tracking-cookies behind cookie-banner consent. Use Google Consent-Mode-v2 with default='denied'. Verify with fresh page-load + cookies.txt empty."
  citation: "TTDSG/TDDDG §25 Abs. 1; DSGVO Art. 7 Abs. 1; BGH I ZR 7/16 (2020-05-28); EuGH C-673/17 (Planet49)"
  abmahn_risk: "€500-5000 per finding (industry × visibility); composite with L4-DSE-DRITTLAND-MISSING bumps to €5000-15000"
```

---

## Anti-Patterns specific to Layer 5

- ❌ Probing with stale cookie-jar — always use fresh /tmp/audit-cookie-jar.
- ❌ Skipping Playwright probe "because curl is enough" — JS-set cookies invisible to curl.
- ❌ Reporting "no banner" for sites with technically-only cookies (no consent-required) — first verify what cookies are actually set.
- ❌ Marking "_ga" as KRITISCH if site uses Consent-Mode-v2 with default-denied — first check the consent-default-state.
- ❌ Reporting "global opt-in invalid" without checking BGH-line context — granular is preferred but global-only is HOCH not KRITISCH per current BGH-Linie.
- ❌ Inferring tracking-cookie from name alone — verify domain + actual purpose; some "_ga"-prefixed cookies are 1st-party-only.
