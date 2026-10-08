export enum LivePaint {
  Style = 'style',
  Lens = 'lens'
}

export enum LensKind {
  Glass = 'glass',
  Blob = 'blob'
}

export type LensSpec = { id: string; kind: LensKind; from: number; length: number; base: Record<string, number[]>; tint: string[] };
