---
name: legal-pages-de
category: compliance
title: Legal Pages (Impressum + Datenschutzerklärung + AGB — DE templates)
description: >
  German-legal-required pages: Impressum (§5 TMG/DDG), Datenschutzerklärung (DSGVO
  Art. 13), and optional AGB (Terms). Templates with placeholders that the wizard
  fills from company-info. Editable by admins at runtime.
version: 1
dependencies:
  npm: []
placeholders:
  - name: PROJECT_NAME
    description: The project identifier (kebab-case, from wizard). Used in file-headers and path hints.
    required: true
  - name: COMPANY_NAME
    description: Legal company name (GmbH, UG, etc.) rendered in the Impressum + footer.
    required: true
  - name: COMPANY_STREET
    description: Street address of the legal entity, required by §5 TMG/DDG for Impressum.
    required: true
  - name: COMPANY_ZIP_CITY
    description: Postal code + city of the legal entity, required by §5 TMG/DDG for Impressum.
    required: true
  - name: COMPANY_COUNTRY
    description: Country of the legal entity, typically Deutschland for DE-facing pages.
    default: Deutschland
  - name: COMPANY_EMAIL
    description: Contact email (required by §5 TMG/DDG)
    required: true
  - name: COMPANY_PHONE
    description: Contact phone (strongly-recommended by §5 TMG/DDG)
    required: false
  - name: COMPANY_VAT_ID
    description: USt-IdNr. (required for B2B)
    required: false
  - name: COMPANY_HRB
    description: Handelsregister (HRB XXXXX, Amtsgericht YYY)
    required: false
  - name: COMPANY_CEO
    description: Vertretungsberechtigter Geschäftsführer
    required: false
  - name: DPO_NAME
    description: Data Protection Officer name (if required by §38 BDSG — typically at ≥20 employees)
    required: false
  - name: DPO_EMAIL
    description: Data Protection Officer contact email (if required by §38 BDSG — typically at ≥20 employees).
    required: false
  - name: APP_URL
    description: Production URL of the app (e.g. https://mysaas.de)
    required: true
  - name: CANCELLATION_DAYS
    description: Kündigungsfrist in Tagen zum Monatsende (Standard-B2C-AGB default is 30).
    default: 30
brief_section: Compliance
estimated_files: 3
tags: [legal, dsgvo, impressum, datenschutz, agb, de]
related:
  - compliance/dsgvo-kit
  - foundation/multi-tenant-supabase
---

# Legal Pages (DE)

Every German / EU-facing website must provide Impressum and Datenschutzerklärung. Failure = §5 TMG/DDG-Abmahnung risk. This pattern ships legally-compliant templates with placeholders — the wizard fills them from company-info.

**Important:** These templates are drafting-assistance. For high-stakes deployment, **have a lawyer review before going live**. Templates follow current DE case-law as of 2026-04 but laws change.

---

## Commands to run

No new dependencies.

---

## Files to create

### `src/app/impressum/page.tsx`

```typescript
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Impressum',
  description: 'Anbieterkennzeichnung nach §5 TMG/DDG.',
};

export default function ImpressumPage() {
  return (
    <article className="prose prose-zinc dark:prose-invert max-w-3xl mx-auto py-12 px-4">
      <h1>Impressum</h1>

      <h2>Angaben gemäß §5 DDG (Digitale-Dienste-Gesetz)</h2>
      <p>
        {{COMPANY_NAME}}<br />
        {{COMPANY_STREET}}<br />
        {{COMPANY_ZIP_CITY}}<br />
        {{COMPANY_COUNTRY}}
      </p>

      {/* Delete this block if your entity has no named Geschäftsführer / Vertretungsberechtigter. */}
      <h3>Vertreten durch</h3>
      <p>{{COMPANY_CEO}}</p>

      <h2>Kontakt</h2>
      <p>
        E-Mail: <a href="mailto:{{COMPANY_EMAIL}}">{{COMPANY_EMAIL}}</a><br />
        {/* Delete the Telefon line if your entity has no published phone contact. */}
        Telefon: {{COMPANY_PHONE}}<br />
      </p>

      {/* Delete the Registereintrag block if the entity is not HR-registered (Einzelunternehmen, GbR). */}
      <h2>Registereintrag</h2>
      <p>{{COMPANY_HRB}}</p>

      {/* Delete the Umsatzsteuer-ID block if §19 UStG Kleinunternehmer applies. */}
      <h2>Umsatzsteuer-ID</h2>
      <p>Umsatzsteuer-Identifikationsnummer nach §27a UStG: {{COMPANY_VAT_ID}}</p>

      <h2>Verantwortlich für den Inhalt nach §18 Abs. 2 MStV</h2>
      <p>
        {{COMPANY_NAME}}<br />
        {{COMPANY_STREET}}<br />
        {{COMPANY_ZIP_CITY}}
      </p>

      <h2>Streitschlichtung</h2>
      <p>
        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
        <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noreferrer">
          https://ec.europa.eu/consumers/odr/
        </a>.
        Unsere E-Mail-Adresse finden Sie oben im Impressum.
      </p>
      <p>
        Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>

      <h2>Haftung für Inhalte</h2>
      <p>
        Als Diensteanbieter sind wir gemäß §7 Abs.1 DDG für eigene Inhalte auf diesen Seiten nach den
        allgemeinen Gesetzen verantwortlich. Nach §§8 bis 10 DDG sind wir als Diensteanbieter jedoch
        nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder
        nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
      </p>
      <p>
        Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den
        allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst
        ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden
        von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
      </p>

      <h2>Haftung für Links</h2>
      <p>
        Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen
        Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen.
        Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der
        Seiten verantwortlich.
      </p>

      <h2>Urheberrecht</h2>
      <p>
        Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen
        dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
        Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung
        des jeweiligen Autors bzw. Erstellers.
      </p>
    </article>
  );
}
```

### `src/app/datenschutz/page.tsx`

```typescript
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung',
  description: 'Informationen zur Verarbeitung personenbezogener Daten nach DSGVO.',
};

export default function DatenschutzPage() {
  return (
    <article className="prose prose-zinc dark:prose-invert max-w-3xl mx-auto py-12 px-4">
      <h1>Datenschutzerklärung</h1>
      <p>Stand: {new Date().toLocaleDateString('de-DE')}</p>

      <h2>1. Verantwortlicher</h2>
      <p>
        Verantwortlich für die Verarbeitung personenbezogener Daten im Sinne der DSGVO ist:
      </p>
      <p>
        {{COMPANY_NAME}}<br />
        {{COMPANY_STREET}}<br />
        {{COMPANY_ZIP_CITY}}<br />
        E-Mail: <a href="mailto:{{COMPANY_EMAIL}}">{{COMPANY_EMAIL}}</a>
      </p>

      {/* Delete this block if your organization has no designated Datenschutzbeauftragter — §38 BDSG requires one only from ~20 employees processing regularly, smaller orgs can skip. */}
      <h2>2. Datenschutzbeauftragter</h2>
      <p>
        {{DPO_NAME}}<br />
        E-Mail: <a href="mailto:{{DPO_EMAIL}}">{{DPO_EMAIL}}</a>
      </p>

      <h2>3. Ihre Rechte</h2>
      <p>Sie haben jederzeit das Recht auf:</p>
      <ul>
        <li>Auskunft über Ihre bei uns gespeicherten Daten (Art. 15 DSGVO)</li>
        <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
        <li>Löschung Ihrer Daten (Art. 17 DSGVO)</li>
        <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
        <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
        <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
        <li>Widerruf erteilter Einwilligungen (Art. 7 Abs. 3 DSGVO)</li>
        <li>Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO)</li>
      </ul>
      <p>
        Zur Ausübung Ihrer Rechte kontaktieren Sie uns per E-Mail oder nutzen Sie die{' '}
        <Link href="/admin/mein-bereich/datenschutz">Daten-Selbstverwaltung</Link> in Ihrem Konto.
      </p>

      <h2>4. Erhobene Daten</h2>
      <h3>4.1 Automatisch erhobene Daten</h3>
      <p>
        Bei jedem Aufruf unserer Webseite erfasst unser System automatisiert Daten und Informationen
        vom Computersystem des aufrufenden Rechners. Folgende Daten werden hierbei erhoben:
      </p>
      <ul>
        <li>Informationen über den Browsertyp und die verwendete Version</li>
        <li>Das Betriebssystem des Nutzers</li>
        <li>Die IP-Adresse des Nutzers (gekürzt, nicht personalisiert)</li>
        <li>Datum und Uhrzeit des Zugriffs</li>
      </ul>
      <p>
        Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an fehlerfreier
        Darstellung und Sicherheit).
      </p>

      <h3>4.2 Registrierung</h3>
      <p>
        Für die Nutzung unserer Dienste ist eine Registrierung erforderlich. Dabei erfassen wir:
        E-Mail-Adresse und Passwort (Passwort-Hash). Optional: Vor- und Nachname, Avatar-Bild.
      </p>
      <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).</p>

      <h3>4.3 Cookies</h3>
      <p>
        Wir nutzen Cookies zur Session-Verwaltung und — nach Ihrer Einwilligung — zu Analytics- und
        Marketing-Zwecken. Sie können Ihre Einwilligung jederzeit über den Cookie-Banner anpassen.
      </p>

      <h2>5. Hosting &amp; Unterauftragsverarbeiter</h2>
      <p>
        Wir nutzen folgende Dienstleister (Art. 28 DSGVO AVV abgeschlossen):
      </p>
      <ul>
        <li><strong>Supabase</strong> (Datenbank, Auth, Storage) — Anbieter: Supabase Inc., USA/EU-Region. Datenverarbeitung in EU. AVV abgeschlossen.</li>
        <li>{/* Hosting-Provider your deployment-target uses — placeholder */}</li>
      </ul>

      <h2>6. Speicherdauer</h2>
      <p>
        Ihre Daten werden gespeichert, solange Ihr Konto aktiv ist. Nach Löschung des Kontos werden
        alle personenbezogenen Daten innerhalb von 30 Tagen unwiderruflich gelöscht, soweit keine
        gesetzlichen Aufbewahrungspflichten entgegenstehen.
      </p>
      <p>
        Log-Dateien werden nach 14 Tagen automatisch gelöscht. Audit-Log-Einträge 12 Monate.
      </p>

      <h2>7. Datenübermittlung in Drittländer</h2>
      <p>
        Ihre Daten werden innerhalb der EU/EWR verarbeitet. Eine Übermittlung in Drittländer findet
        nicht statt, es sei denn, dies ist für die Vertragserfüllung erforderlich (Art. 49 Abs. 1
        lit. b DSGVO).
      </p>

      <h2>8. Ihr Recht auf Beschwerde</h2>
      <p>
        Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über unsere Verarbeitung
        personenbezogener Daten zu beschweren. Zuständig ist:
      </p>
      <p>
        Die Datenschutzaufsichtsbehörde Ihres Bundeslandes bzw. des Landes, in dem Sie wohnen,
        arbeiten oder in dem die mutmaßliche Verletzung erfolgt ist.
      </p>

      <h2>9. Kontakt zum Verantwortlichen</h2>
      <p>
        Bei Fragen zum Datenschutz oder zur Ausübung Ihrer Rechte wenden Sie sich bitte an:{' '}
        <a href="mailto:{{COMPANY_EMAIL}}">{{COMPANY_EMAIL}}</a>
      </p>
    </article>
  );
}
```

### `src/app/agb/page.tsx` (optional — only if B2B or paid-services)

```typescript
import { Metadata } from 'next';

export const metadata: Metadata = { title: 'AGB' };

export default function AGBPage() {
  return (
    <article className="prose prose-zinc dark:prose-invert max-w-3xl mx-auto py-12 px-4">
      <h1>Allgemeine Geschäftsbedingungen</h1>
      <p><em>Stand: {new Date().toLocaleDateString('de-DE')}</em></p>

      <h2>§1 Geltungsbereich</h2>
      <p>
        Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge, die zwischen dem
        Anbieter ({{COMPANY_NAME}}) und dem Nutzer über die Nutzung der Dienste auf{' '}
        <strong>{{APP_URL}}</strong> geschlossen werden.
      </p>

      <h2>§2 Vertragsgegenstand</h2>
      <p>
        Der Anbieter stellt dem Nutzer Software-as-a-Service (SaaS) zur Verfügung. Die genauen
        Leistungen ergeben sich aus der jeweils gewählten Leistungsbeschreibung/Produktseite.
      </p>

      <h2>§3 Vertragsabschluss</h2>
      <p>
        Durch die Registrierung auf unserer Plattform und das Akzeptieren dieser AGB kommt ein
        Nutzungsvertrag zwischen dem Anbieter und dem Nutzer zustande.
      </p>

      <h2>§4 Leistungspflichten</h2>
      <p>
        Der Anbieter stellt die Plattform in der im Leistungsumfang beschriebenen Weise bereit und
        bemüht sich um eine möglichst unterbrechungsfreie Nutzung. Eine Verfügbarkeit von 100% kann
        nicht garantiert werden.
      </p>

      <h2>§5 Pflichten des Nutzers</h2>
      <p>
        Der Nutzer verpflichtet sich, die Plattform nur für rechtmäßige Zwecke zu nutzen, seine
        Zugangsdaten geheim zu halten und keine Rechte Dritter zu verletzen.
      </p>

      <h2>§6 Vergütung</h2>
      <p>
        Kostenpflichtige Leistungen sind im entsprechenden Angebot ausdrücklich gekennzeichnet.
        Preise verstehen sich zzgl. gesetzlicher Mehrwertsteuer.
      </p>

      <h2>§7 Kündigung</h2>
      <p>
        Der Vertrag kann von beiden Parteien jederzeit mit einer Frist von {{CANCELLATION_DAYS}} Tagen zum Monatsende
        gekündigt werden. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt
        unberührt.
      </p>

      <h2>§8 Haftung</h2>
      <p>
        Der Anbieter haftet für Vorsatz und grobe Fahrlässigkeit. Für leichte Fahrlässigkeit haftet
        er nur bei Verletzung einer wesentlichen Vertragspflicht (Kardinalpflicht). In diesem Fall
        ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden beschränkt.
      </p>

      <h2>§9 Änderungen der AGB</h2>
      <p>
        Der Anbieter behält sich vor, diese AGB bei sachlichem Bedarf zu ändern. Änderungen werden
        dem Nutzer mindestens vier Wochen vor Wirksamwerden in Textform mitgeteilt. Widerspricht der
        Nutzer nicht binnen sechs Wochen nach Zugang der Mitteilung, gelten die Änderungen als
        angenommen.
      </p>

      <h2>§10 Schlussbestimmungen</h2>
      <p>
        Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Gerichtsstand für alle
        Streitigkeiten aus diesem Vertrag ist — soweit zulässig — der Sitz des Anbieters. Sollten
        einzelne Bestimmungen dieser AGB unwirksam sein, berührt dies die Wirksamkeit der übrigen
        Bestimmungen nicht.
      </p>
    </article>
  );
}
```

---

## Usage: admin-editable runtime overrides

If admins should edit these pages at runtime (without re-deploy):

1. Create table `legal_pages (id, slug, content_markdown, updated_at)`
2. Seed with the templates above
3. Render the page-body from DB-content via MDX/`react-markdown`
4. Expose `/admin/rechtliches` editor to admins (requireRole admin)

See `/admin/rechtliches` in related-preset if included.

---

## Common pitfalls

1. **Missing Impressum.** §5 TMG/DDG-violation → Abmahnung (~€500-2000 typical).
2. **Impressum buried in footer.** Must be "leicht erkennbar" — link in every-page footer.
3. **Datenschutz not matching reality.** E.g., listing Google Analytics but actually using PostHog — that's a false-statement. Match the Datenschutz to what you actually do.
4. **No mention of Supabase as processor.** If data leaves your direct control (which Supabase does — it's a hosted DB), list the processor + their AVV.
5. **Missing contact-email in Impressum.** Required by §5 TMG/DDG — just a street-address is not enough.
6. **Template-placeholders not substituted.** Ship-check: `grep -r "{{" src/app/impressum src/app/datenschutz` should return zero matches post-generation.
7. **Using "Haftungsausschluss für externe Links" — outdated.** Case-law updated; the standard §7 DDG disclaimer above is current.

---

## Related patterns

- `compliance/dsgvo-kit` — the cookie-banner links to `/datenschutz`; data-export + deletion referenced here
- `foundation/multi-tenant-supabase` — multi-tenant legal-pages per tenant-slug if needed (advanced)
- `foundation/i18n-next-intl` — for EN-versions of these pages if needed

---

## Quality-gate

```bash
# No unsubstituted placeholders
grep -rn "{{" src/app/impressum src/app/datenschutz src/app/agb
# expect: zero matches

# Build + type-check
npm run build
npx tsc --noEmit

# Playwright E2E: pages render + contain required sections
npm run test:e2e -- legal
# e.g. assert /impressum contains "Angaben gemäß §5 DDG"
```

### Impressum field-completeness gate (TMG §5 / DDG)

The pattern's `{{placeholder}}` substitution can complete with empty values when the wizard's `compliance.company_address` block is partially populated. The Impressum then renders without raising any visible error but represents real Abmahnung risk (€500-2000) — and AEGIS-scan flags it as `GDPR-018 missing Anschrift`. The C5 schema-refine added in v0.17.1 catches this at config-parse-time (defense-in-depth); the runtime gate below catches it at scaffold-build-time.

Copy this script to `scripts/check-impressum-completeness.sh` in your generated SaaS and call it from Phase 5 + post-deploy CI. It is bash-3-compatible (works on stock macOS bash 3.2.57+).

```bash
#!/usr/bin/env bash
# Check TMG §5 / DDG field-completeness in rendered Impressum page.
# Pass: >=5 of the required field-class markers present.
# Fail: <5 markers. Lists which classes are missing.
set -euo pipefail

IMPRESSUM_PATH="${1:-src/app/[locale]/impressum/page.tsx}"
[[ -f "$IMPRESSUM_PATH" ]] || { echo "::error::Impressum not found at $IMPRESSUM_PATH"; exit 1; }

CLASS_NAMES=(
  "1-Anschrift"
  "2-PLZ-Ort"
  "3-Kontakt-Email"
  "4-Vertretung"
  "5-Handelsregister"
  "6-USt-IdNr"
  "7-Telefon"
)
CLASS_PATTERNS=(
  'straße|strasse|str\.|anschrift'
  '[0-9]{5}'
  'mailto:|e-mail:|kontakt:|email:'
  'geschäftsführer|geschaeftsfuehrer|gf:|vertreten durch|inhaber'
  'handelsregister|hrb|hra|amtsgericht'
  'ust-idnr|umsatzsteuer-id|vat-id|de[0-9]{9}'
  'telefon:|tel\.:|\+49'
)

FOUND=""; MISSING=""; COUNT=0
for i in "${!CLASS_NAMES[@]}"; do
  if grep -qiE "${CLASS_PATTERNS[$i]}" "$IMPRESSUM_PATH"; then
    FOUND="$FOUND ${CLASS_NAMES[$i]}"; COUNT=$((COUNT + 1))
  else
    MISSING="$MISSING ${CLASS_NAMES[$i]}"
  fi
done

echo "TMG §5 field-class markers found: $COUNT/7"
echo "  Found:  ${FOUND:-none}"
echo "  Missing:${MISSING:-none}"

[[ $COUNT -ge 5 ]] || { echo "::error::Impressum incomplete — only $COUNT/7 (need >=5). Missing:$MISSING. Abmahnung-risk €500-2000."; exit 1; }
echo "Impressum gate PASS: $COUNT/7 field-classes present (threshold >=5)."
```

**Threshold rationale:** >=5 of 7 classes covers the GmbH/UG case (Anschrift + PLZ + E-Mail + Vertretungsberechtigter + Handelsregister) without false-positiving against legitimate sole-proprietor Impressum (which often lack Handelsregister + USt-IdNr but still have the first four). The dogfood-run's empty-field Impressum scored 0-2/7 — well below the threshold — so the gate catches it; a proper sole-proprietor at 4/7 still needs to add a contact-email or representative line, which it should anyway.

---

**Pattern version: 1 · Last-updated: 2026-04-22 · AEGIS-compliance**

> **Important notice:** These templates reflect DE legal requirements as of April 2026. Laws evolve. For production deployment, consult a lawyer familiar with German/EU internet law before going live. AEGIS assumes no liability for legal-compliance of specific deployments.
