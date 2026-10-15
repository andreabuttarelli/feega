import { env } from '../_shims/env-private';
import type { TaskProvider } from '$lib/server/canvas/task-provider';
import { configuredTaskProviders } from '$lib/server/task-providers-config';
import { TaskProviderName } from '$lib/server/generation/task-providers';
import { nextFits, overspent, planFits, SMOKE_CAP_USD, type SmokeCase } from './provider-smoke-budget';

const SPEND_FLAG = '--spend';
const POLL_MS = 3_000;
const POLL_LIMIT_MS = 5 * 60_000;
const PROMPT = 'a red apple on a white table, studio light';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

type Outcome = { costUsd: number | null; bytes: number };

type ProviderCase = SmokeCase & { run(): Promise<Outcome> };

async function downloadedBytes(url: string): Promise<number> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`download HTTP ${res.status}`);
  }
  return (await res.arrayBuffer()).byteLength;
}

async function untilSettled(gateway: TaskProvider, taskId: string): Promise<Outcome> {
  const deadline = Date.now() + POLL_LIMIT_MS;
  while (Date.now() < deadline) {
    const state = await gateway.task(taskId);
    if (state.state === 'failed') {
      throw new Error(state.error);
    }
    if (state.state === 'done') {
      return { costUsd: state.costUsd, bytes: state.outputs[0] ? await downloadedBytes(state.outputs[0].url) : 0 };
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`still running after ${POLL_LIMIT_MS / 1000}s: task ${taskId} may still bill`);
}

function taskCase(provider: TaskProviderName, maxUsd: number, ref: Record<string, unknown>, inputs: Record<string, unknown>): ProviderCase {
  return {
    provider,
    maxUsd,
    async run() {
      const gateway = configuredTaskProviders(env)[provider];
      if (!gateway) {
        throw new Error(`${provider} has no key in env`);
      }
      const { taskId } = await gateway.run(ref, inputs, `provider-smoke-${Date.now()}`);
      return untilSettled(gateway, taskId);
    }
  };
}

const openrouterCase: ProviderCase = {
  provider: 'openrouter',
  maxUsd: 0.02,
  async run() {
    const key = env.OPENROUTER_API_KEY?.trim();
    if (!key) {
      throw new Error('openrouter has no key in env');
    }
    const res = await fetch(`${(env.LLM_BASE_URL?.trim() || OPENROUTER_BASE_URL).replace(/\/$/, '')}/images`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'openai/gpt-image-2.5-flare', prompt: PROMPT, aspect_ratio: '1:1' })
    });
    const body = (await res.json()) as { data?: Array<{ b64_json?: string }>; usage?: { cost?: number }; error?: { message?: string } };
    if (!res.ok) {
      throw new Error(body.error?.message ?? `HTTP ${res.status}`);
    }
    return { costUsd: body.usage?.cost ?? null, bytes: Buffer.from(body.data?.[0]?.b64_json ?? '', 'base64').byteLength };
  }
};

const CASES: readonly ProviderCase[] = [
  openrouterCase,
  taskCase(TaskProviderName.Wiro, 0.02, { owner: 'wiro-partners', project: 'z-image-uncensored' }, { prompt: PROMPT, ratio: '1:1', promptExtend: 'false' }),
  taskCase(TaskProviderName.Kie, 0.05, { model: 'nano-banana-2' }, { prompt: PROMPT, resolution: '1K', aspect_ratio: '1:1' })
];

async function main(): Promise<void> {
  const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice('--only='.length);
  const cases = CASES.filter((c) => !only || c.provider === only);
  const plan = planFits(cases);

  console.log(`provider smoke: ${cases.map((c) => `${c.provider} ≤ $${c.maxUsd}`).join(', ')} (cap $${SMOKE_CAP_USD})`);
  if (!plan.ok) {
    throw new Error(plan.reason);
  }
  if (!process.argv.includes(SPEND_FLAG)) {
    console.log(`dry run: nothing called. Add ${SPEND_FLAG} to spend real money.`);
    return;
  }

  let spent = 0;
  const report: Record<string, string> = {};
  for (const smoke of cases) {
    const fits = nextFits(spent, smoke);
    if (!fits.ok) {
      report[smoke.provider] = `unrun: ${fits.reason}`;
      continue;
    }
    const startedAt = Date.now();
    try {
      const outcome = await smoke.run();
      spent += outcome.costUsd ?? smoke.maxUsd;
      const flag = overspent(outcome.costUsd, smoke) ? ' OVER DECLARED MAX' : '';
      report[smoke.provider] = `ok: ${outcome.bytes} bytes, $${outcome.costUsd ?? 'unknown (counted at max)'}, ${Date.now() - startedAt} ms${flag}`;
    } catch (error) {
      spent += smoke.maxUsd;
      report[smoke.provider] = `failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  console.table(report);
  console.log(`spent at most $${spent.toFixed(4)}`);
}

await main();
