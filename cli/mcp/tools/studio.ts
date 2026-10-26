import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { studioApi } from '../../lib/studio.ts';
import { withAuth } from '../util.ts';

const project = z.string().optional().describe('Which project; the most recent one when omitted.');

const selection = z
  .record(z.string(), z.unknown())
  .describe('`{ name, productIds, modelIds?, environments, shots, variations, model, styleRefs?, noPeopleConfirmed? }`, the same selection the Photo studio page builds.');

export function registerStudioTools(server: McpServer) {
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
