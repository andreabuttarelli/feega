import { describe, expect, it } from 'vitest';
import { editorInviteHint, membersLine, paymentNotice, planEndNotice, refusalNotice, transferPrompt, unpaidNotice } from './team-seat-copy';

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

  it('counts one editor in the singular', () => {
    expect(membersLine(seats({ editors: 1 }))).toBe('1 editor · €9 × 1 = €9 / month');
    expect(planEndNotice(seats({ editors: 2, endsAt: '2026-12-13T00:00:00.000Z' }), (d) => d.slice(0, 10))).toContain('Then 1 editor becomes a viewer.');
  });

  it('promises no editor turns viewer when the owner is the only editor', () => {
    expect(planEndNotice(seats({ editors: 1, endsAt: '2026-12-13T00:00:00.000Z' }), (d) => d.slice(0, 10))).toBe('The plan ends on 2026-12-13.');
  });

  it('warns the owner before a transfer to a viewer on a free team makes them a viewer', () => {
    expect(transferPrompt(seats({ billing: 'free', paid: false }), 'viewer', 'sara@client.com')).toBe(
      'Make sara@client.com the owner? Free teams have one editor, so you become a viewer.'
    );
  });

  it('says a transfer to a viewer on a per-editor team adds a paid seat', () => {
    expect(transferPrompt(seats(), 'viewer', 'sara@client.com')).toBe('Make sara@client.com the owner? You become an admin, which adds €9/month.');
  });

  it('keeps the plain prompt when the new owner is already an editor', () => {
    expect(transferPrompt(seats({ billing: 'free', paid: false }), 'member', 'lena@acme.studio')).toBe('Make lena@acme.studio the owner? You become an admin.');
  });

  it('shows a seat refusal as the editor hint, not as an error with a raw path', () => {
    const free = seats({ billing: 'free', paid: false });
    expect(refusalNotice({ error: 'seat_limit', message: 'Free teams have 1 editor. Subscribe (€9 per editor per month, /app/credits)' }, free, true)).toEqual({ tone: 'info', text: editorInviteHint(free, true) });
    expect(refusalNotice({ error: 'billing_only' }, seats(), false)).toEqual({ tone: 'info', text: editorInviteHint(seats(), false) });
  });

  it('names a refusal in words, never by its code', () => {
    expect(refusalNotice({ error: 'already_invited' }, seats(), true)).toEqual({ tone: 'error', text: 'That address already has a pending invite.' });
    expect(refusalNotice({ error: 'something_new' }, seats(), true).text).toBe('Something went wrong.');
  });

  it('tells the owner on the billing page when the payment failed', () => {
    expect(paymentNotice(seats({ pastDue: true }))).toMatch(/past due/i);
    expect(paymentNotice(seats({ unpaid: true }))).toBe(unpaidNotice(seats({ unpaid: true })));
    expect(paymentNotice(seats())).toBeNull();
    expect(paymentNotice(null)).toBeNull();
  });
});
