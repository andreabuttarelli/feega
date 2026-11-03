type Stacked = { behind?: boolean };

export const backToFront = <T extends Stacked>(items: readonly T[]): T[] => [...items.filter((t) => t.behind), ...items.filter((t) => !t.behind)];

export const frontToBack = <T extends Stacked>(items: readonly T[]): T[] => backToFront(items).reverse();
