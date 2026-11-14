import type { SeatStatus } from '$lib/server/team/seat-billing';
import { EDITOR_ROLES, type OrgRole } from '$lib/org-roles';

const PER_EDITOR = 'per_editor';
const LEGACY = 'legacy';
const FREE = 'free';

export function editorInviteHint(seats: SeatStatus | null, mayBill: boolean): string {
  if (!seats || (seats.paid && seats.billing !== PER_EDITOR && seats.billing !== LEGACY)) {
    return 'Billing state is unavailable right now, so editors cannot be added. Viewers are free.';
  }
  if (seats.unpaid) {
    return 'The plan is unpaid: editors can be added again once it is paid. Viewers are free.';
  }
  if (seats.pastDue) {
    return "The team's payment is past due: editors can be added again once it is paid. Viewers are free.";
  }
  if (seats.billing === FREE) {
    return `Editors need the plan (€${seats.pricePerEditor} per editor per month); viewers are free.`;
  }
  if (seats.billing === LEGACY) {
    return 'Your plan includes editors at no extra charge.';
  }
  if (!mayBill) {
    return 'An editor is a paid seat: only the owner can add one. You can invite viewers for free.';
  }
  return `Adds €${seats.pricePerEditor}/month when they accept, prorated for the rest of this period.`;
}

export function membersLine(seats: SeatStatus | null): string {
  if (!seats) {
    return '';
  }
  const count = editorsOf(seats.editors);
  return seats.billing === PER_EDITOR ? `${count} · €${seats.pricePerEditor} × ${seats.editors} = €${seats.pricePerEditor * seats.editors} / month` : count;
}

export function planEndNotice(seats: SeatStatus | null, date: (iso: string) => string): string | null {
  if (!seats?.endsAt) {
    return null;
  }
  const ends = `The plan ends on ${date(seats.endsAt)}.`;
  const demoted = seats.editors - 1;
  if (!demoted) {
    return ends;
  }
  const become = demoted === 1 ? '1 editor becomes a viewer' : `${demoted} editors become viewers`;
  return `${ends} Then ${become}. They keep their access, and the owner can make them editors again once the team pays.`;
}

export function unpaidNotice(seats: SeatStatus | null): string | null {
  return seats?.unpaid
    ? 'The last payment failed and the plan is unpaid. Editors other than the owner are now viewers. The owner can make them editors again once the plan is paid.'
    : null;
}

export const PAST_DUE_NOTICE = "The last payment didn't go through and the plan is past due. Update the payment method to keep the editors.";

export function paymentNotice(seats: SeatStatus | null): string | null {
  if (seats?.pastDue) {
    return PAST_DUE_NOTICE;
  }
  return unpaidNotice(seats);
}

export function editorsOf(count: number): string {
  return count === 1 ? '1 editor' : `${count} editors`;
}

const STAYS_EDITOR: Record<string, (seats: SeatStatus) => string> = {
  [PER_EDITOR]: (seats) => `You become an admin, which adds €${seats.pricePerEditor}/month.`,
  [LEGACY]: () => 'You become an admin.'
};

const BECOMES_VIEWER = 'Free teams have one editor, so you become a viewer.';
const PAYMENT_DUE_VIEWER = 'The plan is not paid, so you become a viewer.';

export function transferPrompt(seats: SeatStatus | null, target: OrgRole, who: string): string {
  const ask = `Make ${who} the owner?`;
  if (EDITOR_ROLES.includes(target)) {
    return `${ask} You become an admin.`;
  }
  if (seats?.pastDue || seats?.unpaid) {
    return `${ask} ${PAYMENT_DUE_VIEWER}`;
  }
  const stays = seats ? STAYS_EDITOR[seats.billing] : undefined;
  return `${ask} ${stays ? stays(seats!) : BECOMES_VIEWER}`;
}

export type RefusalNotice = { tone: 'info' | 'error'; text: string };

const SEAT_REFUSALS = new Set(['seat_limit', 'billing_only']);

const REFUSAL_TEXT: Record<string, string> = {
  not_member: 'You are no longer in this team.',
  forbidden: "Your role can't do that.",
  invalid_email: 'That email address is not valid.',
  invalid_role: "That role can't be given from here.",
  already_invited: 'That address already has a pending invite.',
  already_member: 'That person is already in the team.',
  not_found: 'That member or invite no longer exists.',
  owner_protected: "The owner's role can't be changed.",
  self: "You can't do that to yourself."
};

export function refusalNotice(body: Record<string, unknown>, seats: SeatStatus | null, mayBill: boolean): RefusalNotice {
  const code = String(body.error ?? '');
  if (SEAT_REFUSALS.has(code)) {
    return { tone: 'info', text: editorInviteHint(seats, mayBill) };
  }
  return { tone: 'error', text: REFUSAL_TEXT[code] ?? 'Something went wrong.' };
}
