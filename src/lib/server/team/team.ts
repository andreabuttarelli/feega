import type { Db } from '$lib/server/db/client';
import { assignableRoles, can, isOrgRole, OrgAction, OrgRoleName, type OrgRole } from '$lib/org-roles';
import { listMembers, memberRole, orgName, removeMember, setMemberRole, transferOwnership } from '$lib/server/repos/orgs';
import {
  createInvite,
  deleteLinkInvite,
  LINK_EXPIRES_IN_DAYS,
  LINK_INVITE_EMAIL,
  listInvites,
  renewInvite,
  revokeInvite,
  type Invite
} from '$lib/server/repos/invites';
import { editorSeatsLeft, needsSeat, seatLimitDetail, seatPlanOf } from '$lib/server/team/seats';
import { INVITE_PARAM } from '$lib/server/tenancy/landing';

export type InviteMail = { to: string; orgName: string; inviterId: string; acceptUrl: string };

export type TeamCtx = { db: Db; userId: string; orgId: string; origin: string; mail: (mail: InviteMail) => Promise<boolean> };

export enum TeamOp {
  Invite = 'invite',
  ResendInvite = 'resend_invite',
  RevokeInvite = 'revoke_invite',
  InviteLink = 'invite_link',
  DisableInviteLink = 'disable_invite_link',
  SetRole = 'set_role',
  RemoveMember = 'remove_member',
  Leave = 'leave',
  TransferOwnership = 'transfer_ownership'
}

export enum TeamRefusal {
  NotMember = 'not_member',
  Forbidden = 'forbidden',
  InvalidEmail = 'invalid_email',
  InvalidRole = 'invalid_role',
  AlreadyInvited = 'already_invited',
  AlreadyMember = 'already_member',
  NotFound = 'not_found',
  OwnerProtected = 'owner_protected',
  Self = 'self',
  SeatLimit = 'seat_limit'
}

export type TeamRequest =
  | { op: TeamOp.Invite; email: string; role: string }
  | { op: TeamOp.ResendInvite | TeamOp.RevokeInvite; inviteId: string }
  | { op: TeamOp.InviteLink | TeamOp.DisableInviteLink | TeamOp.Leave }
  | { op: TeamOp.SetRole; userId: string; role: string }
  | { op: TeamOp.RemoveMember | TeamOp.TransferOwnership; userId: string };

export type TeamResult = { ok: true; data: Record<string, unknown> } | { ok: false; refusal: TeamRefusal; detail?: Record<string, unknown> };

export type TeamMember = { userId: string; email: string; name: string | null; role: OrgRole };

export type Team = { orgId: string; role: OrgRole; members: TeamMember[]; invites: Invite[]; linkActive: boolean };

const OP_ACTION: Record<TeamOp, OrgAction> = {
  [TeamOp.Invite]: OrgAction.Invite,
  [TeamOp.ResendInvite]: OrgAction.Invite,
  [TeamOp.RevokeInvite]: OrgAction.Invite,
  [TeamOp.InviteLink]: OrgAction.Invite,
  [TeamOp.DisableInviteLink]: OrgAction.Invite,
  [TeamOp.SetRole]: OrgAction.ManageMembers,
  [TeamOp.RemoveMember]: OrgAction.ManageMembers,
  [TeamOp.Leave]: OrgAction.Leave,
  [TeamOp.TransferOwnership]: OrgAction.TransferOwnership
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNIQUE_VIOLATION = '23505';
const LINK_ROLE = OrgRoleName.Viewer;

const done = (data: Record<string, unknown> = {}): TeamResult => ({ ok: true, data });
const refused = (refusal: TeamRefusal): TeamResult => ({ ok: false, refusal });

const acceptUrl = (ctx: TeamCtx, token: string) => `${ctx.origin}/login?${INVITE_PARAM}=${encodeURIComponent(token)}`;

export async function listTeam(ctx: TeamCtx): Promise<Team | null> {
  const role = await memberRole(ctx.db, { userId: ctx.userId, orgId: ctx.orgId });
  if (!role) {
    return null;
  }

  const members = await listMembers(ctx.db, ctx.orgId);
  const invites = can(role, OrgAction.Invite) ? await listInvites(ctx.db, ctx.orgId) : [];
  const pending = invites.filter((i) => i.status === 'pending');

  return {
    orgId: ctx.orgId,
    role,
    members,
    invites: pending.filter((i) => i.email !== LINK_INVITE_EMAIL),
    linkActive: pending.some((i) => i.email === LINK_INVITE_EMAIL)
  };
}

async function seatRefusal(ctx: TeamCtx, role: string): Promise<TeamResult | null> {
  if (!needsSeat(role)) {
    return null;
  }

  const [plan, members, invites] = await Promise.all([seatPlanOf(ctx.db, ctx.orgId), listMembers(ctx.db, ctx.orgId), listInvites(ctx.db, ctx.orgId)]);
  const pendingInviteRoles = invites.filter((i) => i.status === 'pending' && i.email !== LINK_INVITE_EMAIL).map((i) => i.role);
  if (editorSeatsLeft(plan, { members: members.map((m) => m.role), pendingInviteRoles }) > 0) {
    return null;
  }
  return { ok: false, refusal: TeamRefusal.SeatLimit, detail: seatLimitDetail(plan) };
}

async function sendInvite(ctx: TeamCtx, to: string, token: string): Promise<Record<string, unknown>> {
  const url = acceptUrl(ctx, token);
  const name = (await orgName(ctx.db, ctx.orgId)) ?? 'feega';
  const emailSent = await ctx.mail({ to, orgName: name, inviterId: ctx.userId, acceptUrl: url }).catch(() => false);
  return { accept_url: url, email_sent: emailSent };
}

async function invite(ctx: TeamCtx, actor: OrgRole, input: { email: string; role: string }): Promise<TeamResult> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) {
    return refused(TeamRefusal.InvalidEmail);
  }
  if (!isOrgRole(input.role) || !assignableRoles(actor).includes(input.role)) {
    return refused(TeamRefusal.InvalidRole);
  }

  const members = await listMembers(ctx.db, ctx.orgId);
  if (members.some((m) => m.email.toLowerCase() === email)) {
    return refused(TeamRefusal.AlreadyMember);
  }

  const noSeat = await seatRefusal(ctx, input.role);
  if (noSeat) {
    return noSeat;
  }

  try {
    const { invite: created, token } = await createInvite(ctx.db, { orgId: ctx.orgId, email, role: input.role, invitedBy: ctx.userId });
    return done({ invite_id: created.id, ...(await sendInvite(ctx, email, token)) });
  } catch (e) {
    if ((e as { code?: string } | null)?.code === UNIQUE_VIOLATION) {
      return refused(TeamRefusal.AlreadyInvited);
    }
    throw e;
  }
}

async function resend(ctx: TeamCtx, inviteId: string): Promise<TeamResult> {
  const renewed = await renewInvite(ctx.db, { orgId: ctx.orgId, inviteId });
  if (!renewed) {
    return refused(TeamRefusal.NotFound);
  }
  return done(await sendInvite(ctx, renewed.email, renewed.token));
}

async function inviteLink(ctx: TeamCtx): Promise<TeamResult> {
  await deleteLinkInvite(ctx.db, ctx.orgId);
  const { token } = await createInvite(ctx.db, {
    orgId: ctx.orgId,
    email: LINK_INVITE_EMAIL,
    role: LINK_ROLE,
    invitedBy: ctx.userId,
    expiresInDays: LINK_EXPIRES_IN_DAYS
  });
  return done({ url: acceptUrl(ctx, token), role: LINK_ROLE });
}

async function targetRole(ctx: TeamCtx, userId: string): Promise<OrgRole | null> {
  return memberRole(ctx.db, { userId, orgId: ctx.orgId });
}

async function setRole(ctx: TeamCtx, actor: OrgRole, input: { userId: string; role: string }): Promise<TeamResult> {
  const current = await targetRole(ctx, input.userId);
  if (!current) {
    return refused(TeamRefusal.NotFound);
  }
  if (current === OrgRoleName.Owner) {
    return refused(TeamRefusal.OwnerProtected);
  }
  if (!isOrgRole(input.role) || !assignableRoles(actor).includes(input.role)) {
    return refused(TeamRefusal.InvalidRole);
  }

  const noSeat = needsSeat(current) ? null : await seatRefusal(ctx, input.role);
  if (noSeat) {
    return noSeat;
  }

  await setMemberRole(ctx.db, { orgId: ctx.orgId, userId: input.userId, role: input.role });
  return done({ user_id: input.userId, role: input.role });
}

async function remove(ctx: TeamCtx, userId: string): Promise<TeamResult> {
  if (userId === ctx.userId) {
    return refused(TeamRefusal.Self);
  }
  const current = await targetRole(ctx, userId);
  if (!current) {
    return refused(TeamRefusal.NotFound);
  }
  if (current === OrgRoleName.Owner) {
    return refused(TeamRefusal.OwnerProtected);
  }

  await removeMember(ctx.db, { orgId: ctx.orgId, userId });
  return done({ user_id: userId });
}

async function transfer(ctx: TeamCtx, userId: string): Promise<TeamResult> {
  if (userId === ctx.userId) {
    return refused(TeamRefusal.Self);
  }
  if (!(await targetRole(ctx, userId))) {
    return refused(TeamRefusal.NotFound);
  }

  await transferOwnership(ctx.db, { orgId: ctx.orgId, userId });
  return done({ owner: userId });
}

export async function runTeamOp(ctx: TeamCtx, request: TeamRequest): Promise<TeamResult> {
  const actor = await memberRole(ctx.db, { userId: ctx.userId, orgId: ctx.orgId });
  if (!actor) {
    return refused(TeamRefusal.NotMember);
  }
  if (!can(actor, OP_ACTION[request.op])) {
    return refused(TeamRefusal.Forbidden);
  }

  switch (request.op) {
    case TeamOp.Invite:
      return invite(ctx, actor, request);
    case TeamOp.ResendInvite:
      return resend(ctx, request.inviteId);
    case TeamOp.RevokeInvite:
      await revokeInvite(ctx.db, { orgId: ctx.orgId, inviteId: request.inviteId });
      return done();
    case TeamOp.InviteLink:
      return inviteLink(ctx);
    case TeamOp.DisableInviteLink:
      await deleteLinkInvite(ctx.db, ctx.orgId);
      return done();
    case TeamOp.SetRole:
      return setRole(ctx, actor, request);
    case TeamOp.RemoveMember:
      return remove(ctx, request.userId);
    case TeamOp.Leave:
      await removeMember(ctx.db, { orgId: ctx.orgId, userId: ctx.userId });
      return done();
    case TeamOp.TransferOwnership:
      return transfer(ctx, request.userId);
  }
}
