export type Spec = { doc: unknown; assets: Record<string, string>; origin: string; faces?: string };
export type ShotsInput = { html: string; spec: Spec; displayWidth?: number; times: number[]; width: number; height: number; preference: string };
export type ShotsResult = { pngs: string[]; ms: number; backend: string; runs: number; stats: Record<string, number>[]; unsupported?: string[] };
export type ExportInput = { html: string; spec: Spec; times: number[]; width: number; height: number; fps: number; lanes: number; preference: string; keep: boolean };
export type ExportResult = { wallMs: number; frames: number; mp4: string | null; fallback?: boolean };
export type PreviewInput = { html: string; spec: Spec; seconds: number; warmMs: number; preference: string };
export type PreviewResult = { frames: number; p50: number; p95: number; dropped: number; worst: number; workP50: number; workP95: number };
