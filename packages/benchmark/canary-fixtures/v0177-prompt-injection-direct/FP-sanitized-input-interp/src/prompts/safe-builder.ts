// Safe pattern: sanitizer wraps the interpolated user property before
// it reaches the prompt template-literal.

import { sanitizeForPrompt } from "@/lib/security/prompt-sanitizer";

type Input = { destination: string; travelDates?: string };

export function buildPrompt(input: Input): string {
  const safeDest = sanitizeForPrompt(input.destination, 200);
  const safeDates = input.travelDates ? sanitizeForPrompt(input.travelDates, 100) : "";

  return [
    `You are a destination researcher.`,
    `Focus destination: ${safeDest}.`,
    safeDates ? `Travel dates: ${safeDates}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
