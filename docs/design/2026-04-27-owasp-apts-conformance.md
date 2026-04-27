# OWASP-APTS Conformance Programme — 2026-04-27

Erweiterung des AEGIS-Stacks um eine **publizierte OWASP-APTS-Konformitäts-Posture**. Erste OSS-Pentest-Plattform mit auditierbarer APTS-Mapping. Ersetzt die marketing-impossible "99,9% safe"-Aussage durch eine echte, prüfbare Standards-Konformitäts-Geschichte.

## Quelle

- **Standard:** OWASP/APTS v0.1.0 (Incubator) — https://github.com/OWASP/APTS
- **Lizenz:** CC BY-SA 4.0 (Dokumentationsnachnutzung erlaubt mit Attribution + Share-Alike)
- **Umfang:** 173 tier-required Requirements + 13 advisory practices, 8 Domänen (SE/SC/HO/AL/AR/MR/TP/RP), 3 Tiers
  - Tier 1 (Foundation/Baseline): 72 Requirements
  - Tier 2 (Enhanced): 85 Requirements
  - Tier 3 (Advanced): 16 Requirements
- **Klassifikation:** 144 MUST, 29 SHOULD
- **Maschinenlesbar:** `apts_requirements.json` + `apts_requirements_schema.json` als kanonische Quelle

## Entscheidungs-Zusammenfassung

| Frage | Entscheidung | Begründung |
|---|---|---|
| **Posture (Q1)** | Staged 1→2→3 (Variante C) | Frontloads Ehrlichkeit (Gap-Statement) + Marketing-Tier-Up-Events als Release-Anker |
| **Platform-Scope (Q2)** | β — autonomous-layer | `aegis siege` + Strix/PTAI/Pentest-Swarm-AI Wrapper + CLI-Orchestrierung. Skills-Methodologie, deterministische SAST-Scanner und Wizard sind explizit **out-of-scope**, weil nicht autonom |
| **Conformance-Claim-Gate** | APTS verlangt **100% MET** auf claimed tier — kein Teilkredit | Phase 1 ist daher ein **Tier-1 Readiness/Gap-Assessment** (transparente Lücken-Offenlegung), **nicht** ein Tier-1-Conformance-Claim |
| **Foundation Model (APTS-TP-021)** | BYOM-Disclosure (Bring Your Own Model) | AEGIS pinnt kein Model — Operator wählt; Disclosure-Schema dokumentiert die unterstützten Modelle + Capability-Baseline pro Adapter |

## Boundary-Statement (in jede publizierte Claim-Datei)

> *"Die APTS-Konformitäts-Posture in diesem Dokument adressiert den **AEGIS Autonomous Pentest Layer**: `aegis siege` (4-Phasen-Live-Attack-Simulation) plus die integrierten LLM-Pentest-Wrapper (Strix, PTAI, Pentest-Swarm-AI) plus die CLI-Orchestrierung dieser Komponenten. Die deterministischen SAST-/DAST-Scanner (`aegis scan` / `aegis audit`), das `@aegis-scan/skills` Methodologie-Paket und der `@aegis-wizard/cli` Scaffold-Generator sind **supporting components** und explizit **nicht Teil dieser Claim**, weil sie nicht autonom im APTS-Sinne operieren."*

## Phase 1 — Tier-1 Readiness/Gap-Assessment

### 1.1 Deliverables (alle in `docs/compliance/owasp-apts/`)

| Datei | Inhalt | Vorlage |
|---|---|---|
| `README.md` | Entry-Point. Was ist APTS, was ist hier, wie liest man es | own |
| `CONFORMANCE-CLAIM.md` | Vollständig befüllter APTS-Conformance-Claim-Template, **explizit als Tier-1 Readiness Assessment markiert (NICHT als Conformance Claim)**, mit allen 72 Tier-1-Requirements gemappt | OWASP/APTS Conformance_Claim_Template |
| `conformance.json` | Maschinenlesbare Form per APTS Conformance_Claim_Schema. Status-Werte: `met` / `partially_met` / `not_met` / `not_applicable` / `planned`. Keine Tier-2/3 Reqs in dieser Datei | OWASP/APTS Conformance_Claim_Schema |
| `EVIDENCE-MANIFEST.md` | Pro `met`-Requirement: Pfad zu Code/Test/Doc, das die Erfüllung belegt. Pro `partially_met`/`not_met`: was fehlt und Phase-2-Plan | OWASP/APTS Evidence_Package_Manifest |
| `FOUNDATION-MODEL-DISCLOSURE.md` | Per APTS-TP-021 Pflicht. AEGIS-spezifisch: BYOM-Mapping. Welcher Wrapper unterstützt welche Modelle, was sind die Capability-Baselines | own (extends APTS template) |
| `gap-summary.md` | TL;DR-Tabelle: pro Domäne X von Y Tier-1 MET, was die Top-3-Lücken sind, ETA für Phase 2 | own |
| `attribution.md` | CC BY-SA 4.0 Attribution für alle aus OWASP/APTS-Templates abgeleiteten Strukturen | required by license |

### 1.2 Außerhalb von `docs/compliance/owasp-apts/`

- `README.md` (top-level): neuer Abschnitt **"OWASP-APTS Conformance Posture"** mit 3-Zeilen-Summary + Link auf `docs/compliance/owasp-apts/`
- `CHANGELOG.md`: Eintrag unter **Unreleased** dokumentiert Phase-1-Ship
- `<corpus-precision-cache>/v018-apts-phase1-handover.md`: in-flight + post-ship-handover für die nächste Session (local, gitignored)

### 1.3 Kein Code-Change in dieser Phase

Phase 1 ist **doc-only**. Keine Änderung an `packages/cli/`, `packages/scanners/`, `packages/skills/` oder `ci/`. Die Claim ist eine Bestandsaufnahme dessen, was AEGIS heute schon ist — keine Implementierung.

### 1.4 Was ein "MET" konkret bedeutet (Beweisführung)

Damit wir bei Phase 1 ehrlich sind, gilt für jeden mit `met` markierten Requirement:

1. **Konkrete Code-/Doc-/CI-Referenz** vorhanden im EVIDENCE-MANIFEST (Pfad + Zeilennummer wo sinnvoll)
2. **Reproduzierbar** — Reviewer könnte den Beweis selbst inspizieren
3. **Aktuell** — Referenz zeigt auf den HEAD-Commit zum Zeitpunkt der Claim-Veröffentlichung

Keine Spekulation, kein "wir-meinen-das-passt-irgendwie". Wenn unsicher → `partially_met` mit Erklärung.

## Phase 2 — Tier-1 Full Conformance Claim

**Trigger:** Alle 72 Tier-1 Reqs sind `met` (keine `partially_met`/`not_met` mehr).

**Vorgehen:**
1. Liste der `partially_met`/`not_met` aus Phase 1 ist die Phase-2-Roadmap.
2. Pro Lücke: Code-Change, Doc-Hinzufügung oder Architektur-Erweiterung.
3. Updaten EVIDENCE-MANIFEST + conformance.json + CONFORMANCE-CLAIM.md.
4. Konversion: Dokument-Header von **"Tier-1 Readiness Assessment"** → **"Tier-1 Conformance Claim"**.
5. Ship als Release-Event mit eigenem CHANGELOG-Eintrag.

**Schätzung:** 4-12 Wochen, abhängig von Lücken-Severity. Kann iterativ mit Tier-1-MET-Counter wachsen (z.B. 60/72 → 70/72 → 72/72).

## Phase 3 — Tier-2 Climb

**Trigger:** Phase 2 abgeschlossen.

**Vorgehen:** Analog Phase 1+2 für die 85 Tier-2 Requirements.

**Marketing-Claim nach Phase 3:** *"AEGIS publishes OWASP-APTS Tier-2 Full Conformance Claim — second OSS pentest platform with public Tier-2 attestation."* (oder erstes — je nach Markt-Lage zum Zeitpunkt).

**Zeitrahmen:** 2-4 Monate nach Phase 2.

## Architektur — Datei-Layout

```
docs/
└── compliance/
    └── owasp-apts/
        ├── README.md                           # Entry point
        ├── CONFORMANCE-CLAIM.md                # Filled template (Phase 1: Readiness Assessment)
        ├── conformance.json                    # Machine-readable per APTS schema
        ├── EVIDENCE-MANIFEST.md                # Per-req evidence trail
        ├── FOUNDATION-MODEL-DISCLOSURE.md      # APTS-TP-021 (BYOM)
        ├── gap-summary.md                      # TL;DR table
        └── attribution.md                      # CC BY-SA 4.0 attribution
```

Keine Änderung am bestehenden `docs/`-Layout. Neuer Subtree unter `docs/compliance/`.

### CI-Gate (optional Phase 1, required Phase 2)

`ci/check-apts-claim.sh` (zukünftig) — validiert:
- `conformance.json` parst gegen das APTS-Schema
- Alle Tier-1-IDs in der Claim sind die echten 72 IDs (keine Tippfehler)
- EVIDENCE-MANIFEST referenziert für jeden `met`-Eintrag mindestens 1 Beweis
- Foundation-Model-Disclosure ist nicht leer

Phase 1 ships **ohne** diesen Gate (manuelle Self-Review). Phase 2 fügt den Gate hinzu, weil dann der "Conformance Claim" wirklich claim ist.

## AEGIS-spezifische Mapping-Punkte (Vorschau, IDs gegen `apts_requirements.json` v0.1.0 verifiziert)

Damit das Phase-1-Mapping kein One-Hour-Brute-Force wird, hier eine vorab kuratierte Liste — alle IDs sind mit dem kanonischen Tier-1-Set verglichen.

**`met`-Kandidaten** (AEGIS ist heute schon stark):

| APTS-ID | Domäne | Title | AEGIS-Beweisstelle |
|---|---|---|---|
| APTS-SE-002 | SE | IP Range Validation and RFC 1918 Awareness | `packages/scanners/src/ssrf-checker.ts` (private-IP-block + RFC 1918) |
| APTS-SE-009 | SE | Hard Deny Lists and Critical Asset Protection | `aegis.config.json` `excludePaths` + per-target opt-out |
| APTS-AR-001 | AR | Structured Event Logging with Schema Validation | JSON output + SARIF 2.1.0 reporter (`packages/reporters/src/sarif.ts`) |
| APTS-AR-002 | AR | State Transition Logging | scan-progress event-emitter im CLI-Orchestrator |
| APTS-AR-004 | AR | Decision Point Logging and Confidence Scoring | per-finding `confidence`-Feld (`high`/`medium`/`low`) eingebaut |
| APTS-AR-006 | AR | Decision Chain of Reasoning and Alternative Evaluation | finding `relatedLocations` + `evidence` für Taint-Chain |
| APTS-MR-019 | MR | Discovered Credential Protection | `next-public-leak`, `entropy-scanner`, `crypto-auditor`, `jwt-detector` |
| APTS-RP-006 | RP | False Positive Rate Disclosure | per-CWE confidence rules + `[LOW-CONFIDENCE]`-PR-Badge bei fehlenden Wrappern |
| APTS-RP-008 | RP | Vulnerability Coverage Disclosure | Scanner-Inventory im README + `getAllScanners()` public registry |
| APTS-TP-001 | TP | Third-Party Provider Selection and Vetting | wrapper `isAvailable()` + Double-Gating (binary + API-key) |
| APTS-TP-006 | TP | Dependency Inventory, Risk Assessment, and Supply Chain Verification | `supply-chain` scanner + `dep-confusion-checker` + lockfile integrity |
| APTS-TP-021 | TP | Foundation Model Disclosure and Capability Baseline | neue `FOUNDATION-MODEL-DISCLOSURE.md` (BYOM) — Phase-1-Deliverable |

**`partially_met`-Kandidaten** (Lücken erwartet):

- **APTS-HO-001** (Mandatory Pre-Approval Gates for Autonomy Levels L1 and L2) — `aegis siege --confirm` ist eine Pre-Approval-Geste, aber keine vollständige L1/L2-Matrix
- **APTS-AL-001..006** (Single Technique Execution + L1-Reqs) — Wrapper laufen autonom innerhalb ihrer eigenen L1-L4-Scopes; AEGIS-Orchestrator-Layer hat keine explizite L1/L2-Klassifizierung pro Scanner-Modus
- **APTS-SC-009** (Kill Switch) — `Ctrl+C` funktioniert, aber kein dokumentierter Multi-Path-Kill-Switch
- **APTS-AR-006** (Decision Chain of Reasoning) — Taint-Tracker emittiert source→sink chain für SAST, siege-Mode emittiert noch keine Reasoning-Chain-JSON für autonome Decisions

**`not_met`-Kandidaten** (echte Lücken):

- **APTS-AR-010** (Cryptographic Hashing of All Evidence) — Findings/Evidence nicht hash-chained
- **APTS-AR-012** (Tamper-Evident Logging with Hash Chains) — Logs sind append-only-Dateien ohne Hash-Chain
- **APTS-AR-015** (Evidence Classification and Sensitive Data Handling) — keine formelle Sensitivity-Klassifikation auf Evidence
- **APTS-MR-004** (Configuration File Integrity Verification) — `aegis.config.json` wird gelesen, aber zur Laufzeit nicht integrity-verified
- **APTS-MR-018** (AI Model Input/Output Architectural Boundary) — Wrapper-Layer LLM-I/O nicht über das hinaus sandboxed, was der jeweilige Wrapper intern tut
- **APTS-HO-008** (Immediate Kill Switch with State Dump) — Ctrl+C killt, aber kein formaler State-Dump

Diese Pre-Kuration ist **nur Vorschau**. Das echte Mapping in Phase-1-Execution klappert alle 72 Tier-1 Reqs systematisch ab.

## Foundation Model Disclosure — AEGIS-Spezifik

APTS-TP-021 verlangt für JEDE Tier-Claim die Disclosure des Foundation-Models. AEGIS ist hier strukturell anders als typische Vendor-Plattformen, weil **AEGIS kein Model pinnt** — der Operator wählt.

`FOUNDATION-MODEL-DISCLOSURE.md` dokumentiert daher:

- **Per Wrapper:** welche Modelle der jeweilige Wrapper unterstützt (Strix: GPT/Claude/Google via LiteLLM; PTAI: Anthropic/OpenAI/Ollama; Pentest-Swarm-AI: Anthropic Claude default + LiteLLM)
- **Per Modus:** welche Modelle in `siege`-Mode aktiv sind, welche in `fix`-Mode (Claude/OpenAI/Ollama/templates)
- **Capability-Baseline:** Link zu Provider-Cards (Anthropic, OpenAI) + AEGIS-eigenes "geprüft mit"-Statement pro Major-Release
- **Re-Attestation-Cadence:** je Major-Release oder bei Modell-Family-Wechsel des Operators

## Out-of-Scope für Phase 1 (geparkt)

| Item | Status | Wann freischalten |
|---|---|---|
| **WP-B (deep-eye recon-wrapper)** | nach Phase 1 ship | parallel zu Phase 2, da unabhängig |
| **WP-C (Decepticon integration)** | gated by Phase 1 (APTS-Lens) | nach Phase 1 — APTS-TP gibt das Vetting-Framework |
| **WP-D (openai/evals)** | parked, intent unklar | nach explizitem User-Klärungsfrage |
| **WP-E (Live-Tests gegen 3 live-targets, RoE-pending)** | parked | nach WP-B + RoE-Klärung pro Target |
| Skills-Tree Population (`defensive/`, `mitre-mapped/`, `ops/`) | parallel zu Phase 1 möglich (markdown-only) | sofort startbar — separates WP-A2 |

Vor jedem Live-Test gegen einen noch nicht definierten Target ist erforderlich: (1) was ist es, (2) wer betreibt es, (3) Auth-Bestätigung, (4) RoE-Setup nach APTS-SE-001-Vorlage.

## Risiken & Halt-Conditions

| Risiko | Schweregrad | Mitigation |
|---|---|---|
| **Over-claiming bei Phase 1** | High | Dokument-Header explizit "Readiness Assessment" — NICHT "Conformance Claim". Marketing-Sprache abgeglichen mit APTS' "100% required" Wortlaut |
| **Stale Evidence bei zukünftigem Refactor** | Medium | EVIDENCE-MANIFEST ist HEAD-SHA-pinned in der Frontmatter; bei jedem Major-Release re-Audit |
| **CC BY-SA 4.0 Share-Alike-Pflicht** | Low | `attribution.md` dokumentiert Origin, abgeleitete Templates bleiben CC BY-SA-kompatibel |
| **APTS upstream rev (v0.2 etc.)** | Medium | `conformance.json.standard_version` pinnt explizit `0.1.0`; Re-Mapping-Plan dokumentiert in der Claim-Revision-History |
| **AEGIS-Boundary-Drift (Skills/Wizard schleichend in Scope)** | Medium | Boundary-Statement ist erste Section in CONFORMANCE-CLAIM.md, in jeder Doc-Datei wiederholt |

**Halt-Conditions** (eskaliere zu User wenn eintritt):

- APTS v0.2 erscheint mid-Phase-1 (re-mapping-decision needed)
- Ein "MET"-Kandidat erweist sich beim genauen Lesen des Req-Texts als gar-nicht-MET (dann `partially_met` ohne Diskussion)
- Datei-Layout-Konflikt mit existierenden `docs/`-Konventionen (würde ich nicht erwarten)

## Erfolgskriterien Phase 1

1. Alle 72 Tier-1 Reqs sind in `conformance.json` mit explizitem Status (`met`/`partially_met`/`not_met`/`not_applicable`/`planned`) abgebildet, schema-valid
2. `CONFORMANCE-CLAIM.md` ist befüllter APTS-Template, klar als "Readiness Assessment Phase 1" markiert
3. `EVIDENCE-MANIFEST.md` hat für jeden `met` mindestens 1 Code-/Doc-/CI-Pfad-Referenz
4. `FOUNDATION-MODEL-DISCLOSURE.md` deckt alle 3 Wrapper + fix-Mode ab
5. `README.md` (top-level) verlinkt unter neuem "OWASP-APTS Conformance Posture"-Header
6. Self-Review (Placeholder-Scan, Konsistenz, Scope, Ambiguität) ist clean
7. CC BY-SA 4.0 Attribution sauber dokumentiert
8. Commit ist atomar, mit klarer Message

## Marketing-Claims pro Phase (defensible language)

| Phase | Erlaubter Claim | NICHT erlaubt |
|---|---|---|
| **Phase 1** | *"AEGIS publishes its OWASP-APTS Tier-1 readiness assessment — the first OSS pentest platform with a public APTS conformance posture."* | *"AEGIS is OWASP-APTS conformant"* (false bis 100% Tier-1 MET) |
| **Phase 2** | *"AEGIS publishes its full OWASP-APTS Tier-1 Conformance Claim — every Tier-1 requirement met with traceable evidence."* | Tier-2-Claim |
| **Phase 3** | *"AEGIS publishes OWASP-APTS Tier-2 Full Conformance Claim."* | Tier-3-Claim ohne separate Phase 4 |

In keinem Fall: *"99,9% safe"* oder *"completely secure"* oder *"AEGIS guarantees..."*.

## Bezug zu existierenden Patterns

- **Honest limitations**-Abschnitt im README: APTS-Posture verstärkt das. *"Hier ist explizit was wir nicht tun"* ist genau dieselbe Linie.
- **Confidence-Levels** in Findings (`high`/`medium`/`low`): mappt auf **APTS-AR-004 Tier-1** (Decision Point Logging and Confidence Scoring).
- **`[LOW-CONFIDENCE]`-PR-Badge** bei fehlenden externen Tools: präfiguriert **APTS-RP-006 Tier-1** (False Positive Rate Disclosure).
- **Wizard's 997/A-HARDENED-Baseline-Verifikation**: präfiguriert **APTS-RP-008 Tier-1** (Vulnerability Coverage Disclosure).
- **DAST-Wrapper Mode-Gate** (`--mode pentest` only): präfiguriert **APTS-HO-001 Tier-1** (Mandatory Pre-Approval Gates for Autonomy Levels L1 and L2) — `pentest`-Mode-Opt-In ist eine Pre-Approval-Geste vor LLM-Token-burning Runs.

Phase 1 ist daher in vielen Domänen ein **Aufschreiben dessen, was AEGIS schon tut** — nicht ein Re-Engineering.

## Nächster Schritt nach Spec-Approval

1. Self-Review dieser Datei (placeholder-scan, internal consistency, scope check, ambiguity)
2. Commit (HEREDOC, mit Co-Author-Footer)
3. `superpowers:writing-plans`-Skill aufrufen für die detaillierte Implementation-Plan
4. Phase-1-Execution: WP-A1 (alle 7 Deliverables in `docs/compliance/owasp-apts/`)
5. Parallel WP-A2: Skills-Tree-Populierung (separates Tracking)
6. Nach Phase-1-Ship: WP-B (deep-eye-Wrapper) + Checkpoint für WP-C/D/E

---

**Version:** 1.0 — initial spec, 2026-04-27
**Status:** to-be-self-reviewed-then-committed
**Owner:** AEGIS maintainer team
