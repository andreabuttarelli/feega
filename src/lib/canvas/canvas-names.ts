const UNTITLED_PREFIX = 'Untitled canvas ';

export function nextCanvasName(existing: string[]): string {
  const taken = existing
    .filter((name) => name.startsWith(UNTITLED_PREFIX))
    .map((name) => Number(name.slice(UNTITLED_PREFIX.length)))
    .filter(Number.isInteger);

  return `${UNTITLED_PREFIX}${Math.max(0, ...taken) + 1}`;
}
