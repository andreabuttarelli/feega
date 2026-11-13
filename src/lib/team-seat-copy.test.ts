import { describe, expect, it } from 'vitest';
import { editorInviteHint, membersLine, planEndNotice, unpaidNotice } from './team-seat-copy';

const seats = (extra: Record<string, unknown> = {}) => ({ editors: 3, paid: true, billing: 'per_editor', pastDue: false, unpaid: false, grandfathered: false, endsAt: null, pricePerEditor: 9, ...extra }) as never;

describe('what the team page says about editor seats', () => {
  it('tells the owner of a per-editor team what the new editor costs, and when', () => {
    expect(editorInviteHint(seats(), true)).toBe('Adds €9/month when they accept, prorated for the rest of this period.');
  });

  it('tells an admin only the owner adds a paid editor', () => {
    expect(editorInviteHint(seats(), false)).toMatch(/only the owner/i);
  });

  it('never quotes a per-editor price to a team on a retired per-team plan', () => {
    expect(editorInviteHint(seats({ billing: 'legacy' }), true)).not.toMatch(/€9/);
  });

  it('says a past-due team adds no editor until it pays', () => {
    expect(editorInviteHint(seats({ pastDue: true }), true)).toMatch(/past due/i);
  });

  it('says an unpaid plan adds no editor, and says exactly what happened to the editors', () => {
    expect(editorInviteHint(seats({ unpaid: true }), true)).toMatch(/unpaid/i);
    expect(unpaidNotice(seats({ unpaid: true }))).toBe(
      'The last payment failed and the plan is unpaid. Editors other than the owner are now viewers. The owner can make them editors again once the plan is paid.'
    );
    expect(unpaidNotice(seats())).toBeNull();
  });

  it('says editors cannot be added while seat state is unknown', () => {
    expect(editorInviteHint(null, true)).toMatch(/cannot be added/i);
  });

  it('names the monthly total only for a per-editor team', () => {
    expect(membersLine(seats())).toBe('3 editors · €9 × 3 = €27 / month');
    expect(membersLine(seats({ billing: 'legacy' }))).toBe('3 editors');
  });

  it('promises only what happens at the end of a cancelled plan', () => {
    expect(planEndNotice(seats({ endsAt: '2026-12-13T00:00:00.000Z' }), (d) => d.slice(0, 10))).toBe(
      'The plan ends on 2026-12-13. Then 2 editors become viewers. They keep their access, and the owner can make them editors again once the team pays.'
    );
  });
});
