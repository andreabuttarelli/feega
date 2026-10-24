import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runAgent, Stop, type RunStats } from './agent-loop';
import { renderThroughBrowser } from './browser-render';
import { ARM_CAP_USD, AGENT_MODEL, HARD_CAP_USD, JUDGE_FRAME_TIMES_S, JUDGE_RESERVE_USD, SITE_URL, TASK, VIDEO, outputDir } from './config';
import { connectFeega, mintTestSession } from './feega-mcp';
import { createThrowaway, deleteThrowaway } from './feega-project';
import { judgeFrames, type Taste } from './judge';
import { renderReport, type ArmResult, type Report } from './report';
import { findRenderedVideo, prepareRemotionProject, remotionTools } from './remotion-arm';
import { siteFacts } from './site-facts';
import { extractFrames, probeVideo, type VideoFacts } from './video-facts';

const DURATION_TOLERANCE_S = 0.6;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const feegaSystem = (instructions: string, ids: { projectId: string; canvasId: string }) =>
  `You are an agent that makes videos with feega, an infinite canvas of typed nodes, through its MCP tools.

${instructions}

A throwaway project is ready. project_id=${ids.projectId} canvas_id=${ids.canvasId}. Build the video on that canvas.
Deliver ONE frame node that plays the whole video at ${VIDEO.width}x${VIDEO.height}, ${VIDEO.seconds} seconds long (combine scenes if you built them as separate frames).
Look at your frames with a snapshot before you finish. When done, reply with only that frame's node id.`;

const remotionSystem = () =>
  `You make videos with Remotion in the current project directory. Remotion ${'4.0.538'}, React 19 and TypeScript are installed and Chromium is ready; nothing else is set up.
Create the entry point, the root and the composition yourself. Register one composition with id "Launch": ${VIDEO.width}x${VIDEO.height}, ${VIDEO.fps} fps, ${VIDEO.seconds * VIDEO.fps} frames.
Render it with: npx remotion render src/index.ts Launch out/launch.mp4
Check your own work with view_frame before you finish. When out/launch.mp4 exists, reply with only: done`;

const NOT_RUN: RunStats = { stop: Stop.Error, turns: 0, toolCalls: 0, toolCallsByName: {}, toolErrors: 0, usage: { promptTokens: 0, completionTokens: 0, cachedTokens: 0, costUsd: 0 }, finalText: '', error: 'not run' };

const withinSpec = (v: VideoFacts) => v.width === VIDEO.width && v.height === VIDEO.height && Math.abs(v.seconds - VIDEO.seconds) <= DURATION_TOLERANCE_S;

function armResult(name: string, stats: RunStats, agentSeconds: number): ArmResult {
  return { name, stop: stats.stop, error: stats.error, agentSeconds, renderSeconds: 0, turns: stats.turns, toolCalls: stats.toolCalls, toolCallsByName: stats.toolCallsByName, toolErrors: stats.toolErrors, usage: stats.usage, outputFile: null, video: null, taste: null, success: false, notes: [] };
}

async function runFeega(task: string, outDir: string, spentSoFar: number): Promise<ArmResult> {
  const mcp = await connectFeega(await mintTestSession());
  const project = await createThrowaway(mcp, Date.now());
  let result = armResult('feega MCP', NOT_RUN, 0);

  try {
    const started = Date.now();
    const stats = await runAgent({ system: feegaSystem(mcp.instructions, project), task, tools: mcp.tools, capUsd: Math.min(ARM_CAP_USD, HARD_CAP_USD - JUDGE_RESERVE_USD - spentSoFar) });
    result = armResult('feega MCP', stats, (Date.now() - started) / 1000);
    result.notes.push(`${mcp.toolCount} MCP tools exposed (ask_motion_agent withheld)`);

    const frameId = [...stats.finalText.matchAll(UUID)].at(-1)?.[0];
    if (!frameId) {
      result.notes.push('no frame id in the final answer');
      return result;
    }

    const file = join(outDir, 'feega.mp4');
    const rendered = await renderThroughBrowser(mcp, frameId, file);
    result.renderSeconds = rendered.seconds;
    result.notes.push(`browser render: ${rendered.detail}`);
    if (rendered.ok) {
      result.outputFile = file;
    }
    return result;
  } finally {
    const gone = await deleteThrowaway(mcp, project.projectId).catch(() => false);
    result.notes.push(gone ? 'throwaway project deleted' : `THROWAWAY PROJECT NOT DELETED: ${project.projectId}`);
    await mcp.close();
  }
}

async function runRemotion(task: string, outDir: string, spentSoFar: number): Promise<ArmResult> {
  const project = await prepareRemotionProject();
  const started = Date.now();
  const stats = await runAgent({ system: remotionSystem(), task, tools: remotionTools(project.dir), capUsd: Math.min(ARM_CAP_USD, HARD_CAP_USD - JUDGE_RESERVE_USD - spentSoFar) });
  const result = armResult('Remotion from scratch', stats, (Date.now() - started) / 1000);
  result.notes.push(`project dir ${project.dir}; setup (npm install, browser) ${project.setupSeconds.toFixed(0)}s, not counted`);

  const video = findRenderedVideo(project.dir);
  if (video) {
    const file = join(outDir, 'remotion.mp4');
    copyFileSync(video, file);
    result.outputFile = file;
  } else {
    result.notes.push('no mp4 in out/');
  }
  return result;
}

async function score(result: ArmResult, brief: string): Promise<number> {
  if (!result.outputFile) {
    return 0;
  }
  result.video = await probeVideo(result.outputFile);
  result.success = withinSpec(result.video);
  const frames = await extractFrames(result.outputFile, JUDGE_FRAME_TIMES_S, result.video.seconds);
  const judged = await judgeFrames(frames, brief);
  result.taste = judged.taste as Taste;
  return judged.costUsd;
}

async function main() {
  const day = new Date().toISOString().slice(0, 10);
  const outDir = outputDir(day);
  mkdirSync(outDir, { recursive: true });

  const task = `${TASK}\n\n${await siteFacts(SITE_URL)}`;
  writeFileSync(join(outDir, 'task.txt'), task);

  const feega = await runFeega(task, outDir, 0);
  const remotion = await runRemotion(task, outDir, feega.usage.costUsd);

  const judgeCost = (await score(feega, TASK).catch((e) => (feega.notes.push(`judge failed: ${e}`), 0))) + (await score(remotion, TASK).catch((e) => (remotion.notes.push(`judge failed: ${e}`), 0)));

  await finish(outDir, { model: AGENT_MODEL, day, task, arms: [feega, remotion], judgeCostUsd: judgeCost });
}

function finish(outDir: string, partial: Omit<Report, 'totalCostUsd'>) {
  const total = partial.arms.reduce((sum, a) => sum + a.usage.costUsd, 0) + partial.judgeCostUsd;
  const report: Report = { ...partial, totalCostUsd: total };
  writeFileSync(join(outDir, 'results.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(outDir, 'report.md'), renderReport(report));
  console.log(renderReport(report));
  console.log(`saved in ${outDir}`);
}

async function rejudge(outDir: string) {
  const saved = JSON.parse(readFileSync(join(outDir, 'results.json'), 'utf8')) as Report;
  let judgeCost = 0;
  for (const arm of saved.arms) {
    arm.notes = arm.notes.filter((n) => !n.startsWith('judge failed'));
    judgeCost += await score(arm, TASK).catch((e) => (arm.notes.push(`judge failed: ${e}`), 0));
  }
  finish(outDir, { ...saved, judgeCostUsd: judgeCost });
}

const rejudgeDir = process.argv.find((a) => a.startsWith('--rejudge='))?.slice('--rejudge='.length);
await (rejudgeDir ? rejudge(rejudgeDir) : main());
