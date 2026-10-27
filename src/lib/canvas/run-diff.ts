export type DiffableRun = { prompt: string | null; model: string | null; params?: Record<string, unknown> | null };

export type RunDifference = { field: string; a: unknown; b: unknown };

type Pair = [field: string, a: unknown, b: unknown];

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function diffRuns(a: DiffableRun, b: DiffableRun): RunDifference[] {
  const named: Pair[] = [
    ['prompt', a.prompt || null, b.prompt || null],
    ['model', a.model, b.model]
  ];
  const settings: Pair[] = Object.keys({ ...a.params, ...b.params }).map((key) => [key, a.params?.[key], b.params?.[key]]);

  return [...named, ...settings].filter(([, left, right]) => !same(left, right)).map(([field, left, right]) => ({ field, a: left ?? null, b: right ?? null }));
}
