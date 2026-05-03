---
license: MIT (snippet) / Vendor-Doc separat
provider: Anthropic, PBC (USA — Delaware-PBC)
provider-AVV-status: Standardvertrag verfuegbar (DPA + EU-SCC)
last-checked: 2026-05-02
purpose: Anthropic Claude API DPA + Compliance.
---

# Anthropic Claude — TOMs + DPA + DSE-Wording

## 1. Default-Verhalten

- Datenstandort: US (default)
- EU-Region: Beta verfuegbar (Stand 2026-05, Konto-Setting in Anthropic-Console)
- Trainings-Opt-Out fuer API-Daten Pflicht-Setting (Default = Opt-Out, kein Training auf API-Daten)
- Sub-Processor: AWS, GCP

## 2. Compliance-Risiken

| Risiko | Wirkung | Fix |
|---|---|---|
| Default-Region US | Schrems II / DPF-Risiko | EU-Region waehlen wenn verfuegbar |
| Trainings-Opt-Out nicht aktiviert | Daten in Modell-Training | Opt-Out im Account-Setting (Default OK aber pruefen) |
| Prompt-Speicherung | Compliance-relevant | Zero-Retention-Vereinbarung anfragen |
| AVV ohne EU-SCC | Drittland-Pflichtverletzung | DPA mit SCC abschliessen |

## 3. Code-Pattern (Next.js + Anthropic SDK)

```ts
// File: src/lib/anthropic.ts
import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Optional: EU-Region (wenn verfuegbar)
  // baseURL: 'https://api.eu.anthropic.com',
});

export async function chat(messages: Anthropic.MessageParam[]) {
  // PII-Pre-Filter (Datenminimierung)
  const sanitized = messages.map(m => ({
    ...m,
    content: redactPII(typeof m.content === 'string' ? m.content : ''),
  }));

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    messages: sanitized,
  });

  return response;
}

function redactPII(text: string): string {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .replace(/\b(?:\+49|0)[0-9 \-/]+\d/g, '[REDACTED_PHONE]')
    .replace(/\bDE\d{20}\b/gi, '[REDACTED_IBAN]');
}
```

## 4. AVV / DPA

- **DPA-Link**: https://www.anthropic.com/legal/dpa
- **Trust Center**: https://trust.anthropic.com/
- **EU-SCC**: Modul 2 + 3
- **Sub-Processors**: https://trust.anthropic.com/sub-processors

## 5. DSE-Wording-Vorlage

> Wir nutzen Claude (Anthropic, PBC, 548 Market St PMB 90375, San Francisco, USA)
> als Auftragsverarbeiter im Sinne von Art. 28 DSGVO. Anthropic ist DPF-zertifiziert.
> EU-SCC Modul 2+3 abgeschlossen. Trainings-Opt-Out ist aktiviert. Datenschutzhinweise:
> https://www.anthropic.com/legal/privacy.

## 6. AI-Act-Compliance

- Claude ist GPAI-Modell — Anbieter-Pflichten Art. 53 ist Anthropic-Pflicht
- Operator-seitig: Pflicht zum Art. 50-Hinweis im Chat-UI
- Bei Hochrisiko-Use-Case: vollstaendige Annex-III-Pflichten + FRIA

## 7. Cross-Reference

- AI-Act GPAI: `gesetze/EU-Verordnungen/AI-Act-2024-1689/gpai-pflichten.md`
- AI-Act Art. 50: `gesetze/EU-Verordnungen/AI-Act-2024-1689/transparenz-art-50.md`
- Audit-Pattern Phase 5e (AI-Chatbot): `audit-patterns.md`
