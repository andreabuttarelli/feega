export type FileChange = { path: string; before: string; after: string };

export type ReadFile = (path: string) => Promise<string | null>;
