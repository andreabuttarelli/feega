export declare const Bucket: Record<'Plan' | 'Lay' | 'PrepareItems' | 'Encode' | 'Present' | 'Tiles' | 'WasmOther' | 'GpuCalls' | 'Glue' | 'Gc' | 'Native' | 'Idle' | 'Js', string>;
type CallFrame = { functionName: string; url: string };
export type CpuProfile = { nodes: { id: number; callFrame: CallFrame; children?: number[] }[]; samples: number[]; timeDeltas: number[] };
export declare function buckets(profile: CpuProfile): Record<string, number>;
