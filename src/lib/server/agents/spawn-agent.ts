import { stepCountIs, streamText, tool, type Tool } from 'ai';
import { llmLanguageModel } from '$lib/server/llm';
import { PromptCache } from '$lib/server/prompt-cache';
import { billingScope, extractSdkUsage, type SdkUsage } from '$lib/server/ai-log';
import { gatewayModels, gatewayRate } from '$lib/server/openrouter-models';
import { spentUsd } from '$lib/server/motion/model-route';
import { SPAWN_GUIDE, SPAWNED_KEY, SpawnDepth, spawnInput, spawnPlan, spawnRunner, type ModelOffer, type SpawnInput, type SpawnResult } from './spawn';

const SPAWN_STEPS = 30;
const CHILD_SYSTEM = 'You are a sub-agent with one job. Do the job with the tools you have, then answer plainly with what you found or changed. You cannot ask the user anything.';

export type SpawnHost = {
  orgId: string;
  tools: () => Record<string, Tool>;
  codeTools: ReadonlySet<string>;
  visionTools: ReadonlySet<string>;
  remainingUsd: () => number;
  onSpent: (usd: number) => void;
  changes: () => number;
  changedSince: (mark: number) => string[];
  log: (entry: { label: string; model: string; agentKey: string; usage: SdkUsage }) => void;
  abort?: AbortSignal;
};

export const spawnOffers = (): ModelOffer[] =>
  gatewayModels()
    .filter((m) => m.tools)
    .map((m) => ({ id: m.id, inputUsdPerM: m.rate.input, outputUsdPerM: m.rate.output, vision: m.usable }));

export function spawnAgents(host: SpawnHost, offers: readonly ModelOffer[]) {
  const runner = spawnRunner(
    {
      run: async (plan) => {
        const mark = host.changes();
        const billing = billingScope(host.orgId);
        let estimate = 0;
        const all = host.tools();
        const ran = billing.run(() =>
          streamText({
            model: llmLanguageModel(plan.model, PromptCache.On),
            system: CHILD_SYSTEM,
            messages: [{ role: 'user', content: plan.prompt }],
            tools: Object.fromEntries(plan.tools.map((n) => [n, all[n]])),
            abortSignal: host.abort,
            stopWhen: [stepCountIs(SPAWN_STEPS), () => Math.max(estimate, billing.gatewayUsd()) > plan.budgetUsd],
            onStepFinish: (step) => {
              estimate += spentUsd([extractSdkUsage(step.usage)], [plan.model], gatewayRate);
            }
          })
        );
        const text = await ran.text;
        const usage = extractSdkUsage(await ran.totalUsage);
        const usd = Math.max(estimate, billing.gatewayUsd());
        host.onSpent(usd);
        host.log({ label: plan.label, model: plan.model, agentKey: `${SPAWNED_KEY}:${plan.label}`, usage });
        return { text, usd, changed: host.changedSince(mark) };
      }
    },
    host.remainingUsd
  );

  return async (input: SpawnInput): Promise<SpawnResult> => {
    const plan = spawnPlan(input, { tools: Object.keys(host.tools()), codeTools: host.codeTools, visionTools: host.visionTools, catalogue: offers, depth: SpawnDepth.Parent, remainingUsd: host.remainingUsd() - runner.reservedUsd() });
    return plan.ok ? runner.spawn(plan) : plan;
  };
}

export function spawnAgentTool(offers: readonly ModelOffer[], run: (input: SpawnInput) => Promise<SpawnResult>): Tool {
  const prices = offers.map((m) => `${m.id} $${m.inputUsdPerM}/$${m.outputUsdPerM}${m.vision ? '' : ' (no images)'}`).join('; ');
  return tool({
    description: `${SPAWN_GUIDE} Returns its final text, what it cost and the edits it made. Models and prices per million tokens (in/out): ${prices}. kind picks the model when you name none. budget_usd comes out of this turn's budget.`,
    inputSchema: spawnInput,
    execute: async (input) => run(input)
  });
}
