export const OFFER_PERCENT_OFF = 15;
export const OFFER_WINDOW_MS = 60 * 60 * 1000;

export type PromoCode = { id: string; code: string; expiresAt: number; redeemed: boolean; redemptionTracked: boolean };

export type OfferStore = {
  find: (code: string) => Promise<PromoCode | null>;
  create: (input: { code: string; expiresAt: number; userId: string }) => Promise<PromoCode>;
  markTracked: (id: string) => Promise<void>;
};

export enum OfferState {
  Live = 'live',
  Expired = 'expired',
  Redeemed = 'redeemed'
}

export type PersonalOffer = { promo: PromoCode; state: OfferState; expiresAt: number; created: boolean; newlyRedeemed: boolean };

const CODE_PREFIX = 'FEEGA15';
const CODE_USER_CHARS = 12;

export const offerCode = (userId: string) => `${CODE_PREFIX}${userId.replace(/-/g, '').slice(0, CODE_USER_CHARS).toUpperCase()}`;

function stateOf(promo: PromoCode, now: number): OfferState {
  if (promo.redeemed) {
    return OfferState.Redeemed;
  }
  return now < promo.expiresAt ? OfferState.Live : OfferState.Expired;
}

export async function personalOffer(userId: string, store: OfferStore, now: number): Promise<PersonalOffer> {
  const code = offerCode(userId);
  const found = await store.find(code);
  const promo = found ?? (await store.create({ code, expiresAt: now + OFFER_WINDOW_MS, userId }));
  const state = stateOf(promo, now);

  const newlyRedeemed = state === OfferState.Redeemed && !promo.redemptionTracked;
  if (newlyRedeemed) {
    await store.markTracked(promo.id);
  }

  return { promo, state, expiresAt: promo.expiresAt, created: !found, newlyRedeemed };
}
