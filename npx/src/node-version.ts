export const MIN_NODE_MAJOR = 20;

export const majorOf = (version: string): number => Number(version.replace(/^v/, '').split('.')[0]);

export const nodeSupported = (version: string): boolean => majorOf(version) >= MIN_NODE_MAJOR;
