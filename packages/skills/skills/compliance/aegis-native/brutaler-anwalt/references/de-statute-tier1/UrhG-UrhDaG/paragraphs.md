---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
source: https://www.gesetze-im-internet.de/urhg/ + https://www.gesetze-im-internet.de/urhdag/
last-checked: 2026-05-05
purpose: UrhG (Urheberrechtsgesetz) + UrhDaG (Urheberrechts-Diensteanbieter-Gesetz, in Kraft 07.06.2021) — Werks-Schutz, Verwertungsrechte, Schranken, Plattform-Filter-Pflicht (Art. 17 DSM-RL).
---

# UrhG + UrhDaG — Kern-Paragraphen

> Urheberrechtsgesetz (UrhG): https://www.gesetze-im-internet.de/urhg/
> Urheberrechts-Diensteanbieter-Gesetz (UrhDaG): https://www.gesetze-im-internet.de/urhdag/
> EU-Hintergrund: DSM-Richtlinie (RL 2019/790) Art. 17 — UrhDaG-Umsetzung.

## Teil 1 — UrhG (Stamm-Gesetz)

### § 1 — Allgemeines

**Wortlaut (Kern)**: Werke der Literatur, Wissenschaft + Kunst genießen Schutz nach UrhG.

### § 2 — Geschützte Werke

**Wortlaut (Kern, Abs. 1)**: Geschützt sind insb.:
- Sprachwerke (Bücher, Code, Skripte, Reden),
- Werke der Musik,
- pantomimische Werke + Werke der Tanzkunst,
- Werke der bildenden Kunst, Architektur,
- Lichtbildwerke + Filmwerke,
- Darstellungen wissenschaftlicher / technischer Art (Karten, Pläne, Zeichnungen),
- **Computerprogramme** (§ 69a UrhG separat).

**§ 2 Abs. 2**: Werke = persönliche geistige Schöpfungen mit Schöpfungshöhe (Originalität).

**Audit-Relevanz**: Code, UI-Designs, Texte auf Site, Logos, Stock-Images sind UrhG-geschützt. Pflicht zur Lizenz-Klärung für jedes Asset.

---

### §§ 16–23 — Verwertungsrechte

**Wortlaut (Kern)**:
- **§ 15** — Bündel-Norm: Vervielfältigung, Verbreitung, öffentliche Wiedergabe.
- **§ 16** — Vervielfältigungsrecht.
- **§ 17** — Verbreitungsrecht.
- **§ 19a** — **Recht der öffentlichen Zugänglichmachung** (Online-Stellen) — zentrale Norm für Internet.
- **§ 23** — Bearbeitungs- + Umgestaltungsrecht.

**Audit-Relevanz**: Online-Stellen jeder Art ist § 19a-relevant — Hosting fremder Inhalte ohne Lizenz = Verstoß.

---

### § 51 — Zitatrecht

**Wortlaut (Kern)**: Zitate sind erlaubt, wenn:
- **Nr. 1**: einzelne Werke nach Erscheinen in selbständige wissenschaftliche Werke aufgenommen werden,
- **Nr. 2**: Stellen eines Werkes nach Veröffentlichung in einem selbständigen Sprachwerk angeführt werden,
- **Nr. 3**: einzelne Stellen eines erschienenen Werkes der Musik in selbständigen Werken der Musik angeführt werden.

**Voraussetzungen Zitat**: Quelle nennen + Inhalts-Auseinandersetzung + Umfang verhältnismäßig.

**Audit-Relevanz**: Blog-Posts mit Bild-/Text-Zitaten brauchen Zitatzweck + Quelle. Reine Bebilderung ist KEIN Zitat → Verstoß.

---

### §§ 60a–60h — Wissenschaft + Bildung

**Wortlaut (Kern)**: Schranken für Bildungs-/Wissenschafts-Nutzung — Lehrer kann bis 15 % eines Werkes vervielfältigen + verteilen, Forschung darf Werke vervielfältigen, Bibliotheken dürfen digitalisieren.

---

### § 87f — Leistungsschutzrecht für Presseverleger

**Wortlaut (Kern)**: Presseverlage haben für 2 Jahre exclusives Recht zur kommerziellen Online-Wiedergabe ihrer Presseveröffentlichungen — sehr kurze Snippets ausgenommen.

**Audit-Relevanz**: News-Aggregatoren / RSS-Feed-Anzeigen brauchen Lizenz (z.B. via Corint Media, VG Media).

---

### §§ 97–101 — Rechtsfolgen Verletzung

**Wortlaut (Kern)**:
- **§ 97 Abs. 1** — Beseitigungs- + Unterlassungsanspruch.
- **§ 97 Abs. 2** — Schadensersatz: berechnet nach Lizenzanalogie ODER konkret-Schaden ODER Verletzergewinn.
- **§ 97a** — Abmahnung mit Pflicht-Inhalt + Kosten-Begrenzung (§ 97a Abs. 3 — bei einfacher Verletzung Privater max. 1.000 € Gegenstandswert).
- **§ 98** — Vernichtungsanspruch.
- **§ 101** — Auskunftsanspruch (Bezugsquellen, Vertriebs-Wege).

**Audit-Relevanz**: Stock-Image-Klagen ($GettyImages-Modell) berechnen typisch € 1.000-3.000 pro unautorisierte Verwendung.

---

### §§ 106–111 — Strafvorschriften

**Wortlaut (Kern)**:
- **§ 106** — Unerlaubte Verwertung urheberrechtlich geschützter Werke: Freiheitsstrafe bis 3 Jahre / Geldstrafe.
- **§ 108b** — Unerlaubte Eingriffe in technische Schutzmaßnahmen (DRM-Umgehung).

---

## Teil 2 — UrhDaG (Plattform-Pflichten)

### Anwendungsbereich

**Wortlaut (Kern)**: UrhDaG gilt für **Diensteanbieter für das Teilen von Online-Inhalten** — d.h. Plattformen, die:
- in großem Umfang von Nutzern hochgeladene urheberrechtlich geschützte Werke speichern + öffentlich zugänglich machen,
- mit anderen Online-Inhalte-Diensten in Wettbewerb stehen,
- Hauptzweck: Speicherung + Zugänglichmachung großer Mengen Nutzer-Content,
- Inhalte nach Absicht der Plattform-Bewerbung aufbereiten.

**Ausnahmen**: KMU-Plattformen < 3 Jahre + < € 10 Mio Jahresumsatz + < 5 Mio Unique Visitors haben reduzierte Pflichten (UrhDaG § 2 Abs. 2 Satz 2).

**Audit-Relevanz**: YouTube, TikTok, Instagram-Reels, Facebook, X/Twitter, Reddit, Pinterest = Diensteanbieter. Eigene UGC-Plattformen meist auch.

---

### § 4 — Lizenzpflicht

**Wortlaut (Kern)**: Diensteanbieter ist verpflichtet, von Rechteinhabern **Nutzungsrechte zu erwerben** für die Wiedergabe + Vervielfältigung urheberrechtlich geschützter Werke. Nicht erworbene Lizenzen → § 7 ff Pflichten greifen.

---

### § 5 — Pre-Flagging „Erlaubt"

**Wortlaut (Kern)**: Nutzer können beim Upload Inhalte als „erlaubt" kennzeichnen — z.B. Eigene-Werk-Erklärung, Zitat, Karikatur. Plattform muss Pre-Flag respektieren (außer bei offensichtlich unrichtigen Erklärungen).

---

### § 8 — Sperrung / Entfernung

**Wortlaut (Kern)**: Bei Treffer einer von Rechteinhaber bekannt-gemachten Identifikator-Information (Hash, Fingerprint) muss Plattform Inhalt sperren / entfernen — außer bei mutmaßlich erlaubter Nutzung (§ 9-12).

---

### §§ 9–12 — Mutmaßlich erlaubte Nutzungen (Bagatell-Schranken)

**Wortlaut (Kern)**: Inhalte gelten als „mutmaßlich erlaubt" wenn:
- **§ 10** — Bagatell-Nutzung: Teile fremder Werke (Bilder ≤ 50 %, Filme ≤ 15 Sekunden, Audio ≤ 15 Sekunden, Text ≤ 160 Zeichen) — Plattform stellt Mindeststandard sicher,
- **§ 11** — Pre-Flag „Eigene Erklärung",
- **§ 12** — Karikatur, Parodie, Pastiche.

**Folge**: Plattform muss mutmaßlich erlaubte Nutzungen WÄHREND Rechtsbeschwerde-Prüfung sichtbar lassen.

---

### § 14 — Rechtsbeschwerde

**Wortlaut (Kern)**: Rechteinhaber kann bei Plattform Beschwerde einlegen, dass Inhalt unzulässig erlaubt-geflaggt sei. Plattform muss binnen 1 Woche entscheiden + Nutzer informieren.

---

### § 18 — Direkte Vergütung Urheber

**Wortlaut (Kern)**: Direkter Vergütungsanspruch des Urhebers (auch wenn Lizenz-Vertrag mit Verwerter / Verlag besteht) — Verwertungsgesellschaften (GEMA, VG Wort, etc.) treiben ein.

---

### § 19 — Aufsichtsbehörde

**Wortlaut (Kern)**: Bundesnetzagentur (BNetzA) ist Aufsichtsbehörde + nimmt Beschwerden entgegen.

---

### §§ 21–22 — Sanktionen

**Wortlaut (Kern)**: BNetzA kann Anordnungen erlassen + Bußgelder bis **5 % weltweiter Jahresumsatz** verhängen.

**Audit-Relevanz**: parallel zu DSA + DDG-Sanktionen. Plattform-Operatoren (auch mittlere) müssen eigenen Filter-Mechanismus oder Lizenz-Verträge nachweisen.
