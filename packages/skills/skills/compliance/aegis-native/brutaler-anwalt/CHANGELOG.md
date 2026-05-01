# Changelog — brutaler-anwalt

Alle relevanten Aenderungen am Skill werden hier dokumentiert.
Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung folgt [SemVer](https://semver.org/lang/de/).

> Provenance-Disziplin (SKILL.md §5) ist seit v3.0 zero-tolerance.
> Jede neue Az. in `references/bgh-urteile.md` muss eine Source-URL haben
> (Primaerquelle bevorzugt; Sekundaerquelle mit `[secondary-source-verified]`-Tag).

---

## [Unreleased] — Roadmap zu v4.0.0

Naechste Schritte (mehrere Sessions, siehe `MAXOUT-PROGRESS.md` falls vorhanden):

- [ ] `references/gesetze/` — strukturierte Auszuege fuer leere Folders (HinSchG, NIS2UmsuCG-BSIG, KritisDachG, StGB §§ 202a-d, ePrivacy-RL, DMA, ODR, eIDAS, StPO, IHK-DSK-EDSA-Guidelines) + 6 audit-relevance.md fuer befuellte Folder (BDSG, TDDDG, DDG, BGB, HGB-AO, UWG, VSBG, BFSG)
- [ ] `references/stack-patterns/` — 22 weitere Files: vue/, astro/, laravel/, rails/, django/, express/, nest/, strapi/ (frameworks), auth/auth0+clerk+custom-jwt, payment/paddle+mollie+lemonsqueezy+paypal, tracking/google-analytics+posthog+umami+mixpanel+fathom, ai/anthropic-dpa+replicate+self-hosted-llm, react/cookie-banner+consent-gate, nextjs/env-driven-tracking+dynamic-rendering+api-bearer-auth
- [ ] `references/bgh-urteile.md` Source-URL-Coverage 39/67 → 67/67 (28 Az. ohne Source pflegen, primary-source bevorzugt; nach v3.3.0-Spot-Check sind Halluzinations-Verdaechtige bereinigt)
- [ ] `references/abmahn-templates.md` — DSA-Notice + BFSG-Anhoerung + AI-Act-Behoerden-Anhoerung + Crypto-MiCA + HinSchG
- [ ] `references/aegis-integration.md` — Update auf AEGIS v0.17.x Module-Map
- [ ] `references/international.md` — Schweiz nFADP (revDSG) + Oesterreich DSG-Layer + Liechtenstein
- [ ] `references/vertragsrecht.md` — § 312k Pflicht-Klauseln-Komplettliste + FairVertrG 2022 + B2B vs B2C Abgrenzungs-Pattern
- [ ] `references/strafrecht-steuer.md` — § 202a-d StGB Volltext + GoBD-Praxis
- [ ] OSS-Release als MIT-Submodule unter AEGIS-Repo (User-authorized)
- [ ] OOC-Anti-Overfit-Verification (cross-project audit comparison)

---

## [3.4.0] — 2026-05-01 — Audit-Korrektur + Live-E2E-Verify-Lessons

Erweiterungen aus dem Live-Fix-Cycle desselben Audit-Targets (eine Session
nach v3.3.0). Skill wird jetzt durch echten End-to-End-Verify gehaertet,
nicht mehr nur durch statische Audit-Pattern.

### Changed
- **audit-patterns.md Phase 5g DKIM-Check** auf Multi-Selector-Pattern erweitert.
  Ehemalige Pflicht-Annahme „TXT auf `default._domainkey` ist Standard" hat
  bei All-Inkl-Hosting einen False-Positive produziert: All-Inkl generiert
  beim DKIM-Aktivierungs-Klick einen eigenen Selector im Format
  `kasYYYYMMDDHHMMSS._domainkey`, der einen Wildcard-CNAME `*._domainkey` durch
  Specific-over-Wildcard-Regel ueberschreibt. Lesson: NIE nur `default` testen,
  sondern (1) sample-mail-header `DKIM-Signature: ... s=<selector> ...` lesen,
  (2) mit DIESEM Selector `dig +short TXT <selector>._domainkey.<domain>`,
  (3) Multi-Selector-Probe als Fallback (`default`, `mail`, `s1`, `k1`,
  `kas...`, `selector1`, `google`).

- **bgh-urteile.md** Audit-Korrektur: Finding "DKIM defekt" wurde im operativen
  Audit-Re-Run zum FALSE-POSITIVE umklassifiziert nach DNS-Sicht-Klärung
  (User-Screenshot zeigte korrekten DKIM-TXT-Record auf hoster-spezifischem
  Selector). Das ist eine wertvolle Lesson für brutaler-anwalt-Skill:
  audit-side-Verify per `dig` allein ist nicht ausreichend — Operator-DNS-
  Settings-View ist die definitive Quelle.

### Added
- **audit-patterns.md Phase 5g** Operator-View-Pflicht-Check ergaenzt:
  „Bei DKIM-Verdacht NICHT nur `dig`, sondern auch Operator-DNS-Settings-View
  einsehen — Specific-over-Wildcard-CNAME-Konstellationen koennten den
  `dig`-Output verschleiern."

- **NEUER Pattern in audit-patterns.md Phase 5d Origin-Strict-Match**: Multi-
  Surface-Regression-Discovery. Im Live-Fix-Cycle wurden 3 weitere API-Routes
  (`contact`, `widerruf`, `consent-log`) mit demselben startsWith-Origin-Bug
  entdeckt — ueber den initial-gepruefte newsletter hinaus. Skill-Pflicht-
  Check: `grep -rEn "function isValidOrigin|origin\.startsWith" src/app/api/
  src/lib/` — alle API-Routes muessen einen einzigen shared validator
  importieren, **kein** lokal-defined Variant.

- **NEUER Pattern Phase 5d File-Storage in Production-Container**:
  process.cwd()-basiertes File-Storage funktioniert lokal, kann aber in
  Docker-Production-Container schreib-Permissions failen. Pflicht: Default-
  Path mit `os.tmpdir()` als Production-Fallback + ENV-Override fuer
  persistent volume. Detail: in audit-patterns.md Phase 5d „Folder-/Slug-
  Sanitization"-Zeile bei Bedarf erweitern.

- **NEUER Pattern Phase 5g granulare Try-Catch**: Newsletter-DOI-Endpoint
  hatte initial einen Bug — kein granulares Try-Catch um Mail-Send,
  resultiert in HTTP 500 wenn Mail fail. Best-Practice: Persist-Fail = 500
  (User soll nicht denken Anmeldung war OK), Mail-Fail = 200 + Log + retry-
  Moeglichkeit (User kann erneut anmelden). Beispiel-Vorbild: konfigurator/
  route.ts mit try-catch um sendKonfiguratorEmails.

### Skill-Lesson auf Meta-Ebene
**Static-Audit + Live-E2E-Verify ist ein Pflicht-Paar.** Static-Audit allein
produziert False-Positives (DKIM-Wildcard-CNAME-Verschleierung) UND uebersieht
Multi-Surface-Regressions (3 weitere Origin-Bugs). Brutaler-anwalt-Skill v3.4
empfiehlt jetzt explizit: nach jedem Audit ein End-to-End-Verify am echten
Live-System mit echten Test-Tokens / Test-Mails / DNS-Probes.

### AGB-Audit-Pattern (NEU in audit-patterns.md Phase 4 vorgeschlagen für v3.5)
Der gleiche Audit-Cycle deckte 4 AGB-Inkonsistenzen + 3 fehlende state-of-the-
art-Klauseln auf. Skill-Erweiterung fuer naechste Version: Phase 4 DSE-Drift-
Audit-Matrix sollte um „AGB-Konsistenz-Pass" erweitert werden mit Pflicht-
Pruefungen:
- Frist-Konflikt-Check (mehrere Werktage-/Kalendertage-Fristen — wann genau, was triggert)
- Zahlungs-Reihenfolge-Check (Vor/nach Vertragsunterschrift, vor/nach Demo)
- Rücktrittsrecht-vs-Mängelrechte-Verhältnis-Klausel (B2B parallel-Schutz)
- Höhere-Gewalt-Klausel (Drittanbieter-Ausfälle: Hosting/CDN/Email/AI)
- KI-Verordnung-Art.-50-Klausel (ab 02.08.2026 Pflicht für KI-Inhalte)
- Preisanpassungs-Klausel mit CPI-Cap (BGH XI ZR 26/20-konform)

---

## [3.3.0] — 2026-05-01 — Audit-driven Maxout (DACH-Brand-Audit)

### Added
- **audit-patterns.md** Phase 5d — KONFIGURATOR-/MULTI-STEP-FORM-AUDIT: 14 Pflicht-Checks (Origin-Strict, Honeypot, CSRF, Rate-Limit, Zod, Server-Pricing, Folder-Sanitization, File-Upload-Polyglot, PII-Pre-Submit-Hygiene, DSE-Konfigurator-Block, TTL-Loesch-Konzept, Eingangsbestaetigung, Pre-DSGVO-Hinweis, Email-Pflichtfeld-Trennung) + 6 Verify-Curl-Probes + Az.-Anker.
- **audit-patterns.md** Phase 5e — AI-CHATBOT-/LLM-DSGVO-AUDIT: 14 Pflicht-Checks (Vendor-AVV/DPA, Drittland-DSE, Pre-Consent-Loading, Prompt-Logging-Doku, PII-Auto-Redaction, Auskunftsrecht-Routing, System-Prompt-Anti-Leak, Prompt-Injection-Defense, AI-Act-Transparenz, Anti-Hallucination-Disclaimer, Response-Filter, Rate-Limit, Origin-Check, Konversations-TTL, Children-Schutz) + 5 Verify-Curl-Probes + Az.-Anker (Art. 50 EU AI Act).
- **audit-patterns.md** Phase 5f — SCANNER-/AUDIT-TOOL-SELBST-AUDIT: 12 Pflicht-Checks (RDG-Disclaimer, FP/FN-Liability, Eingabe-URL-Logging, Active-Probes-Authorisierung, SSRF-Defense, DNS-Rebinding-Defense, Rate-Limit, Output-Sanitization, Drittstellen-Hinweis, FP/FN-Tracking, User-Consent-Hinweis, Output-Disclaimer-pro-Finding) + 5 Verify-Curl-Probes + Az.-Anker (BGH I ZR 113/20 Smartlaw, § 202a-c StGB).
- **audit-patterns.md** Phase 5g — EMAIL-/SMTP-OUTBOUND-COMPLIANCE-AUDIT: 6 Mail-Authentifizierungs-Checks (SPF/DKIM-TXT-NICHT-CNAME/DMARC-mit-Reporting/BIMI/MX/Reporting-Adresse) + 12 Outbound-Compliance-Checks (3rd-Party-AVV, IP-Reputation, Bestandskunden, DOI, Bestaetigungs-Mail-Werbung, Unsubscribe, List-Unsubscribe-Header, Footer-Impressum, Consent-Beweis-Doku, Cold-Outreach, Bounce-Handling, TLS) + 7 Verify-Commands (dig + nc + Inbox-Header-Check) + Az.-Anker.

### Changed
- **SKILL.md** §5(c) Halluzinations-Indikatoren erweitert um V3.3-Lesson: WebSearch-Treffer mit „aehnlichem Sachverhalt" sind NICHT ausreichend — Pflicht-WebFetch zur Az.-Volltext-Verifikation. Anlass: Audit 2026-05-01 entdeckte 2 Halluzinationen (OLG Hamm 4 U 75/23 + LG Berlin 16 O 9/22). Beide WebSearch-Vorschlaege waren initial falsch — erst WebFetch-Volltext zeigte korrektes Az. (OLG Hamm 11 U 88/22, 20.01.2023, lennmed.de Source).
- **bgh-urteile.md** OLG Hamm 4 U 75/23 → ersetzt mit verifiziertem **OLG Hamm 11 U 88/22 (20.01.2023)** + Source lennmed.de + Provenance-Note.
- **bgh-urteile.md** LG Berlin 16 O 9/22 → markiert als VERDACHT-HALLUZINATION + auf BGH I ZR 218/07 + § 7 UWG-Rechtsprechung umgeleitet.
- **bgh-urteile.md** KG Berlin 5 U 87/19 Duplikat konsolidiert (eine Section mit secondary-source-verified Source bleibt).
- **branchenrecht.md** neue Branche **Webdesign-Agentur / Marketing-Agentur** (post-2026-05-01-Audit-Lessons): 11 Pflicht-Checks + Trigger + Az.-Anker (BGH I ZR 113/20, I ZR 218/07, I ZR 161/24, OLG Hamm 11 U 88/22).
- **scripts/health-check.sh** pipefail-Bug gefixt: `grep -l` mit no-match → exit 1 propagiert mit `set -euo pipefail` → Script abbruch. Fix: Subshell + `|| true` + Klammern. Brand-Leak + Templates-Check liefern jetzt korrekt 0 Treffer.

### Audit-Validierung (battle-tested 2026-05-01)
Phasen 5d/5e/5f/5g auf einer Live-DACH-Brand-Site (Webdesign-Agentur, B2B-primaer, Konfigurator + Mistral-Chatbot + AEGIS-Scanner) angewandt. Ergebnis: **10 Findings produziert** (3 KRITISCH: Newsletter-Single-Opt-In + DSE-Drift + Newsletter-Origin-Bug + DKIM-CNAME-Defekt; 3 HOCH: DMARC-`p=none` + BFSG-Pflicht-Seite-404 + CSP-frame-src-Maps-Drift; 4 NIEDRIG/MITTEL). DEVIL'S ADVOCATE ergaenzte Sammelklage-Vektor + AI-Act-Future-Pflicht. LIVE-PROBE-Matrix: 17 PASS / 4 FAIL / 1 not-tested. Phase 5g war highest-ROI mit 3 hochwertigen Findings (DKIM/DMARC/Newsletter-SOI). Audit-Output liegt operator-side im jeweiligen Repo-`strategy/`-Folder.

---

## [3.2.0] — 2026-05-01 — Sanitization + OSS-Release-Vorbereitung

### Added
- `references/templates/` mit 11 anonymisierten Snippets:
  - `DSFA-template.md`, `VVT-template.md`, `COMPLIANCE-AUDIT-TRAIL-template.md`
  - `AffiliateDisclaimer.tsx.example`
  - `proxy-strict-dynamic.ts.example`
  - `data-retention-cron.ts.example`, `data-retention-workflow.yml.example`
  - `UmamiScript.tsx.example`, `security.txt.example`
  - `DSE-Section-UGC.md.example`, `LostFoundReportForm-consent.tsx.example`
- `CHANGELOG.md` (diese Datei)
- `README.md` mit RDG-Disclaimer + Install-Hinweisen + Contribution-Guidelines
- `LICENSE` (MIT)

### Changed (Sanitization — brand-agnostisch)
- `audit-patterns.md`: 11 brand-spezifische Refs auf generic Lessons-Bezeichner umgestellt (`operativ-Audit 2026-04-27`, `V3.1-Audit-Vorfall 2026-04-30`, `UGC-Plattform-Audit 2026-05-01`).
- `SKILL.md` §5(a) + §5(g): Brand-Refs durch neutrale Beschreibung ersetzt.
- `dsgvo.md`, `checklisten.md`, `branchenrecht.md`, `bgh-urteile.md`,
  `aegis-integration.md`: alle internen Codenamen entfernt.
- Lehrbuch-Beispiele auf `references/templates/`-Pfade umgebogen statt direkt
  konkrete Operator-Repos zu zitieren (Strategie: teaching-value erhalten,
  Operator-Identitaet entfernen).

### Migrationspfad fuer abhaengige Skills
- Wer auf `compliance/DSFA-2026.md` / `compliance/VVT-2026.md` /
  `<operator-customer-build>/src/proxy.ts` o.ae. Pfade in vorherigen
  Skill-Versionen verlinkt hatte: bitte auf
  `references/templates/DSFA-template.md` /
  `references/templates/VVT-template.md` /
  `references/templates/proxy-strict-dynamic.ts.example` umstellen.

---

## [3.1.0] — 2026-05-01 — V3.1-Lessons + UGC-PII-Audit

### Added
- `audit-patterns.md` Phase 5c — UGC-PUBLIC-PII-AUDIT (post-V3.1-Audit-Lessons): 6-stufige Pflicht-Checks fuer Vermisst-/Marketplace-/Forum-Plattformen.
- `audit-patterns.md` Phase 5b — BFSG-AUDIT (B2C E-Commerce, BFSG seit 28.06.2025).
- `audit-patterns.md` Phase 6b — Deployment-Codename-Leak-Check (CSP / Public-Text / Repo-Grep, 3 Surfaces).
- `audit-patterns.md` Stand-Datum-Hygiene-Check.
- `dsgvo.md` DSFA-Trigger-Liste + VVT-KMU-Best-Practice.
- `checklisten.md` Checkliste 3b AGB-B2C Pflicht-Klauseln-Komplettliste + Checkliste 3c Affiliate.
- `bgh-urteile.md` EuGH C-131/12 Google Spain + BGH I ZR 169/17 (§ 36 VSBG).

### Changed
- SKILL.md §5(g): V3.1-Lessons (Pre-Deploy-Gate, Verify-Command-Pflicht bei DSE-Aenderungen mit operativer Dimension, Code-Var-Names-Verbot in Public-Text).

---

## [3.0.0] — 2026-04-30 — Az.-Provenance zero-tolerance

### Changed
- SKILL.md §5: Az.-Provenance-Pflicht eingefuehrt (zero-tolerance fuer halluzinierte Az.).
- `bgh-urteile.md`: Source-Pflicht — jeder Eintrag braucht Source-URL.
- 6 halluzinierte Az.-Nummern aus geshipptem Compliance-Doc entfernt + per follow-up-commit nach Primaerquellen-Verifikation korrigiert.

---

## [2.0.0] — 2026-04-29 — V3 mit DSE-Drift-Audit

### Added
- DSE-Drift-Audit-Matrix (Style 1 Auslassung + Style 2 Falschangabe) in `audit-patterns.md` Phase 4.
- 8-Phasen-HUNTER-Workflow.
- Multi-Container-Shared-Host-Risiko-Pattern.

---

## [1.0.0] — 2026-04-27 — Initial brutaler-anwalt

### Added
- Adversarial Multi-Persona-Modell: HUNTER + CHALLENGER + SYNTHESIZER.
- 4 Modi: SCAN / HUNT / SIMULATE / CONSULT.
- Reference-Files: `audit-patterns.md`, `dsgvo.md`, `it-recht.md`,
  `vertragsrecht.md`, `checklisten.md`, `branchenrecht.md`, `bgh-urteile.md`,
  `abmahn-templates.md`, `aegis-integration.md`, `international.md`,
  `strafrecht-steuer.md`.
- AEGIS-Integration (Mapping AEGIS-Findings → Anwalts-Kritikalitaet).
- RDG-Disclaimer-Pflicht im Output.
