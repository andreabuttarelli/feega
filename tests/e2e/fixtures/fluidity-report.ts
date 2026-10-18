import type { StepFacts } from './fluidity-probe';

export const THRESHOLDS = { remounts: 0, flashes: 0, reverts: 0, latencyP95Ms: 50, frameP95Ms: 20 };

export type StepResult = { name: string; facts: StepFacts | null; error: string | null; finalChecks: string[] };
export type SessionRun = { browser: string; renderer: string; variant: string; steps: StepResult[]; mockedCalls: number; at: string };

const GATED_FRAME_TIME = new Set(['chromium']);

export function failuresOf(step: StepResult, browser = 'chromium'): string[] {
  if (step.error) {
    return [`undriven: ${step.error}`];
  }
  const f = step.facts!;
  const out: string[] = [];
  if (f.remounts.length > THRESHOLDS.remounts) {
    out.push(`remounts ${f.remounts.length}`);
  }
  if (f.playerMounts.length) {
    out.push(`player mounts in view ${f.playerMounts.length}`);
  }
  const measuredFlashes = f.flashes.filter((x) => !x.startsWith('unmeasured'));
  if (measuredFlashes.length > THRESHOLDS.flashes) {
    out.push(`flashes ${measuredFlashes.length}`);
  }
  if (f.reverts.length + step.finalChecks.length > THRESHOLDS.reverts) {
    out.push(`reverts ${f.reverts.length + step.finalChecks.length}`);
  }
  if (f.latencyP95 !== null && f.latencyP95 > THRESHOLDS.latencyP95Ms) {
    out.push(`input→paint p95 ${Math.round(f.latencyP95)} ms`);
  }
  if (GATED_FRAME_TIME.has(browser) && f.frameP95 !== null && f.frameP95 > THRESHOLDS.frameP95Ms) {
    out.push(`frame p95 ${Math.round(f.frameP95)} ms`);
  }
  return out;
}

export function verdictOf(steps: StepResult[], browser = 'chromium'): string[] {
  return steps.flatMap((s) => failuresOf(s, browser).map((f) => `${s.name}: ${f}`));
}

const ms = (x: number | null) => (x === null ? '–' : `${Math.round(x)}`);
const list = (xs: string[], max = 3) => (xs.length ? `${xs.length} (${xs.slice(0, max).join('; ')}${xs.length > max ? '…' : ''})` : '0');

function table(run: SessionRun): string {
  const head = '| step | verdict | remounts | player mounts in view / entering view | GPU counts | fetches | flashes | reverts | input→paint p95 / max ms | frame p95 ms | long tasks (max ms) |\n|---|---|---|---|---|---|---|---|---|---|---|';
  const rows = run.steps.map((s) => {
    const fails = failuresOf(s, run.browser);
    if (s.error) {
      return `| ${s.name} | UNDRIVEN | ${s.error.replace(/\|/g, '/')} | | | | | | | | |`;
    }
    const f = s.facts!;
    const counts = Object.entries(f.gpuCounts).map(([k, v]) => `${k} ${v}`).join(', ') || '0';
    return `| ${s.name} | ${fails.length ? `FAIL: ${fails.join(', ')}` : 'pass'} | ${list(f.remounts)} | ${list(f.playerMounts)} / ${(f.lazyMounts ?? []).length} | ${counts} | ${list(f.fetches, 2)} | ${list(f.flashes, 2)} | ${list([...f.reverts, ...s.finalChecks], 2)} | ${ms(f.latencyP95)} / ${ms(f.latencyMax)} (${f.inputs}) | ${ms(f.frameP95)} (${f.frames}) | ${f.longTasks} (${Math.round(f.longTaskMax)}) |`;
  });
  return [head, ...rows].join('\n');
}

export function scorecard(runs: SessionRun[]): string {
  const sorted = [...runs].sort((a, b) => `${a.browser}${a.renderer}${a.variant}`.localeCompare(`${b.browser}${b.renderer}${b.variant}`));
  const summary = sorted.map((r) => {
    const fails = verdictOf(r.steps, r.browser);
    return `| ${r.browser} | ${r.renderer} | ${r.variant} | ${fails.length ? `FAIL (${fails.length})` : 'PASS'} | ${r.at} |`;
  });
  const sections = sorted.map((r) => `## ${r.browser} · ${r.renderer} · ${r.variant}\n\nVideo: \`${r.browser}-${r.renderer}-${r.variant}.mp4\` · mocked generate calls: ${r.mockedCalls}\n\n${table(r)}`);
  return [
    '# Fluidity scorecard',
    '',
    `Thresholds: ${THRESHOLDS.remounts} remounts of untouched nodes, ${THRESHOLDS.flashes} flashes, ${THRESHOLDS.reverts} reverts, input→paint p95 ≤ ${THRESHOLDS.latencyP95Ms} ms, frame p95 ≤ ${THRESHOLDS.frameP95Ms} ms (frame time gated on Chromium only; WebKit reported).`,
    '',
    'Method: headed browser, heavy canvas copy, one chained session, no reloads. Remounts = node or player DOM elements removed during the step while the node still exists and was not touched by the step. Player mounts in view = a player mounted in an untouched node that was already on screen when the step began (gated); entering view = a lazy first mount of a node the camera brought on screen (reported, not gated). Flashes = a 1–2 frame transient in a CDP screencast frame of the touched node or of up to 6 untouched nodes in view (Chromium only; not measured on WebKit, not measured during pan/zoom). Reverts = an on-screen value returning to an earlier one inside the step (per animation frame), or the final value differing from the last one set. Input→paint = Event Timing duration of interactions plus input-timestamp-to-next-frame for every input event. Frame p95 = rAF deltas during the step.',
    '',
    '| browser | renderer | variant | verdict | at |',
    '|---|---|---|---|---|',
    ...summary,
    '',
    ...sections,
    ''
  ].join('\n');
}
