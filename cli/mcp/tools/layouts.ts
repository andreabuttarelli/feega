import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { layoutsApi } from '../../lib/layouts.ts';
import { withAuth } from '../util.ts';

const org = z.string().optional().describe('Which org, if you belong to more than one.');

const SPEC_HELP =
  '`spec`: `{ kind: "spec", slots, place, cards?, camera?: fixed|selected, motion?: cycle|ping-pong|linear, params?, tilt?, scale?, animate? }`; ' +
  '`place` is `{ kind: "grid", columns, gapX, gapY }`, `{ kind: "ring", radius }`, `{ kind: "line", gap, axis }` or `{ kind: "scatter", spread, depth, seed }`; ' +
  '`animate` items `{ prop: x|y|z|rotX|rotY|rotZ|scale|opacity, fn: sin|linear|ease, amp, freq, phase: { column, row, index } }`; any number may be `{ param }` of a declared range param.';

export function registerLayoutTools(server: McpServer) {
  server.registerTool(
    'list_layouts',
    {
      title: 'List custom layouts',
      description: "The workspace's custom composition layouts: id, name, version, spec. Reads only, spends nothing.",
      inputSchema: z.object({ org }),
      annotations: { readOnlyHint: true }
    },
    async ({ org }) => withAuth((token) => layoutsApi.list(token, org))
  );

  server.registerTool(
    'write_layout',
    {
      title: 'Write a custom layout',
      description: `Writes a custom composition layout for the workspace (same name replaces it). ${SPEC_HELP} Ask \`ask_motion_agent\` to put it on a composition. Spends no credits.`,
      inputSchema: z.object({ org, name: z.string().describe('kebab-case'), spec: z.record(z.string(), z.unknown()) }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, name, spec }) => withAuth((token) => layoutsApi.write(token, { name, spec }, org))
  );

  server.registerTool(
    'patch_layout',
    {
      title: 'Patch a custom layout',
      description: 'Replaces the spec of a custom layout at its `version` (`list_layouts`); a stale one is a 409. Spends no credits.',
      inputSchema: z.object({ org, layout_id: z.string(), version: z.number().int(), spec: z.record(z.string(), z.unknown()) }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, layout_id, version, spec }) => withAuth((token) => layoutsApi.patch(token, layout_id, { version, spec }, org))
  );
}
