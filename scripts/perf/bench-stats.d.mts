export type Metric = 'fps' | 'p95' | 'worst' | 'cpuMs' | 'sharpMs';
export declare const METRICS: Record<Metric, { label: string; better: 'higher' | 'lower' }>;
export declare const median: (runs: Record<Metric, number>[]) => Record<Metric, number>;
