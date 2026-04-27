#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  handleScan,
  handleFindings,
  handleScore,
  handleCompliance,
  handleFixSuggestion,
} from './handlers.js';

// Read version from package.json so MCP serverInfo.version stays in
// lockstep with the published @aegis-scan/mcp-server version. Closes
// AUDIT-AEGIS-SCAN-V0165 §3 M3 (was hardcoded "0.2.0" while package
// shipped at 0.16.x — broke 5-package lockstep-honesty signal).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
) as { version: string };

const server = new McpServer({
  name: 'aegis-mcp',
  version: pkgJson.version,
});

// ---------------------------------------------------------------------------
// Tool: aegis_scan
// ---------------------------------------------------------------------------
server.registerTool(
  'aegis_scan',
  {
    description: 'Run AEGIS security scan on a project directory',
    inputSchema: {
      path: z.string().describe('Absolute path to the project directory to scan'),
      mode: z.enum(['scan', 'audit']).optional().describe(
        'scan = fast (security, deps, quality, compliance, i18n); audit = all scanners',
      ),
    },
  },
  async (input) => {
    try {
      const result = await handleScan(input);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
          },
        ],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: aegis_findings
// ---------------------------------------------------------------------------
server.registerTool(
  'aegis_findings',
  {
    description:
      'Get detailed findings from the last scan, optionally filtered by severity or scanner',
    inputSchema: {
      severity: z
        .enum(['blocker', 'critical', 'high', 'medium', 'low', 'info'])
        .optional()
        .describe('Filter to a specific severity level'),
      scanner: z.string().optional().describe('Filter to a specific scanner name'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .describe('Maximum number of findings to return (default: 100)'),
    },
  },
  (input) => {
    const result = handleFindings(input);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: aegis_score
// ---------------------------------------------------------------------------
server.registerTool(
  'aegis_score',
  {
    description: 'Get the current AEGIS security score for a project',
    inputSchema: {
      path: z.string().describe('Absolute path to the project directory'),
    },
  },
  async (input) => {
    try {
      const result = await handleScore(input);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
          },
        ],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: aegis_compliance
// ---------------------------------------------------------------------------
server.registerTool(
  'aegis_compliance',
  {
    description: 'Check compliance against a specific framework',
    inputSchema: {
      path: z.string().describe('Absolute path to the project directory'),
      framework: z
        .enum(['gdpr', 'soc2', 'iso27001', 'pci-dss'])
        .describe('Compliance framework to check against'),
    },
  },
  async (input) => {
    try {
      const result = await handleCompliance(input);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
          },
        ],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool: aegis_fix_suggestion
// ---------------------------------------------------------------------------
server.registerTool(
  'aegis_fix_suggestion',
  {
    description:
      'Get a fix suggestion for a specific finding from the last scan',
    inputSchema: {
      findingId: z.string().describe('The ID of the finding (from aegis_scan or aegis_findings)'),
      file: z.string().optional().describe('Optional: file path to narrow the search'),
    },
  },
  (input) => {
    const result = handleFixSuggestion(input);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Start the server
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Guard the entry-point invocation so `import('./src/index.js')` does NOT
// trigger a stdio connection. Test code imports this module to assert
// version-reporting is in lockstep with package.json, and a stdio connect
// from within the test process would block on closed stdin in CI (vitest
// timeout 5s). When the module is the actual node entry-point the URL of
// import.meta matches the resolved process.argv[1].
//
// Failure mode this fixes: CI mcp-server version.test.ts timeout in 5000ms
// (regression from 25acb6d, 2026-04-25; CI red since 2026-04-26 14:21).
const isEntryPoint = (() => {
  try {
    const argv1 = process.argv[1];
    if (!argv1) return false;
    const argvUrl = new URL(`file://${argv1}`).href;
    return import.meta.url === argvUrl;
  } catch {
    return false;
  }
})();

if (isEntryPoint) {
  main().catch((err) => {
    process.stderr.write(`AEGIS MCP Server fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
