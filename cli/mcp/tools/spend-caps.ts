import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { spendCapsApi } from '../../lib/spend-caps.ts';
import { withAuth } from '../util.ts';

export function registerSpendCapsTools(server: McpServer) {
  server.registerTool(
    'spend_caps',
    {
      title: 'Read or set the spend caps of an org',
      description:
        'The spend caps of the org. Without `scope` it reads them. With `scope` (org_member: each member anywhere; project_member: each member in `project_id`; project_total: the project as a whole) and `cap_usd` it sets one, admins only and only when the user asks; `cap_usd` null removes it. `reset` is none or monthly. ' +
        'A run refused by a cap answers with the error `cap_reached`. Free.',
      inputSchema: z.object({
        org: z.string().optional(),
        scope: z.enum(['org_member', 'project_member', 'project_total']).optional(),
        project_id: z.string().optional(),
        cap_usd: z.number().positive().nullable().optional(),
        reset: z.enum(['none', 'monthly']).optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, scope, project_id, cap_usd, reset }) =>
      withAuth((token) => (scope ? spendCapsApi.set(token, { scope, project_id, cap_usd: cap_usd ?? null, reset }, org) : spendCapsApi.get(token, org)))
  );
}
