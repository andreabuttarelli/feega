import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { WATERMARK_CLIP_ID } from '@feega/motion-core/motion/watermark';
import { BillingTier } from './billing-tier';
import { EXPORT_MARK, ExportMark, exportMark, watermarked } from './export-watermark';

const ORG = 'org-1';
const doc = newMotionDoc(MotionFormat.Landscape);
const clipIds = (d: typeof doc) => d.tracks.flatMap((t) => t.clips.map((c) => c.id));

describe('which plan exports with the watermark', () => {
  it('marks free, leaves paid clean, from one table', () => {
    expect(EXPORT_MARK).toEqual({ [BillingTier.Free]: ExportMark.Watermarked, [BillingTier.Paid]: ExportMark.Clean });
  });

  it('an org with a subscription exports clean', async () => {
    const { db } = fakeDb({ orgs: [{ id: ORG, stripe_subscription_id: 'sub_1' }] }, { filter: true });

    expect(await exportMark(db, ORG)).toBe(ExportMark.Clean);
  });

  it('an org without a subscription, or an unknown org, exports with the watermark', async () => {
    const { db } = fakeDb({ orgs: [{ id: ORG, stripe_subscription_id: null }] }, { filter: true });

    expect(await exportMark(db, ORG)).toBe(ExportMark.Watermarked);
    expect(await exportMark(db, 'missing')).toBe(ExportMark.Watermarked);
  });
});

describe('watermarked', () => {
  it('adds the watermark to a free org doc and nothing to a paid one', async () => {
    const free = fakeDb({ orgs: [{ id: ORG, stripe_subscription_id: null }] }, { filter: true }).db;
    const paid = fakeDb({ orgs: [{ id: ORG, stripe_subscription_id: 'sub_1' }] }, { filter: true }).db;

    expect(clipIds(await watermarked(free, ORG, doc))).toContain(WATERMARK_CLIP_ID);
    expect(await watermarked(paid, ORG, doc)).toBe(doc);
  });
});
