import {
  CALLS_TO_ACTION,
  GENDERS,
  META_MAX_AGE,
  META_MIN_AGE,
  OBJECTIVES,
  PLACEMENTS,
  type PaidAdDraft
} from './paid-ad';

export const PAID_AD_FIELDS = {
  brandId: 'brand_id',
  adAccountId: 'ad_account_id',
  objective: 'objective',
  budgetType: 'budget_type',
  budgetAmount: 'budget_amount',
  days: 'days',
  country: 'country',
  ageMin: 'age_min',
  ageMax: 'age_max',
  gender: 'gender',
  placement: 'placement',
  primaryText: 'primary_text',
  headline: 'headline',
  callToAction: 'call_to_action',
  linkUrl: 'link_url',
  mediaNodeId: 'media_node_id',
  postId: 'post_id'
} as const;

function pick<T extends { id: string }>(table: readonly T[], raw: string): T['id'] {
  return (table.find((row) => row.id === raw) ?? table[0]).id;
}

export function parsePaidAdForm(fd: FormData): PaidAdDraft {
  const text = (key: string) => String(fd.get(key) ?? '');
  const all = (key: string) => fd.getAll(key).map(String).filter(Boolean);
  const number = (key: string, fallback: number) => {
    const n = Number(text(key));
    return text(key) && Number.isFinite(n) ? n : fallback;
  };
  const placementIds = PLACEMENTS.map((p) => p.id as string);

  return {
    brandId: text(PAID_AD_FIELDS.brandId),
    adAccountId: text(PAID_AD_FIELDS.adAccountId),
    objective: pick(OBJECTIVES, text(PAID_AD_FIELDS.objective)),
    budgetType: text(PAID_AD_FIELDS.budgetType) === 'lifetime' ? 'lifetime' : 'daily',
    budgetAmount: number(PAID_AD_FIELDS.budgetAmount, 0),
    days: number(PAID_AD_FIELDS.days, 0),
    countries: all(PAID_AD_FIELDS.country).map((c) => c.toUpperCase()),
    ageMin: number(PAID_AD_FIELDS.ageMin, META_MIN_AGE),
    ageMax: number(PAID_AD_FIELDS.ageMax, META_MAX_AGE),
    gender: pick(GENDERS, text(PAID_AD_FIELDS.gender)),
    placements: all(PAID_AD_FIELDS.placement).filter((p) => placementIds.includes(p)) as PaidAdDraft['placements'],
    primaryText: text(PAID_AD_FIELDS.primaryText),
    headline: text(PAID_AD_FIELDS.headline),
    callToAction: pick(CALLS_TO_ACTION, text(PAID_AD_FIELDS.callToAction)),
    linkUrl: text(PAID_AD_FIELDS.linkUrl),
    mediaNodeIds: all(PAID_AD_FIELDS.mediaNodeId),
    postId: text(PAID_AD_FIELDS.postId) || null
  };
}

const JSON_LIST_FIELDS: Record<string, string> = {
  countries: PAID_AD_FIELDS.country,
  placements: PAID_AD_FIELDS.placement,
  node_ids: PAID_AD_FIELDS.mediaNodeId
};

export function parsePaidAdJson(body: Record<string, unknown>): PaidAdDraft {
  const fd = new FormData();
  for (const [key, value] of Object.entries(body)) {
    if (Array.isArray(value)) {
      value.forEach((item) => fd.append(JSON_LIST_FIELDS[key] ?? key, String(item)));
      continue;
    }
    if (value !== undefined && value !== null) {
      fd.set(key, String(value));
    }
  }
  return parsePaidAdForm(fd);
}
