const PREFIX = 'frame|';
const SEPARATOR = '|';
const GROUP_SEPARATOR = ':';
const VIEW = '@bp:';

export enum Step {
  Asked = 'asked',
  Source = 'source',
  Built = 'built',
  Vectors = 'vectors',
  Whole = 'whole',
  Put = 'put',
  Patched = 'patched',
  Pictured = 'pictured',
  Drawn = 'drawn',
  MainAsked = 'main-asked',
  MainBuild = 'main-build',
  MainBuilt = 'main-built',
  Thumb = 'thumb',
  Images = 'images',
  AllVectors = 'all-vectors',
  Sharp = 'sharp'
}

export type FrameSteps = { id: string; steps: { step: Step; at: number; group: string }[] };

export function markFrame(group: string, step: Step) {
  performance.mark(`${PREFIX}${step}${SEPARATOR}${group}`);
}

export function timeline(marks: readonly { name: string; startTime: number }[]): FrameSteps[] {
  const rows = new Map<string, FrameSteps>();
  for (const m of marks.filter((m) => m.name.startsWith(PREFIX))) {
    const [step, group] = m.name.slice(PREFIX.length).split(SEPARATOR);
    const id = group.split(GROUP_SEPARATOR).slice(0, group.includes(VIEW) ? 2 : 1).join(GROUP_SEPARATOR);
    const row = rows.get(id) ?? rows.set(id, { id, steps: [] }).get(id)!;
    row.steps.push({ step: step as Step, at: Math.round(m.startTime), group });
  }
  return [...rows.values()];
}

type Listed = { kind: string; src?: string; items?: Listed[] };

const noted = new Map<string, string[]>();

const sourcesIn = (items: readonly Listed[]): string[] => items.flatMap((i) => [...(i.kind === 'image' && i.src ? [i.src] : []), ...sourcesIn(i.items ?? [])]);

export function noteImages(id: string, list: { items: readonly Listed[] }) {
  noted.set(id, [...new Set(sourcesIn(list.items).map((src) => new URL(src, location.href).href))]);
  markFrame(id, Step.Images);
}

export const imagesNoted = (): ReadonlyMap<string, readonly string[]> => noted;
