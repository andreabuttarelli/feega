import { describe, expect, it } from 'vitest';
import { editorSeatsLeft, SEAT_LIMITS, SeatPlan } from '$lib/server/team/seats';

describe('i posti da editor', () => {
  it("un'org gratuita ha un numero di editor limitato, i viewer non contano", () => {
    const members = ['owner', 'member', 'viewer', 'viewer'] as const;

    expect(editorSeatsLeft(SeatPlan.Free, { members: [...members], pendingInviteRoles: [] })).toBe(SEAT_LIMITS[SeatPlan.Free] - 2);
  });

  it('gli inviti in sospeso da editor occupano un posto', () => {
    expect(editorSeatsLeft(SeatPlan.Free, { members: ['owner'], pendingInviteRoles: ['member', 'viewer'] })).toBe(SEAT_LIMITS[SeatPlan.Free] - 2);
  });

  it("un'org che paga non ha limite", () => {
    expect(editorSeatsLeft(SeatPlan.Paid, { members: Array(50).fill('member'), pendingInviteRoles: [] })).toBe(Infinity);
  });
});
