import { loadSession } from '../lib/auth.ts';
import { awaitRun, motionApi, type MotionRun, type RenderStart } from '../lib/motion.ts';

type AskOpts = { org?: string; wait?: boolean };

async function token(): Promise<string> {
  const session = await loadSession();
  if (!session) {
    console.error('Session expired or missing. Run: feega login');
    process.exit(1);
  }
  return session.access_token;
}

export async function cmdMotionAsk(nodeId: string, prompt: string, opts: AskOpts) {
  await askAndReport(await token(), nodeId, prompt, opts);
}

export async function askAndReport(bearer: string, nodeId: string, prompt: string, opts: AskOpts) {
  const started = await motionApi.ask(bearer, nodeId, prompt, opts.org);
  printRun(opts.wait === false ? started : await awaitRun(bearer, started, { org: opts.org }));
}

export async function cmdMotionRun(runId: string, opts: { org?: string }) {
  printRun(await motionApi.run(await token(), runId, opts.org));
}

function printRun(run: MotionRun) {
  console.log(`run ${run.run_id}: ${run.status}`);
  if (run.reply) {
    console.log(run.reply);
  }
  if (run.version) {
    console.log(`  revision ${run.version}: ${run.summary ?? ''}`);
  }
  if (run.cost_usd !== undefined && run.cost_usd !== null) {
    console.log(`  cost     $${run.cost_usd.toFixed(4)}`);
  }
  if (run.error) {
    console.error(run.error);
  }
  if (run.status === 'running') {
    console.log(`Still running. Check later: feega motion run ${run.run_id}`);
  }
}

type RenderOpts = { org?: string; server?: boolean; resolution?: string; format?: string };

export async function cmdMotionRender(nodeId: string, opts: RenderOpts) {
  await renderAndReport(await token(), nodeId, opts);
}

export async function renderAndReport(bearer: string, nodeId: string, opts: RenderOpts) {
  const started = await motionApi.render(bearer, nodeId, { mode: opts.server ? 'server' : 'browser', resolution: opts.resolution, format: opts.format }, opts.org);
  printRender(started);
}

export async function cmdMotionRenderState(runId: string, opts: { org?: string }) {
  const state = await motionApi.renderState(await token(), runId, opts.org);
  console.log(`render ${state.run_id} (${state.mode}): ${state.status}`);
  if (state.file_url) {
    console.log(state.file_url);
  }
  if (state.error) {
    console.error(state.error);
  }
}

function printRender(started: RenderStart) {
  if (started.render_url) {
    console.log('Open this link on a computer or phone to render it there, for free:');
    console.log(started.render_url);
    console.log(`It works once, until ${started.expires_at}.`);
  } else {
    console.log(`Rendering on our servers: about ${started.credits} credits.`);
  }
  console.log(`Check it: feega motion render-status ${started.run_id}`);
}
