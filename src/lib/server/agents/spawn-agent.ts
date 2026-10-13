import { stepCountIs, streamText, tool, type StepResult, type Tool, type ToolSet, type UserContent } from 'ai';
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

export type ChildAsk = { model: string; system: string; content: UserContent; tools: Record<string, Tool>; budgetUsd: number; steps: number; onStep?: (step: StepResult<ToolSet>) => void };

export type ChildRun = { text: string; usd: number; usage: SdkUsage; steps: StepResult<ToolSet>[] };

export async function runChild(host: Pick<SpawnHost, 'orgId' | 'abort'>, ask: ChildAsk): Promise<ChildRun> {
  const billing = billingScope(host.orgId);
  let estimate = 0;
  const ran = billing.run(() =>
    streamText({
      model: llmLanguageModel(ask.model, PromptCache.On),
      system: ask.system,
      messages: [{ role: 'user', content: ask.content }],
      tools: ask.tools,
      abortSignal: host.abort,
      stopWhen: [stepCountIs(ask.steps), () => Math.max(estimate, billing.gatewayUsd()) > ask.budgetUsd],
      onStepFinish: (step) => {
        estimate += spentUsd([extractSdkUsage(step.usage)], [ask.model], gatewayRate);
        ask.onStep?.(step);
      }
    })
  );
  const text = await ran.text;
  const usage = extractSdkUsage(await ran.totalUsage);
  return { text, usd: Math.max(estimate, billing.gatewayUsd()), usage, steps: await ran.steps };
}

export function spawnAgents(host: SpawnHost, offers: readonly ModelOffer[]) {
  const runner = spawnRunner(
    {
      run: async (plan) => {
        const mark = host.changes();
        const all = host.tools();
        const out = await runChild(host, { model: plan.model, system: CHILD_SYSTEM, content: plan.prompt, tools: Object.fromEntries(plan.tools.map((n) => [n, all[n]])), budgetUsd: plan.budgetUsd, steps: SPAWN_STEPS });
        host.onSpent(out.usd);
        host.log({ label: plan.label, model: plan.model, agentKey: `${SPAWNED_KEY}:${plan.label}`, usage: out.usage });
        return { text: out.text, usd: out.usd, changed: host.changedSince(mark) };
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
