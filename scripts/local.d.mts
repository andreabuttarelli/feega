export declare const fileEnv: (cwd?: string, root?: string) => Record<string, string>;
export declare function localEnv(file: string, port: string, base?: NodeJS.ProcessEnv, fromFile?: Record<string, string>): Record<string, string | undefined>;
