import { env } from '../_shims/env-private';
import type { TaskProvider } from '$lib/server/canvas/task-provider';
import { configuredTaskProviders } from '$lib/server/task-providers-config';
import { higgsfieldConfig, higgsfieldEstimate } from '$lib/server/higgsfield';
import { TaskProviderName } from '$lib/server/generation/task-providers';
import { KIE_TEXT_MODELS } from '$lib/server/kie-chat';
import { kieTextDeps, runKieText } from '$lib/server/kie-text-run';
import type { AiCallLog } from '$lib/server/ai-log';
import { kieModelRows } from '$lib/server/kie-catalogue';
import { taskChoice, wireSpecOf } from '$lib/server/task-choice';
import { wireInputs } from '$lib/server/generation/wire-inputs';
import { defaultParamsFor } from '$lib/canvas/gen-node';
import { nextFits, overspent, planFits, SMOKE_CAP_USD, type SmokeCase } from './provider-smoke-budget';

const SPEND_FLAG = '--spend';
const POLL_MS = 3_000;
const POLL_LIMIT_MS = 5 * 60_000;
const PROMPT = 'a red apple on a white table, studio light';
const VIDEO_PROMPT = 'a red apple slowly rotating on a white table, studio light';
const TEXT_PROMPT = 'Reply with one word: ready.';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

type Outcome = { costUsd: number | null; bytes: number };

enum SmokeMedium {
  Text = 'text',
  Image = 'image',
  ImageWithReference = 'image+reference',
  Video = 'video'
}

type ProviderCase = SmokeCase & { medium: SmokeMedium; run(): Promise<Outcome> };

const caseName = (c: ProviderCase): string => `${c.provider}:${c.medium}`;

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

function taskCase(provider: TaskProviderName, medium: SmokeMedium, maxUsd: number, ref: Record<string, unknown>, inputs: Record<string, unknown>): ProviderCase {
  return {
    provider,
    medium,
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

const REFERENCE_IMAGE = 'https://cdn.wiro.ai/uploads/sampleinputs/nano-banana-2-1-advanced-sampleinput-1.webp';

function nodeCase(kieModel: string, medium: SmokeMedium, maxUsd: number, prompt: string, imageUrls: string[]): ProviderCase {
  const row = kieModelRows(new Date().toISOString()).find((r) => r.wire_spec?.model === kieModel);
  const spec = wireSpecOf(row?.wire_spec);
  if (!row || !spec) {
    throw new Error(`kie catalogue has no ${kieModel}`);
  }
  const params = defaultParamsFor(taskChoice(row));
  const inputs = wireInputs(spec, { prompt, params, imageUrls, lastFrameUrl: null }, row.param_schema ?? {});
  const { fields: _fields, ...ref } = spec;
  return taskCase(TaskProviderName.Kie, medium, maxUsd, ref, inputs);
}

const openrouterCase: ProviderCase = {
  provider: 'openrouter',
  medium: SmokeMedium.Image,
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

const HIGGSFIELD_SOUL = 'higgsfield-ai/soul/standard';
const HIGGSFIELD_INPUTS = { prompt: PROMPT, resolution: '2K', aspect_ratio: '1:1' };

function higgsfieldCase(maxUsd: number): ProviderCase {
  const task = taskCase(TaskProviderName.Higgsfield, SmokeMedium.Image, maxUsd, { path: HIGGSFIELD_SOUL }, HIGGSFIELD_INPUTS);
  return {
    ...task,
    async run() {
      const config = higgsfieldConfig(env);
      if (!config) {
        throw new Error('higgsfield has no key in env');
      }
      const quoted = await higgsfieldEstimate(config, HIGGSFIELD_SOUL, HIGGSFIELD_INPUTS);
      if (quoted === null || quoted > maxUsd) {
        throw new Error(`estimate $${quoted} is above the $${maxUsd} allowed: not submitted`);
      }
      const outcome = await task.run();
      return { ...outcome, costUsd: outcome.costUsd ?? quoted };
    }
  };
}

function kieTextCase(maxUsd: number): ProviderCase {
  return {
    provider: TaskProviderName.Kie,
    medium: SmokeMedium.Text,
    maxUsd,
    async run() {
      const log = (entry: AiCallLog) => console.log(`  kie text: ${entry.ok ? 'ok' : entry.error}`);
      const out = await runKieText(kieTextDeps(log), { model: KIE_TEXT_MODELS[0].id, prompt: TEXT_PROMPT, scope: { orgId: 'smoke', projectId: 'smoke', userId: 'smoke' } });
      return { costUsd: out.costUsd, bytes: out.text.length };
    }
  };
}

function flag(prefix: string): string | undefined {
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

const CASES: readonly ProviderCase[] = [
  openrouterCase,
  taskCase(TaskProviderName.Wiro, SmokeMedium.Image, 0.02, { owner: 'wiro-partners', project: 'z-image-uncensored' }, { prompt: PROMPT, ratio: '1:1', promptExtend: 'false' }),
  nodeCase('nano-banana-2', SmokeMedium.Image, 0.05, PROMPT, []),
  { ...nodeCase('nano-banana-2', SmokeMedium.Image, 0.05, PROMPT, [REFERENCE_IMAGE]), medium: SmokeMedium.ImageWithReference },
  nodeCase('grok-imagine/text-to-video', SmokeMedium.Video, 0.08, VIDEO_PROMPT, []),
  kieTextCase(0.001),
  higgsfieldCase(0.15)
];

async function main(): Promise<void> {
  const only = flag('--only=');
  const medium = flag('--medium=');
  const cases = CASES.filter((c) => (!only || c.provider === only) && (!medium || c.medium === medium));
  const plan = planFits(cases);

  console.log(`provider smoke: ${cases.map((c) => `${caseName(c)} ≤ $${c.maxUsd}`).join(', ')} (cap $${SMOKE_CAP_USD})`);
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
      report[caseName(smoke)] = `unrun: ${fits.reason}`;
      continue;
    }
    const startedAt = Date.now();
    try {
      const outcome = await smoke.run();
      spent += outcome.costUsd ?? smoke.maxUsd;
      const flag = overspent(outcome.costUsd, smoke) ? ' OVER DECLARED MAX' : '';
      report[caseName(smoke)] = `ok: ${outcome.bytes} bytes, $${outcome.costUsd ?? 'unknown (counted at max)'}, ${Date.now() - startedAt} ms${flag}`;
    } catch (error) {
      spent += smoke.maxUsd;
      report[caseName(smoke)] = `failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  console.table(report);
  console.log(`spent at most $${spent.toFixed(4)}`);
}

await main();
