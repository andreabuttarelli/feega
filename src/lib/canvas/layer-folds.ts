export const FOLDS_KEY = 'feega:layers-folded';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function readFolds(store: Store): Set<string> {
  try {
    const ids: unknown = JSON.parse(store.getItem(FOLDS_KEY) ?? '[]');
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

export function toggleFold(store: Store, folds: ReadonlySet<string>, nodeId: string): Set<string> {
  const next = new Set(folds);
  if (!next.delete(nodeId)) {
    next.add(nodeId);
  }
  try {
    store.setItem(FOLDS_KEY, JSON.stringify([...next]));
  } catch (e) {
    console.warn('[layers] fold not kept in this browser', e);
  }
  return next;
}
