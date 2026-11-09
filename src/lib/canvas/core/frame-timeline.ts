const PREFIX = 'frame|';
const SEPARATOR = '|';
const GROUP_SEPARATOR = ':';

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
  MainBuilt = 'main-built'
}

export type FrameSteps = { id: string; steps: { step: Step; at: number; group: string }[] };

export function markFrame(group: string, step: Step) {
  performance.mark(`${PREFIX}${step}${SEPARATOR}${group}`);
}

export function timeline(marks: readonly { name: string; startTime: number }[]): FrameSteps[] {
  const rows = new Map<string, FrameSteps>();
  for (const m of marks.filter((m) => m.name.startsWith(PREFIX))) {
    const [step, group] = m.name.slice(PREFIX.length).split(SEPARATOR);
    const id = group.split(GROUP_SEPARATOR)[0];
    const row = rows.get(id) ?? rows.set(id, { id, steps: [] }).get(id)!;
    row.steps.push({ step: step as Step, at: Math.round(m.startTime), group });
  }
  return [...rows.values()];
}
