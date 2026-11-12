export type PaintFacts = { transforms: string[]; masks: string[]; canvases: number };

const TILT_EPSILON = 0.01;
const FLAT = /^matrix\(([^)]+)\)$/;

const tilted = (transform: string) => {
  const flat = FLAT.exec(transform);
  return flat ? flat[1].split(',').map(Number).slice(1, 3).some((v) => Math.abs(v) > TILT_EPSILON) : false;
};

const RULES: [(facts: PaintFacts) => boolean, string][] = [
  [(f) => f.transforms.some((t) => t.startsWith('matrix3d(')), 'a 3D transform comes in flat'],
  [(f) => f.transforms.some(tilted), 'a rotation comes in unrotated'],
  [(f) => f.masks.some((m) => m !== 'none' && !m.includes('gradient(')), 'an image mask is not imported'],
  [(f) => f.canvases > 0, 'a <canvas> drawing comes in as one still frame']
];

export function droppedConstruct(facts: PaintFacts): string | null {
  return RULES.find(([applies]) => applies(facts))?.[1] ?? null;
}
