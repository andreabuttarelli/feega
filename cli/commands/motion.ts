import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadSession } from '../lib/auth.ts';
import { awaitRun, motionApi, type FrameElementMoved, type MotionRun, type RenderStart } from '../lib/motion.ts';
import { attachmentSource } from '../lib/attachments.ts';

type AskOpts = { org?: string; wait?: boolean; attach?: string[]; follow?: string[]; avoid?: string[]; note?: string; reject?: string | boolean; avoidAll?: boolean };

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
  const attachments = await Promise.all((opts.attach ?? []).map(attachmentSource));
  const rejected = opts.reject !== undefined && opts.reject !== false;
  const picked = rejected || opts.follow?.length || opts.avoid?.length;
  const marks = { follow: opts.follow ?? [], avoid: opts.avoid ?? [], ...(opts.note ? { note: opts.note } : {}) };
  const rejection = rejected ? { rejected: true, query: typeof opts.reject === 'string' ? opts.reject : '', avoid_all: opts.avoidAll === true } : {};
  const pick = picked ? { ...marks, ...rejection } : undefined;
  const started = await motionApi.ask(bearer, nodeId, prompt, opts.org, attachments, pick);
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
  if (run.reference_pick) {
    console.log(`  ${run.reference_pick.question}`);
    run.reference_pick.candidates.forEach((c) => console.log(`  ${c.id}  ${c.image}${c.why ? `  ${c.why}` : ''}`));
    console.log(`Answer: feega motion ask ${run.node_id ?? '<nodeId>'} "" --follow <ids...> --avoid <ids...>`);
  }
  if (run.video_budget) {
    console.log(`  budget used: $${run.video_budget.spent_usd.toFixed(2)} spent`);
    console.log(`Continue: feega motion budget ${run.node_id ?? '<nodeId>'} --raise (+$${run.video_budget.raise_usd.toFixed(2)})`);
  }
  if (run.cut_review) {
    console.log(`  critic ${run.cut_review.score}/10`);
    run.cut_review.fixes.forEach((f) => console.log(`  - ${f}`));
    console.log(`Apply: feega motion ask ${run.node_id ?? '<nodeId>'} ${JSON.stringify(run.cut_review.answers.apply)}`);
  }
  if (run.error) {
    console.error(run.error);
  }
  if (run.status === 'running') {
    console.log(`Still running. Check later: feega motion run ${run.run_id}`);
  }
}

type RenderOpts = { org?: string; server?: boolean; resolution?: string; format?: string; quality?: string; fps?: string };

export async function cmdMotionRender(nodeId: string, opts: RenderOpts) {
  await renderAndReport(await token(), nodeId, opts);
}

export async function renderAndReport(bearer: string, nodeId: string, opts: RenderOpts) {
  const started = await motionApi.render(bearer, nodeId, { mode: opts.server ? 'server' : 'browser', resolution: opts.resolution, format: opts.format, quality: opts.quality, fps: opts.fps ? Number(opts.fps) : undefined }, opts.org);
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

export async function cmdMotionRevisions(nodeId: string, opts: { org?: string; restore?: string }) {
  const bearer = await token();
  if (opts.restore) {
    const restored = await motionApi.restore(bearer, nodeId, Number(opts.restore), opts.org);
    console.log(`Restored version ${restored.restored} as revision ${restored.version}.`);
    return;
  }
  const { revisions } = await motionApi.revisions(bearer, nodeId, opts.org);
  for (const r of revisions) {
    console.log(`v${r.version}  ${r.actorKind}  ${r.clips} clips  ${r.createdAt}  ${r.summary ?? ''}`);
  }
}

export async function cmdMotionTemplates(opts: { org?: string }) {
  const { templates } = await motionApi.templates(await token(), opts.org);
  for (const t of templates) {
    console.log(`${t.id}  ${t.name}  ${t.seconds}s  ${t.description}`);
    if (t.card) {
      console.log(`  ${t.card.roles.join('/')} · ${t.card.energy}${t.card.loops ? ' · loops' : ''} · ${t.card.edges.start}→${t.card.edges.end} ${t.card.edges.transition}`);
      console.log(`  ${t.card.onScreen.join('; ')}`);
    }
    console.log(`  ${t.fields.map((f) => `${f.key}:${f.type}`).join(', ')}`);
  }
}

const parsedVar = (raw: string): [string, string] => {
  const at = raw.indexOf('=');
  return [raw.slice(0, at), raw.slice(at + 1)];
};

export async function cmdMotionNew(opts: { template: string; format?: string; project?: string; org?: string; still?: string }) {
  const made = await motionApi.fromTemplate(await token(), { template: opts.template, format: opts.format, project: opts.project, ...(opts.still === undefined ? {} : { still: Number(opts.still) }) }, opts.org);
  console.log(`Created video ${made.node_id} from ${opts.template}, revision ${made.version}.`);
  console.log(`Edit it: ${made.editor_url}`);
}

export async function cmdMotionAddTemplate(nodeId: string, templateId: string, opts: { org?: string; at?: string; var?: string[]; sound?: boolean }) {
  const vars = Object.fromEntries((opts.var ?? []).filter((v) => v.includes('=')).map(parsedVar));
  const added = await motionApi.addTemplate(await token(), nodeId, { id: templateId, at: Number(opts.at ?? 0), vars, sound: opts.sound !== false }, opts.org);
  console.log(`Added ${templateId} as clip ${added.clip_id}, revision ${added.version}.${added.sounds ? ` Sounds: ${added.sounds}` : ''}`);
}

export async function cmdMotionShaders(opts: { org?: string }) {
  const { effects } = await motionApi.shaderEffects(await token(), opts.org);
  for (const e of effects) {
    const knobs = Object.entries(e.knobs).map(([key, k]) => `${key} ${k.min}..${k.max}${k.keyframes ? '' : ' (fixed)'}`);
    console.log(`${e.id}  ${e.category}  ${e.source}${e.live ? '  live only' : ''}  ${e.about}`);
    console.log(`  ${[...knobs, ...Object.keys(e.colours)].join(', ')}`);
  }
}

export async function cmdMotionList(opts: { org?: string; project?: string }) {
  const { videos } = await motionApi.list(await token(), opts.project, opts.org);
  if (!videos.length) {
    console.log('No motion videos.');
    return;
  }
  for (const v of videos) {
    console.log(`${v.node_id}  ${v.name ?? '(untitled)'}  ${v.format}  revision ${v.version}  project ${v.project_id}`);
  }
}

type EmbedOpts = { org?: string; unpublish?: boolean; status?: boolean; download?: string };

export async function cmdMotionEmbed(nodeId: string, opts: EmbedOpts) {
  await embedAndReport(await token(), nodeId, opts);
}

export async function embedAndReport(bearer: string, nodeId: string, opts: EmbedOpts) {
  if (opts.download) {
    await writeFile(opts.download, await motionApi.bundle(bearer, nodeId, opts.org));
    console.log(`Saved the self-contained HTML to ${opts.download}`);
    return;
  }
  if (opts.unpublish) {
    await motionApi.unembed(bearer, nodeId, opts.org);
    console.log('Embed taken down.');
    return;
  }
  const state = opts.status ? await motionApi.embedState(bearer, nodeId, opts.org) : await motionApi.embed(bearer, nodeId, opts.org);
  console.log(state.published ? `Published: ${state.url}` : `Not published. It would live at ${state.url}`);
  if (state.snippet) {
    console.log(state.snippet);
  }
  if (state.react) {
    console.log(`\nReact:\n${state.react}`);
  }
  if (state.flutter) {
    console.log(`\nFlutter:\n${state.flutter}`);
  }
}

type FramesOpts = { org?: string; at: string; width?: string; out?: string };

export async function cmdMotionFrames(nodeId: string, opts: FramesOpts) {
  await framesAndReport(await token(), nodeId, opts);
}

export async function framesAndReport(bearer: string, nodeId: string, opts: FramesOpts) {
  const times = opts.at.split(',').map(Number);
  const width = opts.width ? Number(opts.width) : undefined;
  const shot = await motionApi.frames(bearer, nodeId, width ? { times, width } : { times }, opts.org);
  const dir = opts.out ?? '.';
  await mkdir(dir, { recursive: true });
  for (const f of shot.frames) {
    const file = join(dir, `${nodeId}-${f.time}s.jpg`);
    await writeFile(file, Buffer.from(f.data, 'base64'));
    console.log(`${f.time}s  ${file}`);
  }
  for (const note of shot.quality) {
    console.log(`${shot.blocking.includes(note) ? 'blocking' : 'quality '}  ${note}`);
  }
}

export async function cmdMotionStoryboard(nodeId: string, opts: { org?: string; write?: string; card?: string; text?: string }) {
  const bearer = await token();
  if (opts.write) {
    const board = JSON.parse(await readFile(opts.write, 'utf8')) as { beats: unknown[] };
    const out = await motionApi.writeStoryboard(bearer, nodeId, board, opts.org);
    console.log(`Storyboard written on canvas ${String(out.canvas_id)}.`);
    return;
  }
  if (opts.card && opts.text) {
    await motionApi.editStoryboard(bearer, nodeId, opts.card, opts.text, opts.org);
    console.log(`Card ${opts.card} rewritten.`);
    return;
  }
  const board = (await motionApi.storyboard(bearer, nodeId, opts.org)) as { canvas_id?: string; cards?: { node_id: string; text: string; clip_ids: string[] }[] };
  if (!board.cards) {
    console.log('No storyboard yet.');
    return;
  }
  console.log(`canvas ${board.canvas_id}`);
  for (const c of board.cards) {
    console.log(`\n[${c.node_id}]${c.clip_ids.length ? ` clips ${c.clip_ids.join(',')}` : ''}\n${c.text}`);
  }
}

type FrameOpts = { org?: string; to?: string; x?: string; y?: string; canvasX?: string; canvasY?: string };

function frameTarget(opts: FrameOpts) {
  const num = (v?: string) => (v === undefined ? undefined : Number(v));
  return { to_frame_id: opts.to, x: num(opts.x), y: num(opts.y), canvas_x: num(opts.canvasX), canvas_y: num(opts.canvasY) };
}

function printMoved(moved: FrameElementMoved) {
  if (moved.outcome !== 'done') {
    console.error(`${moved.outcome}: ${moved.message ?? ''}`);
    process.exit(1);
  }
  console.log(`${moved.new_frame ? 'new frame' : 'frame'} ${moved.frame_id}: element ${moved.element_id}`);
}

export async function cmdMotionMove(frameId: string, elementId: string, opts: FrameOpts) {
  printMoved(await motionApi.frameElement(await token(), { frame_id: frameId, element_id: elementId, ...frameTarget(opts) }, opts.org));
}

export async function cmdMotionPlace(nodeId: string, opts: FrameOpts) {
  printMoved(await motionApi.frameElement(await token(), { node_id: nodeId, ...frameTarget(opts) }, opts.org));
}

export async function cmdMotionBudget(nodeId: string, opts: { org?: string; raise?: boolean }) {
  const bearer = await token();
  const budget = opts.raise ? await motionApi.raiseBudget(bearer, nodeId, opts.org) : await motionApi.budget(bearer, nodeId, opts.org);
  console.log(`spent $${budget.spent_usd.toFixed(2)} of $${budget.cap_usd.toFixed(2)}`);
}

type ToolOpts = { org?: string; input?: string; version?: string };

export async function cmdMotionTool(nodeId: string, tool: string, opts: ToolOpts) {
  await toolAndReport(await token(), nodeId, tool, opts);
}

export async function toolAndReport(bearer: string, nodeId: string, tool: string, opts: ToolOpts) {
  const ran = await motionApi.runTool(bearer, nodeId, { tool, ...(opts.input ? { input: JSON.parse(opts.input) } : {}), ...(opts.version ? { version: Number(opts.version) } : {}) }, opts.org);
  console.log(JSON.stringify(ran.output, null, 2));
  console.log(ran.saved ? `Saved as revision ${ran.version}.` : `Nothing changed: revision ${ran.version}.`);
}

export async function cmdMotionTools(name: string | undefined, opts: { org?: string }) {
  console.log(JSON.stringify(await motionApi.tools(await token(), name, opts.org), null, 2));
}

type StillOpts = { org?: string; format?: string; scale?: string; time?: string; out?: string };

export async function cmdMotionStill(nodeId: string, opts: StillOpts) {
  await stillAndReport(await token(), nodeId, opts);
}

export async function stillAndReport(bearer: string, nodeId: string, opts: StillOpts) {
  const input = { format: opts.format ?? 'png', ...(opts.scale ? { scale: Number(opts.scale) } : {}), ...(opts.time ? { time: Number(opts.time) } : {}) };
  const ran = await motionApi.runTool(bearer, nodeId, { tool: 'export_image', input }, opts.org);
  const made = ran.output as { ok: boolean; url?: string; error?: string; width?: number; height?: number };
  if (!made.ok || !made.url) {
    console.error(made.error ?? 'the image was not exported');
    process.exitCode = 1;
    return;
  }
  const file = opts.out ?? `${nodeId}.${input.format}`;
  const res = await fetch(made.url);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  console.log(`Saved ${file} (${made.width}x${made.height}).`);
  console.log(`URL: ${made.url}`);
}
