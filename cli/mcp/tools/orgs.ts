import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { activeOrgId, orgsApi, teamApi } from '../../lib/orgs.ts';
import { withAuth } from '../util.ts';

const MEMBER_OPS = ['invite', 'resend_invite', 'revoke_invite', 'invite_link', 'disable_invite_link', 'set_role', 'remove_member', 'leave', 'transfer_ownership'] as const;
const OPS = ['switch_org', 'create_org', ...MEMBER_OPS] as const;

type TeamInput = { op: (typeof OPS)[number]; org_id?: string; name?: string; email?: string; role?: string; invite_id?: string; user_id?: string };

async function memberOp(token: string, { op, org_id, ...rest }: TeamInput) {
  return teamApi.op(token, await activeOrgId(token, org_id), { op, ...rest });
}

const ORG_OPS: Record<string, (token: string, input: TeamInput) => Promise<unknown>> = {
  switch_org: (token, input) => orgsApi.switch(token, input.org_id ?? ''),
  create_org: (token, input) => orgsApi.create(token, input.name ?? '')
};

const runOp = (token: string, input: TeamInput) => (ORG_OPS[input.op] ?? memberOp)(token, input);

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
    'list_team',
    {
      title: 'List an organisation team',
      description: 'Members with role, pending invites and whether the invite link is on, for `org_id` (default: the active org). Free, reads only.',
      inputSchema: z.object({ org_id: z.string().optional() }),
      annotations: { readOnlyHint: true }
    },
    async ({ org_id }) => withAuth(async (token) => teamApi.get(token, await activeOrgId(token, org_id)))
  );

  server.registerTool(
    'team_op',
    {
      title: 'Change organisations and teams',
      description:
        'One organisation or team change, only when the user asks; `org_id` defaults to the active org. `switch_org` (org_id), `create_org` (name); ' +
        '`invite` (email, role admin|member|viewer), `resend_invite`/`revoke_invite` (invite_id), `invite_link` (new link, joins as viewer; old one stops) / `disable_invite_link`, ' +
        '`set_role` (user_id, role), `remove_member` (user_id), `leave`, `transfer_ownership` (user_id; owner only, you become admin). ' +
        'Free organisations have limited editor seats: a `seat_limit` answer carries `upgrade_path`; viewers are free.',
      inputSchema: z.object({
        op: z.enum(OPS),
        org_id: z.string().optional(),
        name: z.string().optional(),
        email: z.string().optional(),
        role: z.enum(['admin', 'member', 'viewer']).optional(),
        invite_id: z.string().optional(),
        user_id: z.string().optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async (input) => withAuth((token) => runOp(token, input))
  );
}
