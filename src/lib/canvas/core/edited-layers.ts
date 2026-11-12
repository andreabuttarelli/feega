export function editedLayers<L extends { id: string; group: string }>(held: readonly L[], live: ReadonlyMap<string, string>): L[] {
  return held.filter((l) => live.get(l.id) === l.group);
}
