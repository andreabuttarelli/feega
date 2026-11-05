import type { Db } from '$lib/server/db/client';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { withWatermark } from '@feega/motion-core/motion/watermark';
import { ExportMark } from '$lib/motion/export-mark';
import { BillingTier, billingTierOf } from './billing-tier';

export { ExportMark };

export const EXPORT_MARK: Readonly<Record<BillingTier, ExportMark>> = {
  [BillingTier.Free]: ExportMark.Watermarked,
  [BillingTier.Paid]: ExportMark.Clean
};

export async function exportMark(db: Db, orgId: string): Promise<ExportMark> {
  return EXPORT_MARK[await billingTierOf(db, orgId)];
}

export async function watermarked(db: Db, orgId: string, doc: MotionDoc): Promise<MotionDoc> {
  return (await exportMark(db, orgId)) === ExportMark.Watermarked ? withWatermark(doc) : doc;
}
