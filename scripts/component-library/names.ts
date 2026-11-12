const DEMO_SUFFIX = 'demo';

const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

export const isDemo = (setName: string) => key(setName).endsWith(DEMO_SUFFIX);

export function itemFor<T extends { name: string }>(items: T[], setName: string): T | null {
  const wanted = key(setName);
  return items.find((i) => key(i.name) === wanted || `${key(i.name)}${DEMO_SUFFIX}` === wanted) ?? null;
}
