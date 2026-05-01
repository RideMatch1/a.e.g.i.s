---
license: MIT (snippet)
provider: OpenAI Ireland Ltd (Dublin) + OpenAI L.L.C. (USA)
provider-AVV-status: DPA verfügbar (Standard + Zero Data Retention auf Anfrage)
last-checked: 2026-05-01
---

# OpenAI — Compliance + DSE-Wording (Drittland US!)

## 1. Default-Verhalten

- **Routing**: Standard via OpenAI Ireland (für EU-Kunden), aber Sub-Processors in den USA
- **EU-Data-Boundary** seit 2024-Q1 als Option (Beta) — muss explizit aktiviert werden
- **Trainings-Nutzung**: bei API-Daten OPT-OUT (Default kein Training seit 03/2023)
- **Logging**: 30 Tage Default, „Zero Data Retention" für Enterprise auf Anfrage
- **Drittland-Status**: USA — DPF-zertifiziert seit 11.10.2023

## 2. Compliance-Risiken

| Risiko | Wirkung | Fix |
|--------|---------|-----|
| Default-Routing über USA | Drittland-Transfer | EU Data Boundary aktivieren ODER DSE-Erwähnung |
| Sub-Processor in USA (Azure / GCP) | weiterer Transfer | DPA-Sub-Processor-Liste annehmen |
| User-Prompts mit Sondersensibles | Art. 9 DSGVO + DPF | Pseudonymisierung vor Senden ODER Einwilligung |
| Hallucinations bei Health/Legal/Finance-Antworten | UWG § 5 wenn als „verlässlich" beworben | Disclaimer Pflicht |

## 3. Code-Pattern (sanitized)

```ts
// File: src/lib/ai/openai-client.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  // EU-Data-Boundary aktivieren via Header (wenn Account-Setting aktiv):
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

export async function chatWithSafeguards(userMessage: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // oder gpt-4-turbo / gpt-5
    messages: [
      {
        role: 'system',
        content:
          'Antworte auf Deutsch. Bei medizinischen/juristischen/finanziellen Fragen ' +
          'verweise auf Fachkraft. Erfinde keine Fakten — bei Unsicherheit sage es.',
      },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  return response.choices[0]?.message?.content ?? '';
}
```

```tsx
// File: src/components/chat/AIDisclaimerHeader.tsx
'use client';

export function OpenAIDisclaimer() {
  return (
    <div className="ai-disclaimer" role="note">
      <p>
        🤖 <strong>KI-Assistent.</strong> Antworten werden mit OpenAI (USA)
        erzeugt. Sie können fehlerhaft sein und ersetzen keine
        fachliche Beratung. Mit Nutzung stimmst du der DSGVO-konformen
        Verarbeitung deiner Eingaben in den USA zu (siehe Datenschutz).
      </p>
    </div>
  );
}
```

## 4. AVV / DPA

- **DPA-Link**: https://openai.com/policies/data-processing-addendum
- **Trust-Portal**: https://trust.openai.com
- **Sub-Processors**: https://openai.com/policies/sub-processor-list
- **DPF-Zertifikat**: https://www.dataprivacyframework.gov/list (suche „OpenAI")
- **Zero Data Retention**: auf Anfrage für Enterprise via support@openai.com

## 5. DSE-Wording-Vorlage

> **KI-gestützte Funktionen (OpenAI, USA).** Für KI-basierte Funktionen
> nutzen wir die API von OpenAI Ireland Ltd (1st Floor, The Liffey Trust
> Centre, 117–126 Sheriff Street Upper, Dublin 1, Irland) und OpenAI
> L.L.C. (3180 18th Street, San Francisco, CA 94110, USA) als
> Auftragsverarbeiter im Sinne von Art. 28 DSGVO. Eingaben werden zur
> Beantwortung der Anfrage an OpenAI in den USA übermittelt
> (Drittlandtransfer Art. 44 ff. DSGVO). Rechtsgrundlage für den
> Drittlandtransfer ist Art. 45 i.V.m. dem EU-US Data Privacy Framework
> (OpenAI Inc. ist DPF-zertifiziert) sowie ergänzend EU-Standardvertrags-
> klauseln (Modul 2). Eingaben werden bei OpenAI maximal 30 Tage zur
> Missbrauchs-Erkennung gespeichert und nicht für Training verwendet
> (API-Daten-Opt-Out by default). Rechtsgrundlage: Art. 6 Abs. 1 lit. b
> DSGVO. Datenschutz OpenAI: https://openai.com/policies/privacy-policy.
>
> Hinweis: Für Anfragen mit besonders sensiblen Inhalten (Gesundheit,
> juristische / finanzielle Themen) holen wir gesonderte Einwilligung ein
> (Art. 6 Abs. 1 lit. a + Art. 9 lit. a DSGVO).

## 6. Verify-Commands

```bash
# Account-Setting EU-Data-Boundary prüfen (UI in OpenAI Dashboard)
# Verify Sub-Processor-Liste aktuell
curl -s https://openai.com/policies/sub-processor-list | grep -oE '<title>.*</title>'

# DPF-Zertifikat-Status
curl -s "https://www.dataprivacyframework.gov/api/PartList" | jq '.[] | select(.OrganizationName | contains("OpenAI"))'
```

## 7. Az.-Anker

- AI-Act VO 2024/1689 Art. 53–55 (GPAI-Pflichten OpenAI)
- AI-Act Art. 50 Transparenz (ab 02.08.2026)
- noyb-Klagen gegen ChatGPT (Stand: anhängig 2026, läuft seit 04/2024)
