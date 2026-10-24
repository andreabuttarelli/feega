export enum OutputKind {
  Image = 'image',
  Video = 'video',
  Audio = 'audio'
}

export const OUTPUT_KIND_OF: Record<string, OutputKind | undefined> = { image: OutputKind.Image, video: OutputKind.Video, audio: OutputKind.Audio };

export type ViewerRun = {
  id: string;
  outputAssetId: string | null;
  prompt: string | null;
  model: string | null;
  params: Record<string, unknown>;
  costUsd: number | null;
  startedAt: string;
  status: string;
};

export type RunInfo = { prompt: string; model: string | null; seed: string | null; cost: string | null; startedAt: string };

const MIN_CENTS_USD = 0.01;
const CENTS_DIGITS = 2;
const SUB_CENT_DIGITS = 4;

function costText(costUsd: number | null): string | null {
  if (costUsd === null) {
    return null;
  }
  return `$${costUsd.toFixed(costUsd >= MIN_CENTS_USD ? CENTS_DIGITS : SUB_CENT_DIGITS)}`;
}

function seedText(params: Record<string, unknown>): string | null {
  const seed = params.seed;
  return typeof seed === 'number' || typeof seed === 'string' ? String(seed) : null;
}

export function runInfoOf(run: ViewerRun): RunInfo {
  return { prompt: run.prompt ?? '', model: run.model, seed: seedText(run.params), cost: costText(run.costUsd), startedAt: run.startedAt };
}

export function viewableRuns(rows: readonly ViewerRun[]): ViewerRun[] {
  const seen = new Set<string>();
  return [...rows]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .filter((run) => {
      if (run.status !== 'done' || !run.outputAssetId || seen.has(run.outputAssetId)) {
        return false;
      }
      seen.add(run.outputAssetId);
      return true;
    });
}

export function copyableParams(run: ViewerRun): string {
  return JSON.stringify({ prompt: run.prompt ?? '', model: run.model, params: run.params }, null, 2);
}
