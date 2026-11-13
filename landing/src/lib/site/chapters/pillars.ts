export enum PillarId {
  Code = 'codebase',
  Motion = 'motion',
  Ai = 'generate'
}

export type Pillar = { id: PillarId; number: string; name: string };

export const PILLARS: readonly Pillar[] = [
  { id: PillarId.Code, number: '01', name: 'Code' },
  { id: PillarId.Motion, number: '02', name: 'Motion' },
  { id: PillarId.Ai, number: '03', name: 'AI' }
];
