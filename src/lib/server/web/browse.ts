import { z } from 'zod';
import { RequestVerdict, requestVerdict } from './screenshot';
import { readHtml } from './read-page';
import type { OpenBrowser, Tab, Target } from './browser';

export enum StepKind {
  Navigate = 'navigate',
  Click = 'click',
  Type = 'type',
  Scroll = 'scroll',
  Wait = 'wait',
  Extract = 'extract',
  Screenshot = 'screenshot'
}

export const BROWSE_MAX_STEPS = 15;
export const BROWSE_MAX_SHOTS = 3;
export const BROWSE_DEADLINE_MS = 60_000;
const WAIT_MAX_MS = 5_000;
const EXTRACTS = ['markdown', 'links', 'images'] as const;
const SCROLL_ENDS = ['top', 'bottom'] as const;

const url = z.string().url().max(2000);
export const browseStepSchema = z.discriminatedUnion('do', [
  z.object({ do: z.literal(StepKind.Navigate), url }),
  z.object({ do: z.literal(StepKind.Click), selector: z.string().min(1).max(300).optional(), text: z.string().min(1).max(200).optional() }),
  z.object({ do: z.literal(StepKind.Type), selector: z.string().min(1).max(300), text: z.string().max(500) }),
  z.object({ do: z.literal(StepKind.Scroll), px: z.number().int().min(-20_000).max(20_000).optional(), to: z.enum(SCROLL_ENDS).optional() }),
  z.object({ do: z.literal(StepKind.Wait), ms: z.number().int().min(0).max(WAIT_MAX_MS).optional(), selector: z.string().min(1).max(300).optional() }),
  z.object({ do: z.literal(StepKind.Extract), what: z.enum(EXTRACTS) }),
  z.object({ do: z.literal(StepKind.Screenshot) })
]);

export type BrowseStep = z.infer<typeof browseStepSchema>;
export type StepReport = ({ do: StepKind; ok: true } & Record<string, unknown>) | { do: StepKind; ok: false; error: string };
export type BrowseOutcome = { ok: true; url: string; steps: StepReport[]; shots: Buffer[]; costUsd: number; stopped?: string } | { ok: false; error: string; costUsd: number };

type Run = { tab: Tab; shots: Buffer[]; maxShots: number };
type Runner<S extends BrowseStep> = (step: S, run: Run) => Promise<Record<string, unknown>>;

const REFUSED_FIELD = 'refused: that field belongs to a password or payment form';
const errorOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function publicOnly(address: string): Promise<void> {
  if ((await requestVerdict(address)) === RequestVerdict.Abort) {
    throw new Error(`${address} is not a public web page`);
  }
}

async function harmless(tab: Tab, target: Target): Promise<void> {
  if (await tab.sensitive(target)) {
    throw new Error(REFUSED_FIELD);
  }
}

async function extract(tab: Tab, what: (typeof EXTRACTS)[number]): Promise<Record<string, unknown>> {
  const page = await readHtml(tab.url(), await tab.html());
  if (!page.ok) {
    throw new Error(page.error);
  }
  const parts = { markdown: { title: page.title, markdown: page.markdown, truncated: page.truncated }, links: { links: page.links }, images: { images: page.images } };
  return parts[what];
}

const RUNNERS: { [K in StepKind]: Runner<Extract<BrowseStep, { do: K }>> } = {
  [StepKind.Navigate]: async (step, { tab }) => {
    await publicOnly(step.url);
    return { status: await tab.goto(step.url), url: tab.url() };
  },
  [StepKind.Click]: async (step, { tab }) => {
    if (!step.selector && !step.text) {
      throw new Error('click needs a selector or a text');
    }
    await harmless(tab, step);
    await tab.click(step);
    return { url: tab.url() };
  },
  [StepKind.Type]: async (step, { tab }) => {
    await harmless(tab, { selector: step.selector });
    await tab.type(step.selector, step.text);
    return {};
  },
  [StepKind.Scroll]: async (step, { tab }) => {
    await tab.scroll({ px: step.px, to: step.to });
    return {};
  },
  [StepKind.Wait]: async (step, { tab }) => {
    await (step.selector ? tab.waitFor(step.selector, WAIT_MAX_MS) : new Promise((resolve) => setTimeout(resolve, step.ms ?? 0)));
    return {};
  },
  [StepKind.Extract]: (step, { tab }) => extract(tab, step.what),
  [StepKind.Screenshot]: async (_, run) => {
    if (run.shots.length >= run.maxShots) {
      throw new Error(`at most ${run.maxShots} screenshots per browse`);
    }
    run.shots.push(await run.tab.shot());
    return { shot: run.shots.length - 1 };
  }
};

async function stepOf(step: BrowseStep, run: Run): Promise<StepReport> {
  const runner = RUNNERS[step.do] as Runner<BrowseStep>;
  return runner(step, run).then(
    (found): StepReport => ({ do: step.do, ok: true, ...found }),
    (e): StepReport => ({ do: step.do, ok: false, error: errorOf(e) })
  );
}

const outOfTime = Symbol('out of time');

export type Walked = { steps: StepReport[]; shots: Buffer[]; stopped?: string };

export async function walkSteps(tab: Tab, all: BrowseStep[], deadline: number, maxShots = BROWSE_MAX_SHOTS): Promise<Walked> {
  const run: Run = { tab, shots: [], maxShots };
  const reports: StepReport[] = [];

  for (const [i, step] of all.entries()) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<typeof outOfTime>((resolve) => {
      timer = setTimeout(() => resolve(outOfTime), Math.max(0, deadline - Date.now()));
    });
    const report = await Promise.race([stepOf(step, run), late]).finally(() => clearTimeout(timer));
    if (report === outOfTime) {
      return { steps: reports, shots: run.shots, stopped: `time limit reached: ${all.length - i} step(s) not run` };
    }
    reports.push(report);
  }

  return { steps: reports, shots: run.shots };
}

export async function browse(start: string, steps: BrowseStep[], open: OpenBrowser, limits: { deadlineMs?: number } = {}): Promise<BrowseOutcome> {
  try {
    await publicOnly(start);
  } catch (e) {
    return { ok: false, error: errorOf(e), costUsd: 0 };
  }

  let tab: Tab;
  try {
    tab = await open();
  } catch (e) {
    return { ok: false, error: `the browser could not open: ${errorOf(e)}`, costUsd: 0 };
  }

  const walked = await walkSteps(tab, [{ do: StepKind.Navigate, url: start }, ...steps.slice(0, BROWSE_MAX_STEPS)], Date.now() + (limits.deadlineMs ?? BROWSE_DEADLINE_MS));
  const costUsd = await tab.close().catch(() => 0);
  return { ok: true, url: tab.url(), ...walked, costUsd };
}
