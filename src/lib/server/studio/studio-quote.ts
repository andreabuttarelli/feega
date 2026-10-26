import type { Quote } from './studio-batch';
import { SHOTS } from '$lib/studio/shots';
import { SKIP_TEXT } from '$lib/studio/plan';

export type QuoteSummary = {
  count: number;
  overLimit: boolean;
  perImage: number;
  total: number;
  droppedRefs: number;
  skipped: string[];
};

export function summarize(quote: Quote): QuoteSummary {
  const count = quote.plan.items.length;
  return {
    count,
    overLimit: quote.plan.overLimit,
    perImage: quote.model.credits,
    total: quote.model.credits * count,
    droppedRefs: quote.droppedRefs,
    skipped: quote.plan.skipped.map((s) => `${s.productTitle} · ${SHOTS[s.shot].label}: ${SKIP_TEXT[s.reason]}`)
  };
}
