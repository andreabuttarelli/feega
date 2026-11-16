import { BillingUnavailableError } from '$lib/billing/contract';
import { getBrandContext, getOrgContext, isCreditExempt } from '$lib/server/ai-log';
import { swallow } from '$lib/server/swallow';

export enum Gate {
  Chokepoint = 'calls spendGate (or the credit gate) itself before the provider',
  Hold = 'holds the quoted credits atomically before the provider',
  ViaLlm = 'spends only through llm.ts, whose every request is gated',
  Entry = 'reached only from a route or agent turn that gates first, and whose model steps pass llm.ts',
  HousePaid = 'paid by feega, never billed to the user',
  Free = 'records an internal event, no provider money'
}

export const SPEND_SITES: Record<string, Gate> = {
  'src/lib/server/llm.ts': Gate.Chokepoint,
  'src/lib/server/openrouter-image.ts': Gate.Chokepoint,
  'src/lib/server/openrouter-images-api.ts': Gate.Chokepoint,
  'src/lib/server/openrouter-video.ts': Gate.Chokepoint,
  'src/lib/server/video.ts': Gate.Chokepoint,
  'src/lib/server/scrapecreators.ts': Gate.Chokepoint,
  'src/lib/server/canvas/audio-run.ts': Gate.Chokepoint,
  'src/lib/server/code-import/canvas-import.ts': Gate.Chokepoint,
  'src/lib/server/motion/render-run.ts': Gate.Hold,
  'src/lib/server/knowledge.ts': Gate.ViaLlm,
  'src/lib/server/task-providers-config.ts': Gate.Entry,
  'src/lib/server/voices/voices-config.ts': Gate.Entry,
  'src/lib/server/web/live.ts': Gate.Entry,
  'src/lib/server/motion/turn.ts': Gate.Entry,
  'src/lib/server/project-agent/turn.ts': Gate.Entry,
  'src/lib/server/moderation/moderation-config.ts': Gate.HousePaid,
  'src/lib/server/brand-data/query-tool.ts': Gate.Free,
  'src/lib/server/brand-data/write-tool.ts': Gate.Free,
  'src/lib/server/org-data/query-tool.ts': Gate.Free,
  'src/lib/server/org-data/write-tool.ts': Gate.Free
};

export type Payer = { brandId?: string | null; orgId?: string | null };

export async function spendGate(payer: Payer = {}): Promise<void> {
  if (isCreditExempt()) {
    return;
  }
  const { billingProvider } = await import('$lib/server/billing');
  if ((await billingProvider()).kind === 'open') {
    return;
  }

  const brandId = payer.brandId ?? (payer.orgId ? null : getBrandContext());
  const orgId = payer.orgId ?? getOrgContext();
  const { gateCredits, gateOrgCredits } = await import('$lib/server/credits');
  if (brandId) {
    return gateCredits(brandId);
  }
  if (orgId) {
    return gateOrgCredits(orgId);
  }

  const refused = new BillingUnavailableError('provider call with no payer in scope');
  swallow('spend: provider call with no payer in scope, refused', refused);
  throw refused;
}
