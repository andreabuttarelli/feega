import { START_URL_PARAM } from '$lib/start-url';

export enum StartStep {
  Read = 'read',
  Import = 'import',
  Brand = 'brand',
  Open = 'open'
}

export enum StepState {
  Waiting = 'waiting',
  Running = 'running',
  Done = 'done',
  Failed = 'failed'
}

export const START_STEPS: readonly StartStep[] = [StartStep.Read, StartStep.Brand, StartStep.Import, StartStep.Open];

export const STEP_LABEL: Record<StartStep, Record<'running' | 'failed', (host: string) => string>> = {
  [StartStep.Read]: { running: (host) => `Reading ${host}…`, failed: (host) => `Couldn't open a project for ${host}.` },
  [StartStep.Import]: { running: () => 'Importing the page…', failed: () => "The page couldn't be imported. You can try again on the canvas." },
  [StartStep.Brand]: { running: () => 'Analysing your brand: colours, fonts, logo, voice…', failed: () => 'Brand analysis unavailable, try again.' },
  [StartStep.Open]: { running: () => 'Opening your canvas…', failed: () => "Couldn't open the canvas." }
};

export type StartScope = { projectId: string; canvasId: string };

export type StartPorts = {
  create: (url: string) => Promise<StartScope | null>;
  importPage: (scope: StartScope, url: string) => Promise<boolean>;
  brand: (scope: StartScope, url: string) => Promise<boolean>;
};

export type StartOutcome = { scope: StartScope | null; imported: boolean; branded: boolean; next: string };

type Report = (step: StartStep, state: StepState) => void;

const DASHBOARD = '/app';

async function step<T>(name: StartStep, report: Report, run: () => Promise<T>, ok: (value: T) => boolean): Promise<T | null> {
  report(name, StepState.Running);
  const value = await run().catch(() => null);
  const passed = value !== null && ok(value);
  report(name, passed ? StepState.Done : StepState.Failed);
  return passed ? value : null;
}

export function canvasNext(scope: StartScope, url: string, imported: boolean): string {
  const path = `/p/${scope.projectId}/c/${scope.canvasId}`;
  return imported ? path : `${path}?${START_URL_PARAM}=${encodeURIComponent(url)}`;
}

export async function runBrandStep(scope: StartScope, url: string, ports: Pick<StartPorts, 'brand'>, report: Report): Promise<boolean> {
  return (await step(StartStep.Brand, report, () => ports.brand(scope, url), Boolean)) === true;
}

export async function runStart(url: string, ports: StartPorts, report: Report): Promise<StartOutcome> {
  const scope = await step(StartStep.Read, report, () => ports.create(url), Boolean);
  if (!scope) {
    return { scope: null, imported: false, branded: false, next: DASHBOARD };
  }

  const branded = await runBrandStep(scope, url, ports, report);
  const imported = (await step(StartStep.Import, report, () => ports.importPage(scope, url), Boolean)) === true;
  if (branded) {
    report(StartStep.Open, StepState.Running);
  }
  return { scope, imported, branded, next: canvasNext(scope, url, imported) };
}
