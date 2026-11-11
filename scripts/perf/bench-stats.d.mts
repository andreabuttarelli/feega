export type Metric = 'fps' | 'p95' | 'worst' | 'cpuMs' | 'sharpMs';
export declare const METRICS: Record<Metric, { label: string; better: 'higher' | 'lower' }>;
export declare const median: (runs: Record<Metric, number>[]) => Record<Metric, number>;
export declare const mid: (values: number[]) => number;
export type AdapterInfo = { vendor: string; architecture: string; description: string };
export declare const softwareAdapter: (info: AdapterInfo | null) => boolean;
export type LevelFrame = { at: number; step: number; unsharp: number };
export declare const levelSharpMs: (frames: LevelFrame[]) => { times: number[]; superseded: number };
