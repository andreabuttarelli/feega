import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { orgsApi } from '../../lib/orgs.ts';
import { withAuth } from '../util.ts';

export function registerOrgTools(server: McpServer) {
  server.registerTool(
    'list_orgs',
    {
      title: 'List organisations',
      description: 'The organisations the user belongs to, with their role; `active: true` is the one every tool works in when `org` is omitted. Free, reads only.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true }
    },
    async () => withAuth((token) => orgsApi.list(token))
  );

  server.registerTool(
    'team_op',
    {
      title: 'Change organisations and teams',
      description: 'One organisation or team change, only when the user asks. `op`: `switch_org` makes `org_id` (from `list_orgs`) active for the web app, the CLI and agents.',
      inputSchema: z.object({ op: z.enum(['switch_org']), org_id: z.string() }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org_id }) => withAuth((token) => orgsApi.switch(token, org_id))
  );
}
