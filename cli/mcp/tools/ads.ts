import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { request } from '../../lib/api.ts';
import { withAuth } from '../util.ts';

const org = z.string().optional().describe('Which org, if you belong to more than one.');

function call<T>(
  token: string,
  method: string,
  path: string,
  org: string | undefined,
  body?: unknown,
  extraQuery?: Record<string, string>
): Promise<T> {
  const qs = new URLSearchParams(extraQuery);
  if (org) qs.set('org', org);
  const suffix = qs.toString() ? `?${qs}` : '';
  return request<T>(`${path}${suffix}`, token, { method, body: body ? JSON.stringify(body) : undefined });
}

export function registerAdsTools(server: McpServer) {
  server.registerTool(
    'list_ad_campaigns',
    {
      title: 'List ad campaigns',
      description: 'Ad campaigns of one brand, with their status and whether a human has approved them yet. Free.',
      inputSchema: z.object({
        org,
        brand_id: z.string(),
        status: z
          .enum(['draft', 'pending_review', 'scheduled', 'active', 'paused', 'completed', 'failed', 'rejected'])
          .optional()
      }),
      annotations: { readOnlyHint: true }
    },
    async ({ org, brand_id, status }) =>
      withAuth((token) => call(token, 'GET', '/api/v1/org/ads/campaigns', org, undefined, { brand_id, ...(status ? { status } : {}) }))
  );

  server.registerTool(
    'create_ad_campaign',
    {
      title: 'Propose a Meta ad',
      description:
        'Draft a paid Meta ad campaign (Facebook + Instagram) for a brand, from canvas image/video nodes or ' +
        'by boosting a published post. It ALWAYS lands as an unapproved draft: nothing is launched or ' +
        'billed until a person approves it in the app (or `feega ads --approve`). Free.',
      inputSchema: z.object({
        org,
        brand_id: z.string(),
        ad_account_id: z.string().describe('A Meta ad account of the brand (ad_accounts.id).'),
        objective: z.enum(['traffic', 'engagement', 'awareness']),
        budget_type: z.enum(['daily', 'lifetime']),
        budget_amount: z.number().positive().describe('Whole currency units of the ad account.'),
        days: z.number().int().positive(),
        countries: z.array(z.string().length(2)).min(1),
        age_min: z.number().int().min(18).max(65).optional(),
        age_max: z.number().int().min(18).max(65).optional(),
        gender: z.enum(['all', 'female', 'male']).optional(),
        placements: z
          .array(z.enum(['facebook_feed', 'instagram_feed', 'facebook_stories', 'instagram_stories', 'facebook_reels', 'instagram_reels']))
          .min(1),
        primary_text: z.string().min(1),
        headline: z.string().min(1),
        call_to_action: z.enum(['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'BOOK_NOW', 'CONTACT_US', 'ORDER_NOW']).optional(),
        link_url: z.string().optional().describe('Required for traffic.'),
        node_ids: z.array(z.string()).optional().describe('Canvas image/video nodes, in order.'),
        post_id: z.string().optional().describe('A published post to boost instead of node_ids.')
      }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, ...input }) => withAuth((token) => call(token, 'POST', '/api/v1/org/ads/campaigns', org, input))
  );

  server.registerTool(
    'approve_ad_campaign',
    {
      title: 'Approve an ad campaign',
      description:
        'Approve a proposed campaign and launch it on Meta — this spends money. REFUSED over an API key on purpose: an agent cannot approve ' +
        'its own spend — this only works from a signed-in person\'s own session (the app, or `feega ' +
        'login`). If you are an agent and this fails, tell the person to approve it themselves.',
      inputSchema: z.object({ org, id: z.string() }),
      annotations: { readOnlyHint: false, destructiveHint: true }
    },
    async ({ org, id }) => withAuth((token) => call(token, 'POST', `/api/v1/org/ads/campaigns/${encodeURIComponent(id)}/approve`, org))
  );

  server.registerTool(
    'set_ad_campaign_status',
    {
      title: 'Pause or resume an ad campaign',
      description: 'Pause a running Meta campaign, or resume a paused one. Pausing stops spend.',
      inputSchema: z.object({ org, id: z.string(), next: z.enum(['active', 'paused']) }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ org, id, next }) =>
      withAuth((token) => call(token, 'POST', `/api/v1/org/ads/campaigns/${encodeURIComponent(id)}/status`, org, { next }))
  );
}
