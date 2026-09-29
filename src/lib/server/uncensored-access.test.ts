import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import {
  disableUncensored,
  enableUncensored,
  uncensoredAccess,
  UNCENSORED_ENTITLEMENT,
  UNCENSORED_POLICY_VERSION,
  visibleChoices
} from './uncensored-access';

const ORG = 'org-1';
const OWNER = 'user-owner';
const MEMBER = 'user-member';

const paidOrg = { id: ORG, stripe_subscription_id: 'sub_1' };
const freeOrg = { id: ORG, stripe_subscription_id: null };
const members = [
  { org_id: ORG, user_id: OWNER, role: 'owner' },
  { org_id: ORG, user_id: MEMBER, role: 'member' }
];
const optIn = { org_id: ORG, enabled_by: OWNER, enabled_at: '2026-09-29T10:00:00Z', disabled_at: null };

describe('who may use uncensored models', () => {
  it('is off by default, even on a paid plan', async () => {
    const { db } = fakeDb({ orgs: [paidOrg], org_uncensored_optins: [] }, { filter: true });
    expect(await uncensoredAccess(db, ORG)).toMatchObject({ allowed: false, reason: 'not_opted_in', entitled: true });
  });

  it('is on once the owner opted in on a paid plan', async () => {
    const { db } = fakeDb({ orgs: [paidOrg], org_uncensored_optins: [optIn] }, { filter: true });
    expect(await uncensoredAccess(db, ORG)).toMatchObject({
      allowed: true,
      reason: 'enabled',
      optIn: { enabledBy: OWNER, enabledAt: '2026-09-29T10:00:00Z' }
    });
  });

  it('stays off on a free plan even with a recorded opt-in', async () => {
    const { db } = fakeDb({ orgs: [freeOrg], org_uncensored_optins: [optIn] }, { filter: true });
    expect(await uncensoredAccess(db, ORG)).toMatchObject({ allowed: false, reason: 'plan_not_entitled' });
  });

  it('is off after the owner turned it back off', async () => {
    const { db } = fakeDb({ orgs: [paidOrg], org_uncensored_optins: [{ ...optIn, disabled_at: '2026-09-29T11:00:00Z' }] }, { filter: true });
    expect(await uncensoredAccess(db, ORG)).toMatchObject({ allowed: false, reason: 'not_opted_in' });
  });

  it('entitles paid plans only, from one table', () => {
    expect(UNCENSORED_ENTITLEMENT).toEqual({ free: false, paid: true });
  });
});

describe('turning uncensored models on', () => {
  const confirm = { attestedAdult: true, acceptedPolicy: true };

  it('records who and when, with the policy version, for the owner of a paid org', async () => {
    const { db, calls } = fakeDb({ orgs: [paidOrg], orgs_members: members }, { filter: true });
    expect(await enableUncensored(db, { orgId: ORG, userId: OWNER, ...confirm })).toEqual({ ok: true });

    const write = calls.find((c) => c.table === 'org_uncensored_optins' && c.op === 'upsert');
    expect(write?.payload).toMatchObject({
      org_id: ORG,
      enabled_by: OWNER,
      attested_adult: true,
      policy_version: UNCENSORED_POLICY_VERSION,
      disabled_at: null
    });
  });

  it('refuses a member who is not the owner', async () => {
    const { db, calls } = fakeDb({ orgs: [paidOrg], orgs_members: members }, { filter: true });
    expect(await enableUncensored(db, { orgId: ORG, userId: MEMBER, ...confirm })).toEqual({ ok: false, error: 'owner_only' });
    expect(calls.some((c) => c.table === 'org_uncensored_optins')).toBe(false);
  });

  it('refuses without the 18+ attestation and the policy', async () => {
    const { db } = fakeDb({ orgs: [paidOrg], orgs_members: members }, { filter: true });
    expect(await enableUncensored(db, { orgId: ORG, userId: OWNER, attestedAdult: false, acceptedPolicy: true })).toEqual({
      ok: false,
      error: 'confirmation_required'
    });
  });

  it('refuses a free plan', async () => {
    const { db } = fakeDb({ orgs: [freeOrg], orgs_members: members }, { filter: true });
    expect(await enableUncensored(db, { orgId: ORG, userId: OWNER, ...confirm })).toEqual({ ok: false, error: 'plan_not_entitled' });
  });

  it('turning it off records who', async () => {
    const { db, calls } = fakeDb({ orgs: [paidOrg], orgs_members: members, org_uncensored_optins: [optIn] }, { filter: true });
    expect(await disableUncensored(db, { orgId: ORG, userId: OWNER })).toEqual({ ok: true });
    expect(calls.find((c) => c.table === 'org_uncensored_optins' && c.op === 'update')?.payload).toMatchObject({ disabled_by: OWNER });
  });
});

describe('the model menu an org sees', () => {
  const choices = [{ id: 'safe' }, { id: 'raw', uncensored: true }];

  it('hides uncensored models until access is allowed', () => {
    expect(visibleChoices(choices, { allowed: false }).map((c) => c.id)).toEqual(['safe']);
    expect(visibleChoices(choices, { allowed: true }).map((c) => c.id)).toEqual(['safe', 'raw']);
  });
});
