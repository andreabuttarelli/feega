import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { studioApi, type BatchAction } from '../../lib/studio.ts';
import { withAuth } from '../util.ts';

const project = z.string().optional().describe('Which project; the most recent one when omitted.');

const selection = z
  .record(z.string(), z.unknown())
  .describe('`{ name, productIds, modelIds?, environments, shots, variations, model, styleRefs?, noPeopleConfirmed? }`, the same selection the Photo studio page builds.');

const BATCH_TOOLS: ReadonlyArray<{ action: BatchAction; title: string; description: string }> = [
  { action: 'run', title: 'Run a photo studio batch', description: 'Renders the rest of a Photo studio batch after its previews. Spends credits.' },
  { action: 'more', title: 'Add photo studio variations', description: 'Adds `variations` per cell to a Photo studio batch and renders them. Spends credits.' },
  { action: 'cancel', title: 'Cancel a photo studio batch', description: 'Stops the items of a Photo studio batch still queued; finished ones stay. Returns how many it stopped.' },
  { action: 'retry', title: 'Retry photo studio items', description: 'Requeues the failed or cancelled `item_ids` of a Photo studio batch. Spends credits.' },
  { action: 'regenerate', title: 'Regenerate photo studio items', description: 'Requeues finished `item_ids` of a Photo studio batch for a new render. Spends credits.' },
  { action: 'approve', title: 'Approve a photo studio item', description: 'Approves the first of `item_ids` in a Photo studio batch. Free.' },
  { action: 'reject', title: 'Reject a photo studio item', description: 'Rejects the first of `item_ids` in a Photo studio batch. Free.' }
];

function registerBatchTool(server: McpServer, tool: (typeof BATCH_TOOLS)[number]) {
  server.registerTool(
    `studio_${tool.action}`,
    {
      title: tool.title,
      description: `${tool.description} Follow with \`studio_status\`.`,
      inputSchema: z.object({ batch_id: z.string(), item_ids: z.array(z.string()).optional(), variations: z.number().int().optional() }),
      annotations: { readOnlyHint: false, destructiveHint: tool.action === 'cancel' }
    },
    async ({ batch_id, item_ids, variations }) => withAuth((token) => studioApi.act(token, batch_id, tool.action, { itemIds: item_ids, variations }))
  );
}

export function registerStudioTools(server: McpServer) {
  BATCH_TOOLS.forEach((tool) => registerBatchTool(server, tool));

  server.registerTool(
    'studio_quote',
    {
      title: 'Quote a photo studio batch',
      description:
        'Prices a Photo studio batch before it starts: image count, credits per image and in total, skipped combinations, and a `quoteId`. ' +
        'Pass that `quoteId` to `studio_start`. Free, spends nothing.',
      inputSchema: z.object({ selection, project }),
      annotations: { readOnlyHint: true }
    },
    async ({ selection, project }) => withAuth((token) => studioApi.quote(token, selection, project))
  );

  server.registerTool(
    'studio_start',
    {
      title: 'Start a photo studio batch',
      description:
        'Starts a Photo studio batch and spends credits. Needs the `quoteId` of `studio_quote` for the SAME selection: a changed selection or price is a 409, ask the person again with a new quote. ' +
        'Returns the `batchId`; follow it with `studio_status`.',
      inputSchema: z.object({ selection, quoteId: z.string(), project }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ selection, quoteId, project }) => withAuth((token) => studioApi.start(token, selection, quoteId, project))
  );

  server.registerTool(
    'studio_status',
    {
      title: 'Photo studio batch status',
      description: 'The items of a Photo studio batch and their state. Free, reads only.',
      inputSchema: z.object({ batch_id: z.string() }),
      annotations: { readOnlyHint: true }
    },
    async ({ batch_id }) => withAuth((token) => studioApi.status(token, batch_id))
  );
}
