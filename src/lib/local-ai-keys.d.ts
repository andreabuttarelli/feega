export type LocalAiProvider = { name: string; label: string; required: readonly string[]; optional: readonly string[] };
export declare const LOCAL_AI_PROVIDERS: readonly LocalAiProvider[];
export declare const AI_KEY_VARS: readonly string[];
export declare const keyedProviders: (env: Record<string, string | undefined>) => LocalAiProvider[];
export declare const hasAiKey: (env: Record<string, string | undefined>) => boolean;
