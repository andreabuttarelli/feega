const KEY_SEPARATOR = ':';

const ownedBy = (key: string, frameId: string) => key.startsWith(`${frameId}${KEY_SEPARATOR}`);

export function listed<T>(lists: ReadonlyMap<string, T>, frameId: string, key: string, list: T, shown: Iterable<string | undefined>): Map<string, T> {
  const keep = new Set([...shown, key]);
  const next = new Map([...lists].filter(([k]) => !ownedBy(k, frameId) || keep.has(k)));
  return next.set(key, list);
}
