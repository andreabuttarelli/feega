export type FileChange = { path: string; before: string; after: string; encoding?: 'base64' };

export type ReadFile = (path: string) => Promise<string | null>;
