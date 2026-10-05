import { findClip, type MotionDoc } from '$lib/motion/doc';
import type { TokenUsage } from './frames';

export enum Tier {
  Edit = 'edit',
  Code = 'code'
}

export const WRITE_COMPONENT = 'write_component';
export const PATCH_COMPONENT = 'patch_component';
export const READ_COMPONENT = 'read_component';

export const toolsWritingCode: ReadonlySet<string> = new Set([WRITE_COMPONENT, PATCH_COMPONENT]);

const FORCES_VIEW: Record<Tier, boolean> = { [Tier.Edit]: true, [Tier.Code]: false };

export function selfCheckChoice(input: { tier: Tier; reasoning: string | null }): { toolChoice?: { type: 'tool'; toolName: string } } {
  return FORCES_VIEW[input.tier] && !input.reasoning ? { toolChoice: { type: 'tool', toolName: 'view_frames' } } : {};
}
const CODE_TOOLS: ReadonlySet<string> = new Set([...toolsWritingCode, READ_COMPONENT]);

const CODE_INTENT = /\b(code|components?|custom|animated|animation|ui|interface|scenes?|mock-?ups?|trailer|promo|chat panel|calendar|cursors?|node graph|typing)\b/i;

const MILLION = 1_000_000;

export const MOTION_TURN_CAP_USD = 1.5;

type Opening = { message: string; doc: MotionDoc; selection: string[] };

export function openingTier(input: Opening): Tier {
  const customSelected = input.selection.some((id) => findClip(input.doc, id)?.clip.component === 'Custom');
  return customSelected || CODE_INTENT.test(input.message) ? Tier.Code : Tier.Edit;
}

export function stepTier(opening: Tier, steps: readonly (readonly { toolName: string }[])[]): Tier {
  const readCode = steps.some((calls) => calls.some((c) => CODE_TOOLS.has(c.toolName)));
  return readCode ? Tier.Code : opening;
}

export function activeTools(tier: Tier, names: readonly string[]): string[] {
  return tier === Tier.Code ? [...names] : names.filter((n) => !toolsWritingCode.has(n));
}

type Rate = { input: number; cachedInput: number; output: number };

export function spentUsd(usages: readonly TokenUsage[], models: readonly string[], rateOf: (model: string) => Rate | null): number {
  return usages.reduce((sum, usage, i) => {
    const rate = rateOf(models[i]);
    if (!rate) {
      return sum;
    }
    const cached = usage.cachedTokens ?? 0;
    const fresh = Math.max(0, (usage.inputTokens ?? 0) - cached);
    return sum + (fresh * rate.input + cached * rate.cachedInput + (usage.outputTokens ?? 0) * rate.output) / MILLION;
  }, 0);
}
