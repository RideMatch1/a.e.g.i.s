---
license: MIT (snippet)
provider: Mistral AI SAS (Frankreich) — EU-Anbieter
provider-AVV-status: Enterprise-DPA verfügbar; La Plateforme DPA standardmäßig
last-checked: 2026-05-01
---

# Mistral AI — EU-AI-Provider Compliance + DSE-Wording

## 1. Default-Verhalten

- **Hosting**: EU (Frankreich, AWS eu-west-1 / GCP europe-west1)
- **Daten-Routing**: bei `mistral-large-latest` und `mistral-medium` standardmäßig EU
- **Keine Trainingsnutzung** auf API-Daten (Default seit 2024-Q4)
- **Logging**: Server-seitig nur 30 Tage, danach gelöscht (laut DPA)
- **Token-Rate-Limit**: pro API-Key, kein Userdaten-Tracking ohne explizite Konfiguration

## 2. Compliance-Vorteile gegenüber US-Anbietern

| Aspekt | Mistral (FR/EU) | OpenAI (US) | Anthropic (US) |
|--------|-----------------|-------------|----------------|
| Hosting-Region | EU-Default | US-Default | US-Default |
| DPF-Zertifizierung | nicht relevant (EU) | ja | ja |
| Drittland-Hinweis nötig | NEIN | JA | JA |
| SCC nötig | NEIN | JA (Modul 2) | JA (Modul 2) |
| Trainingsnutzung Default | nein | nein (Enterprise) / ja (Free) | nein |

## 3. Compliance-Risiken (Mistral-spezifisch)

| Risiko | Wirkung | Fix |
|--------|---------|-----|
| User-Prompts mit PII an API senden | DSGVO Art. 6 (auch innerhalb EU braucht Rechtsgrundlage) | DSFA + Einwilligung wenn Sondersensibles |
| Modell-Antworten mit erfundenem Inhalt | UWG § 5 wenn beworben als „korrekt" | Disclaimer „kein Ersatz für fachliche Beratung" |
| AI-Act Art. 50 ab 02.08.2026 | Pflicht-Hinweis im Chat-UI | KI-Kennzeichnung sichtbar |

## 4. Code-Pattern (sanitized)

```ts
// File: src/lib/ai/mistral-client.ts
import { Mistral } from '@mistralai/mistralai';

const client = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY!,
  // serverEndpoint: optional, default = api.mistral.ai (EU)
});

export async function chatWithDisclaimer(userMessage: string) {
  const response = await client.chat.complete({
    model: 'mistral-medium-latest', // EU-hosted by default
    messages: [
      {
        role: 'system',
        content:
          'Du bist ein hilfreicher Assistent. ' +
          'Bei medizinischen / juristischen / finanziellen Fragen: ' +
          'verweise auf Fachkraft. Erfinde keine Fakten — sage „weiß ich nicht" wenn unsicher.',
      },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    maxTokens: 1000,
  });

  return response.choices?.[0]?.message?.content;
}
```

```tsx
// File: src/components/chat/ChatUI.tsx
// Pflicht-Hinweis nach AI-Act Art. 50 (ab 02.08.2026)
'use client';

export function AIChatHeader() {
  return (
    <div className="ai-disclaimer" role="note">
      <span aria-hidden="true">🤖</span>
      <p>
        <strong>KI-Assistent.</strong> Antworten werden von einer KI erzeugt
        (Mistral AI, EU-gehostet). Sie ersetzen keine fachliche Beratung
        (Tierarzt / Arzt / Anwalt / Steuerberater).
      </p>
    </div>
  );
}
```

## 5. AVV / DPA

- **DPA-Link**: https://mistral.ai/terms#data-processing-addendum
- **Standard La Plateforme Terms**: https://mistral.ai/terms/#terms-of-service-la-plateforme
- **Enterprise DPA**: auf Anfrage
- **AI-Act-Compliance-Doku**: Mistral publiziert technical-doc nach Art. 53 AI-Act (GPAI-Pflicht)

## 6. DSE-Wording-Vorlage

> **KI-gestützte Funktionen (Mistral AI).** Für KI-basierte Funktionen
> (z.B. Chat-Assistent, Empfehlungen) nutzen wir die API von Mistral AI
> SAS (15 rue des Halles, 75001 Paris, Frankreich) als Auftragsverarbeiter
> im Sinne von Art. 28 DSGVO. Daten werden in der EU verarbeitet (kein
> Drittland-Transfer). Eingaben (Prompts) und KI-Antworten werden bei
> Mistral maximal 30 Tage zur Missbrauchs-Erkennung gespeichert und nicht
> für Training genutzt (siehe Mistral Privacy Policy). Rechtsgrundlage:
> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) bzw. lit. f
> (berechtigtes Interesse). Bei sensiblen Datenkategorien holen wir
> separate Einwilligung ein (Art. 6 Abs. 1 lit. a + Art. 9 lit. a DSGVO).
> Datenschutz Mistral: https://mistral.ai/terms/#privacy-policy.

## 7. Verify-Commands

```bash
# API-Endpoint-Region prüfen (sollte EU sein)
curl -s -X POST https://api.mistral.ai/v1/chat/completions \
  -H "Authorization: Bearer $MISTRAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"mistral-small-latest","messages":[{"role":"user","content":"hi"}]}' \
  -I | grep -iE 'cf-ray|x-amz|server'
# erwarte: EU-region-headers (eu-west / fra / paris)
```

## 8. Az.-Anker

- AI-Act VO 2024/1689 Art. 53 (GPAI-Pflichten Mistral)
- AI-Act Art. 50 (Transparenz für End-User, ab 02.08.2026)
