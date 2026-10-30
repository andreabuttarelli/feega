export function tablesFromMigrations(dir?: string): string[];
export function checksFromMigrations(dir?: string): Record<string, string>;
export function writableColumnsFromMigrations(dir?: string): Record<string, { insert: string[]; update: string[] }>;
