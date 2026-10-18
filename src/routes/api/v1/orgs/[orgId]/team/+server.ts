import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { bearerOf } from '$lib/server/api/bearer-page';
import { listTeam, runTeamOp, TeamOp, TeamRefusal, type TeamCtx } from '$lib/server/team/team';
import { inviteMailer } from '$lib/server/team/invite-mail';
import { appOrigin } from '$lib/server/app-url';
import type { RequestHandler } from './$types';

const HTTP_BAD_REQUEST = 400;
const HTTP_PAYMENT_REQUIRED = 402;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

const REFUSAL_STATUS: Record<TeamRefusal, number> = {
  [TeamRefusal.NotMember]: HTTP_NOT_FOUND,
  [TeamRefusal.Forbidden]: HTTP_FORBIDDEN,
  [TeamRefusal.InvalidEmail]: HTTP_BAD_REQUEST,
  [TeamRefusal.InvalidRole]: HTTP_BAD_REQUEST,
  [TeamRefusal.AlreadyInvited]: HTTP_CONFLICT,
  [TeamRefusal.AlreadyMember]: HTTP_CONFLICT,
  [TeamRefusal.NotFound]: HTTP_NOT_FOUND,
  [TeamRefusal.OwnerProtected]: HTTP_FORBIDDEN,
  [TeamRefusal.Self]: HTTP_BAD_REQUEST,
  [TeamRefusal.SeatLimit]: HTTP_PAYMENT_REQUIRED
};

const id = z.string().min(1);

const bodySchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal(TeamOp.Invite), email: z.string(), role: z.string() }),
  z.object({ op: z.literal(TeamOp.ResendInvite), invite_id: id }),
  z.object({ op: z.literal(TeamOp.RevokeInvite), invite_id: id }),
  z.object({ op: z.literal(TeamOp.InviteLink) }),
  z.object({ op: z.literal(TeamOp.DisableInviteLink) }),
  z.object({ op: z.literal(TeamOp.Leave) }),
  z.object({ op: z.literal(TeamOp.SetRole), user_id: id, role: z.string() }),
  z.object({ op: z.literal(TeamOp.RemoveMember), user_id: id }),
  z.object({ op: z.literal(TeamOp.TransferOwnership), user_id: id })
]);

type Body = z.infer<typeof bodySchema>;

function requestOf(body: Body) {
  if ('invite_id' in body) {
    return { op: body.op, inviteId: body.invite_id };
  }
  if ('user_id' in body) {
    return { op: body.op, userId: body.user_id, ...('role' in body ? { role: body.role } : {}) };
  }
  return body;
}

async function ctxOf(request: Request, url: URL, orgId: string): Promise<TeamCtx | Response> {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }
  const origin = appOrigin(url);
  return { db: bearer.db, userId: bearer.user.id, orgId, origin, mail: inviteMailer({ inviterEmail: bearer.user.email, origin }) };
}

export const GET: RequestHandler = async ({ request, url, params }) => {
  const ctx = await ctxOf(request, url, params.orgId);
  if (ctx instanceof Response) {
    return ctx;
  }

  const team = await listTeam(ctx);
  return team ? json(team) : json({ error: TeamRefusal.NotMember }, { status: HTTP_NOT_FOUND });
};

export const POST: RequestHandler = async ({ request, url, params }) => {
  const ctx = await ctxOf(request, url, params.orgId);
  if (ctx instanceof Response) {
    return ctx;
  }

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return json({ error: 'invalid_body', detail: body.error.issues[0]?.message }, { status: HTTP_BAD_REQUEST });
  }

  const result = await runTeamOp(ctx, requestOf(body.data) as never);
  if (!result.ok) {
    return json({ error: result.refusal, ...result.detail }, { status: REFUSAL_STATUS[result.refusal] });
  }
  return json(result.data);
};
