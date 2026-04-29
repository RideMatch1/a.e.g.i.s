// Sanitized from real 2026-04-29 dogfood-scan TP (tripsage-ai
// src/prompts/agents.ts buildDestinationPrompt). Direct interpolation of
// user-controlled input properties into the system-prompt string.

type DestinationPromptInput = {
  destination: string;
  travelDates?: string;
  travelStyle?: string;
  specificInterests?: string[];
  providerSummary?: string;
  locale?: string;
};

export function buildDestinationPrompt(input: DestinationPromptInput): string {
  const style = input.travelStyle ?? "balanced";
  const locale = input.locale ?? "en-US";
  const intro = `You are TripSage's destination researcher. Respond in ${locale}.`;
  const safetyFragment = input.providerSummary
    ? `Supplement recommendations with these external findings: ${input.providerSummary}`
    : "";

  return [
    intro,
    `Focus destination: ${input.destination}. Travel style: ${style}.`,
    input.travelDates ? `Travel dates: ${input.travelDates}.` : "",
    input.specificInterests?.length
      ? `Specific interests: ${input.specificInterests.join(", ")}.`
      : "",
    safetyFragment,
  ]
    .filter(Boolean)
    .join("\n");
}
