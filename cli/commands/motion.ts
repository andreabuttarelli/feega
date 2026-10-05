import { loadSession } from '../lib/auth.ts';
import { awaitRun, motionApi, type MotionRun } from '../lib/motion.ts';

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
