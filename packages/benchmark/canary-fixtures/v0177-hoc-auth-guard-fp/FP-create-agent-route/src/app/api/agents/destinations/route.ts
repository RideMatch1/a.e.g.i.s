// Sanitized from a real 2026-04-29 dogfood-scan FP (tripsage-ai
// app/api/agents/destinations/route.ts). The createAgentRoute factory
// wraps an AI-agent factory call with withApiGuards-derived auth.

import { createDestinationAgent } from "@ai/agents";
import { agentSchemas } from "@schemas/agents";
import { createAgentRoute } from "@/lib/api/factory";

export const maxDuration = 60;

export const POST = createAgentRoute({
  agentFactory: createDestinationAgent,
  agentType: "destinationResearchAgent",
  rateLimit: "agents:destinations",
  schema: agentSchemas.destinationResearchRequestSchema,
  telemetry: "agent.destinationResearch",
});
