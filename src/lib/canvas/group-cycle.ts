export function nestsInItself(parents: ReadonlyMap<string, string | null>, child: string, group: string | null): boolean {
  const seen = new Set<string>();
  for (let at = group; at !== null && !seen.has(at); at = parents.get(at) ?? null) {
    if (at === child) {
      return true;
    }
    seen.add(at);
  }
  return false;
}
