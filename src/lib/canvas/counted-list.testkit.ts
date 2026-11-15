export type Counted<T> = T[] & { scans: () => number };

export function counted<T>(items: T[]): Counted<T> {
  let scans = 0;
  const list = [...items] as Counted<T>;
  for (const name of ['includes', 'indexOf', 'find', 'findIndex', 'some'] as const) {
    const original = Array.prototype[name] as (...args: unknown[]) => unknown;
    Object.defineProperty(list, name, {
      value: (...args: unknown[]) => {
        scans += 1;
        return original.apply(list, args);
      }
    });
  }
  list.scans = () => scans;
  return list;
}
