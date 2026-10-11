import { z } from 'zod';

export const OPUS = 'anthropic/claude-opus-5.5';
export const SONNET = 'anthropic/claude-sonnet-5.5';
export const HAIKU = 'anthropic/claude-haiku-4.5';

export const SPAWN_AGENT = 'spawn_agent';
export const MAX_SPAWN_PARALLEL = 3;
export const SPAWNED_KEY = 'spawned';

export enum SpawnDepth {
  Parent = 'parent',
  Child = 'child'
}

export enum TaskKind {
  Visual = 'visual',
  Code = 'code',
  Reasoning = 'reasoning',
  Mechanical = 'mechanical',
  Reading = 'reading',
  Extraction = 'extraction',
  Simple = 'simple'
}

export const KIND_MODEL: Record<TaskKind, string> = {
  [TaskKind.Visual]: OPUS,
  [TaskKind.Code]: OPUS,
  [TaskKind.Reasoning]: OPUS,
  [TaskKind.Mechanical]: SONNET,
  [TaskKind.Reading]: SONNET,
  [TaskKind.Extraction]: SONNET,
  [TaskKind.Simple]: HAIKU
};

export type ModelOffer = { id: string; inputUsdPerM: number; outputUsdPerM: number; vision: boolean };

export const spawnInput = z.object({
  prompt: z.string().trim().min(10).max(8000),
  label: z.string().trim().min(1).max(40).optional(),
  kind: z.enum(TaskKind).optional(),
  tools: z.array(z.string()).max(60).optional(),
  model: z.string().optional(),
  budget_usd: z.number().positive().max(5)
});

export type SpawnInput = z.input<typeof spawnInput>;

export type SpawnCaller = { tools: readonly string[]; codeTools: ReadonlySet<string>; visionTools: ReadonlySet<string>; catalogue: readonly ModelOffer[]; depth: SpawnDepth; remainingUsd: number };

export type SpawnPlan = { ok: true; prompt: string; label: string; model: string; tools: string[]; budgetUsd: number } | { ok: false; error: string };

const usd = (n: number) => `$${n.toFixed(2)}`;

export function spawnPlan(input: SpawnInput, caller: SpawnCaller): SpawnPlan {
  if (caller.depth === SpawnDepth.Child) {
    return { ok: false, error: 'a sub-agent cannot spawn another one: do the work yourself' };
  }
  const tools = [...new Set(input.tools ?? [])];
  const foreign = tools.filter((t) => !caller.tools.includes(t) || t === SPAWN_AGENT);
  if (foreign.length) {
    return { ok: false, error: `${foreign.join(', ')}: not tools you can hand over; yours: ${caller.tools.filter((t) => t !== SPAWN_AGENT).join(', ')}` };
  }
  if (input.budget_usd > caller.remainingUsd) {
    return { ok: false, error: `budget ${usd(input.budget_usd)} is more than this turn has: ${usd(caller.remainingUsd)} left` };
  }
  const writesCode = tools.some((t) => caller.codeTools.has(t));
  const asked = writesCode ? OPUS : (input.model ?? KIND_MODEL[input.kind ?? TaskKind.Reasoning]);
  const offer = caller.catalogue.find((m) => m.id === asked);
  if (!offer) {
    return { ok: false, error: `${asked} is not in the catalogue: ${caller.catalogue.map((m) => m.id).join(', ')}` };
  }
  if (!offer.vision && tools.some((t) => caller.visionTools.has(t))) {
    return { ok: false, error: `${asked} cannot see images and this task looks at frames: pick a model that can see` };
  }
  return { ok: true, prompt: input.prompt, label: input.label ?? input.kind ?? 'task', model: offer.id, tools, budgetUsd: input.budget_usd };
}

export type SpawnRun = { text: string; usd: number; changed: string[] };

export type SpawnPorts = { run: (plan: Extract<SpawnPlan, { ok: true }>) => Promise<SpawnRun> };

export type SpawnResult = { ok: true; label: string; model: string; prompt: string; text: string; cost_usd: number; changed: string[] } | { ok: false; error: string };

export function spawnRunner(ports: SpawnPorts, remainingUsd: () => number) {
  let running = 0;
  let reserved = 0;

  const spawn = async (plan: Extract<SpawnPlan, { ok: true }>): Promise<SpawnResult> => {
    if (running >= MAX_SPAWN_PARALLEL) {
      return { ok: false, error: `at most ${MAX_SPAWN_PARALLEL} sub-agents run at once: wait for one to finish` };
    }
    if (plan.budgetUsd > remainingUsd() - reserved) {
      return { ok: false, error: `budget ${usd(plan.budgetUsd)} is more than this turn has: ${usd(Math.max(0, remainingUsd() - reserved))} left` };
    }
    running += 1;
    reserved += plan.budgetUsd;
    try {
      const out = await ports.run(plan);
      return { ok: true, label: plan.label, model: plan.model, prompt: plan.prompt, text: out.text, cost_usd: out.usd, changed: out.changed };
    } catch (e) {
      return { ok: false, error: `the sub-agent failed: ${e instanceof Error ? e.message : String(e)}` };
    } finally {
      running -= 1;
      reserved -= plan.budgetUsd;
    }
  };

  return { spawn, reservedUsd: () => Math.max(0, Number(reserved.toFixed(6))) };
}

export const SPAWN_GUIDE = `Spawn a sub-agent (${SPAWN_AGENT}) only for work that stands on its own: independent research, building shots on a separate time range in parallel, exploring two alternatives side by side. Not for a single quick step you can do yourself, and never for work that needs this conversation. Give it a self-contained prompt with everything it needs. Model by task: Opus for UI, graphics, motion, code and judgement; Sonnet for mechanical work, searching and reading pages, data extraction; Haiku for the simplest checks, classification, short summaries and formatting. A sub-agent with a code-writing tool always runs on Opus.`;
