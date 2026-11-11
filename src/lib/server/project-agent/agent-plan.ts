import type { ChatModelChoice } from '$lib/chat-model';
import { turnModel, Pick } from '$lib/server/project-agent/model-route';

export enum AgentTier {
  Free = 'free',
  Paid = 'paid'
}

export enum ModelSource {
  Plan = 'plan',
  Asked = 'asked'
}

export type AgentPlan = { model: string; source: ModelSource; turnCap: number | null };

export const FREE_AGENT_TURNS = 20;

export const AGENT_PLANS: Record<AgentTier, AgentPlan> = {
  [AgentTier.Free]: { model: 'anthropic/claude-haiku-4.5', source: ModelSource.Plan, turnCap: FREE_AGENT_TURNS },
  [AgentTier.Paid]: { model: 'anthropic/claude-opus-5.5', source: ModelSource.Asked, turnCap: null }
};

export function tierOf(creditDenial: Response | null | undefined): AgentTier {
  return creditDenial ? AgentTier.Free : AgentTier.Paid;
}

export function capReached(plan: AgentPlan, turns: number): boolean {
  return plan.turnCap !== null && turns >= plan.turnCap;
}

const CHOOSE: Record<ModelSource, (plan: AgentPlan, choice: ChatModelChoice, pick: Pick, text: string) => ChatModelChoice> = {
  [ModelSource.Plan]: (plan) => ({ model: plan.model, reasoning: null }),
  [ModelSource.Asked]: (plan, choice, pick, text) => turnModel(pick === Pick.Auto ? { ...choice, model: plan.model } : choice, pick, text)
};

export function planModel(plan: AgentPlan, choice: ChatModelChoice, pick: Pick, text: string): ChatModelChoice {
  return CHOOSE[plan.source](plan, choice, pick, text);
}
