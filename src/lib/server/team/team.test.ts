import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { listTeam, runTeamOp, TeamOp, TeamRefusal, type TeamCtx } from '$lib/server/team/team';
import { LINK_INVITE_EMAIL } from '$lib/server/repos/invites';

const ORG = 'org-1';
const OWNER = 'u-owner';
const ADMIN = 'u-admin';
const MEMBER = 'u-member';
const VIEWER = 'u-viewer';

const memberRow = (user_id: string, role: string) => ({
  org_id: ORG,
  user_id,
  role,
  created_at: '2026-01-01T00:00:00Z',
  profiles: { email: `${user_id}@x.it`, name: null }
});

const inviteRow = (id: string, email: string, role = 'member') => ({
  id,
  org_id: ORG,
  email,
  role,
  token: 'h',
  expires_at: '2099-01-01T00:00:00Z',
  accepted_at: null,
  created_at: '2026-01-01T00:00:00Z'
});

function ctxFor(userId: string, extra: Record<string, unknown[]> = {}) {
  const { db, calls } = fakeDb(
    {
      orgs_members: [memberRow(OWNER, 'owner'), memberRow(ADMIN, 'admin'), memberRow(MEMBER, 'member'), memberRow(VIEWER, 'viewer')],
      orgs_invites: [],
      orgs: [{ id: ORG, name: 'Acme', slug: 'acme' }],
      ...extra
    },
    { filter: true }
  );
  const mail = vi.fn(async () => true);
  const rpc = vi.fn(async () => ({ data: null, error: null }));
  Object.assign(db, { rpc });
  const ctx: TeamCtx = { db, userId, orgId: ORG, origin: 'https://feega.app', mail };
  return { ctx, calls, mail, rpc };
}

const written = (calls: { table: string; op: string }[], table: string, op: string) => calls.filter((c) => c.table === table && c.op === op);

describe('invitare', () => {
  it('un admin invita per email con un ruolo, e parte la mail con il link', async () => {
    const { ctx, calls, mail } = ctxFor(ADMIN, { orgs_invites: [] });

    const result = await runTeamOp(ctx, { op: TeamOp.Invite, email: 'New@X.it', role: 'viewer' });

    expect(result.ok).toBe(true);
    expect(written(calls, 'orgs_invites', 'insert')[0]).toMatchObject({ payload: expect.objectContaining({ email: 'new@x.it', role: 'viewer', org_id: ORG }) });
    expect(mail).toHaveBeenCalledWith(expect.objectContaining({ to: 'new@x.it', orgName: 'Acme' }));
  });

  it('un member non invita', async () => {
    const { ctx, calls } = ctxFor(MEMBER);

    expect(await runTeamOp(ctx, { op: TeamOp.Invite, email: 'a@b.it', role: 'member' })).toEqual({ ok: false, refusal: TeamRefusal.Forbidden });
    expect(written(calls, 'orgs_invites', 'insert')).toHaveLength(0);
  });

  it('nessuno invita come owner', async () => {
    const { ctx } = ctxFor(OWNER);

    expect(await runTeamOp(ctx, { op: TeamOp.Invite, email: 'a@b.it', role: 'owner' })).toEqual({ ok: false, refusal: TeamRefusal.InvalidRole });
  });

  it('una email non valida non diventa un invito', async () => {
    const { ctx } = ctxFor(OWNER);

    expect(await runTeamOp(ctx, { op: TeamOp.Invite, email: 'nope', role: 'member' })).toEqual({ ok: false, refusal: TeamRefusal.InvalidEmail });
  });

  it('chi è già membro non si reinvita', async () => {
    const { ctx } = ctxFor(OWNER);

    expect(await runTeamOp(ctx, { op: TeamOp.Invite, email: `${MEMBER}@x.it`, role: 'member' })).toEqual({ ok: false, refusal: TeamRefusal.AlreadyMember });
  });

  it('reinviare rinnova il token e rimanda la mail', async () => {
    const { ctx, calls, mail } = ctxFor(ADMIN, { orgs_invites: [inviteRow('i1', 'p@x.it')] });

    const result = await runTeamOp(ctx, { op: TeamOp.ResendInvite, inviteId: 'i1' });

    expect(result.ok).toBe(true);
    expect(written(calls, 'orgs_invites', 'update')[0].payload).toEqual(expect.objectContaining({ token: expect.any(String), expires_at: expect.any(String) }));
    expect(mail).toHaveBeenCalledWith(expect.objectContaining({ to: 'p@x.it' }));
  });

  it('revocare cancella l invito di questa org', async () => {
    const { ctx, calls } = ctxFor(ADMIN, { orgs_invites: [inviteRow('i1', 'p@x.it')] });

    await runTeamOp(ctx, { op: TeamOp.RevokeInvite, inviteId: 'i1' });

    expect(written(calls, 'orgs_invites', 'delete')[0].filters).toEqual(expect.arrayContaining([['id', 'i1'], ['org_id', ORG]]));
  });

  it('il link d invito entra come viewer, e rifarlo spegne il vecchio', async () => {
    const { ctx, calls } = ctxFor(ADMIN, { orgs_invites: [inviteRow('old', LINK_INVITE_EMAIL, 'viewer')] });

    const result = await runTeamOp(ctx, { op: TeamOp.InviteLink });

    expect(result).toMatchObject({ ok: true, data: { url: expect.stringContaining('https://feega.app/login?invite_token=') } });
    expect(written(calls, 'orgs_invites', 'delete')[0].filters).toEqual(expect.arrayContaining([['email', LINK_INVITE_EMAIL], ['org_id', ORG]]));
    expect(written(calls, 'orgs_invites', 'insert')[0].payload).toEqual(expect.objectContaining({ email: LINK_INVITE_EMAIL, role: 'viewer' }));
  });
});

describe('i membri', () => {
  it('un admin cambia il ruolo di un member', async () => {
    const { ctx, calls } = ctxFor(ADMIN);

    expect((await runTeamOp(ctx, { op: TeamOp.SetRole, userId: MEMBER, role: 'viewer' })).ok).toBe(true);
    expect(written(calls, 'orgs_members', 'update')[0]).toMatchObject({ payload: { role: 'viewer' } });
  });

  it("il ruolo dell'owner non si tocca", async () => {
    const { ctx, calls } = ctxFor(ADMIN);

    expect(await runTeamOp(ctx, { op: TeamOp.SetRole, userId: OWNER, role: 'member' })).toEqual({ ok: false, refusal: TeamRefusal.OwnerProtected });
    expect(written(calls, 'orgs_members', 'update')).toHaveLength(0);
  });

  it("l'owner non si rimuove", async () => {
    const { ctx } = ctxFor(ADMIN);

    expect(await runTeamOp(ctx, { op: TeamOp.RemoveMember, userId: OWNER })).toEqual({ ok: false, refusal: TeamRefusal.OwnerProtected });
  });

  it('un admin rimuove un viewer', async () => {
    const { ctx, calls } = ctxFor(ADMIN);

    expect((await runTeamOp(ctx, { op: TeamOp.RemoveMember, userId: VIEWER })).ok).toBe(true);
    expect(written(calls, 'orgs_members', 'delete')[0].filters).toEqual(expect.arrayContaining([['user_id', VIEWER], ['org_id', ORG]]));
  });

  it('un viewer non rimuove nessuno', async () => {
    const { ctx } = ctxFor(VIEWER);

    expect(await runTeamOp(ctx, { op: TeamOp.RemoveMember, userId: MEMBER })).toEqual({ ok: false, refusal: TeamRefusal.Forbidden });
  });

  it("chi non è owner può lasciare l'org", async () => {
    const { ctx, calls } = ctxFor(MEMBER);

    expect((await runTeamOp(ctx, { op: TeamOp.Leave })).ok).toBe(true);
    expect(written(calls, 'orgs_members', 'delete')[0].filters).toEqual(expect.arrayContaining([['user_id', MEMBER]]));
  });

  it("l'owner prima trasferisce, poi lascia", async () => {
    const { ctx } = ctxFor(OWNER);

    expect(await runTeamOp(ctx, { op: TeamOp.Leave })).toEqual({ ok: false, refusal: TeamRefusal.Forbidden });
  });

  it("solo l'owner trasferisce, e lo fa in un colpo solo", async () => {
    const owner = ctxFor(OWNER);
    expect((await runTeamOp(owner.ctx, { op: TeamOp.TransferOwnership, userId: ADMIN })).ok).toBe(true);
    expect(owner.rpc).toHaveBeenCalledWith('transfer_org_ownership', { p_org: ORG, p_to: ADMIN });

    const admin = ctxFor(ADMIN);
    expect(await runTeamOp(admin.ctx, { op: TeamOp.TransferOwnership, userId: MEMBER })).toEqual({ ok: false, refusal: TeamRefusal.Forbidden });
  });
});

describe('la squadra', () => {
  it('un non-membro non vede niente', async () => {
    const { ctx } = ctxFor('stranger');

    expect(await listTeam(ctx)).toBeNull();
  });

  it('elenca membri e inviti in sospeso, senza il link', async () => {
    const { ctx } = ctxFor(OWNER, { orgs_invites: [inviteRow('i1', 'p@x.it'), inviteRow('l', LINK_INVITE_EMAIL, 'viewer')] });

    const team = await listTeam(ctx);

    expect(team?.role).toBe('owner');
    expect(team?.members).toHaveLength(4);
    expect(team?.invites.map((i) => i.email)).toEqual(['p@x.it']);
    expect(team?.linkActive).toBe(true);
  });
});
