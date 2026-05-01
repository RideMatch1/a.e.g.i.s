---
license: MIT
purpose: Anonymized teaching snippets referenced by audit-patterns.md / dsgvo.md / checklisten.md.
---

# Templates — anonymisierte Lehrbuch-Snippets

Diese Templates sind brand-agnostische Vorlagen, die in den References als
konkrete Lehrbuch-Beispiele zitiert werden. Sie ersetzen die in fruehen
Skill-Versionen direkt eingebetteten Brand-spezifischen Snippets.

**Konvention:**
- `<placeholder>` = vom Operator zu ersetzen (z.B. `<brand>`, `<your-domain>`)
- `<...>` in Code-Snippets sind absichtlich syntactically-invalid, damit
  copy-paste-Hygiene erzwungen wird
- Alle `.example`-Files sind **keine** lauffaehigen Module — Build-Tools
  sollen sie ignorieren

## Index

| Template | Referenced from | Use case |
|----------|----------------|----------|
| `DSFA-template.md` | `dsgvo.md` DSFA-Trigger | Datenschutz-Folgenabschaetzung Doc-Vorlage |
| `VVT-template.md` | `dsgvo.md` VVT | Verzeichnis Verarbeitungstaetigkeiten Vorlage |
| `COMPLIANCE-AUDIT-TRAIL-template.md` | (Skill-Output-Pattern) | Audit-Trail-Doku-Vorlage fuer eigene Audits |
| `AffiliateDisclaimer.tsx.example` | `checklisten.md` 3c | React-Component-Vorlage UWG § 5a Abs. 4 |
| `proxy-strict-dynamic.ts.example` | `audit-patterns.md` HIGH-RISK-CSP | Next.js proxy-CSP Strict-Dynamic-Pattern |
| `data-retention-cron.ts.example` | `audit-patterns.md` Phase 4 | Bearer-auth Retention-Cleanup Route |
| `data-retention-workflow.yml.example` | `audit-patterns.md` Phase 4 | GitHub Actions Cron-Trigger |
| `UmamiScript.tsx.example` | `audit-patterns.md` env-driven Tracking | env-driven Tracking-Component |
| `security.txt.example` | `audit-patterns.md` Phase 2 | RFC 9116 (kein Placeholder-Bug) |
| `DSE-Section-UGC.md.example` | `audit-patterns.md` Phase 5c | Vermisst-/Marketplace-DSE-Block |
| `LostFoundReportForm-consent.tsx.example` | `audit-patterns.md` Phase 5c | Consent-Toggle-Pattern UGC-Posts |
