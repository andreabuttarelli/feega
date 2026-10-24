import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { modelAllowlistApi } from '../../lib/model-allowlist.ts';
import { withAuth } from '../util.ts';

export function registerModelAllowlistTools(server: McpServer) {
  server.registerTool(
    'model_allowlist',
    {
      title: 'Read or set the models an org allows',
      description:
        'Which image, video and 3D models the org offers. Without `medium` it reads: ids per medium, an empty list meaning every model. ' +
        'With `medium` (image, video, model3d) and `model_ids` it replaces that medium list, admins only and only when the user asks; an empty `model_ids` allows every model again. Free.',
      inputSchema: z.object({
        org: z.string().optional(),
        medium: z.enum(['image', 'video', 'model3d']).optional(),
        model_ids: z.array(z.string()).optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, medium, model_ids }) =>
      withAuth((token) => (medium ? modelAllowlistApi.set(token, { medium, model_ids: model_ids ?? [] }, org) : modelAllowlistApi.get(token, org)))
  );
}
