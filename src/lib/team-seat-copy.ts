import type { SeatStatus } from '$lib/server/team/seat-billing';

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
    return `Editors need the plan (€${seats.pricePerEditor} per editor per month). Subscribe, or invite as a viewer: viewers are free.`;
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
  const count = `${seats.editors} editors`;
  return seats.billing === PER_EDITOR ? `${count} · €${seats.pricePerEditor} × ${seats.editors} = €${seats.pricePerEditor * seats.editors} / month` : count;
}

export function planEndNotice(seats: SeatStatus | null, date: (iso: string) => string): string | null {
  if (!seats?.endsAt) {
    return null;
  }
  return `The plan ends on ${date(seats.endsAt)}. Then ${seats.editors - 1} editors become viewers. They keep their access, and the owner can make them editors again once the team pays.`;
}

export function unpaidNotice(seats: SeatStatus | null): string | null {
  return seats?.unpaid
    ? 'The last payment failed and the plan is unpaid. Editors other than the owner are now viewers. The owner can make them editors again once the plan is paid.'
    : null;
}
