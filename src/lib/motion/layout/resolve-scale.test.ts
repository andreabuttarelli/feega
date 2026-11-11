import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { DEFAULT_AUTO_LAYOUT } from '@feega/motion-core/motion/layout/model';
import { withAutoLayout } from '@feega/motion-core/motion/layout/resolve';

const KIDS = 4;
const SMALL = 400;
const GROWTH = 8;
const LINEAR_BOUND = 16;
const REPEATS = 3;

const box = { x: 0.5, y: 0.5, width: 0.1, height: 0.1 };
const clip = (id: string, extra: Partial<MotionClip>): MotionClip => ({ id, component: 'Shape', start: 0, duration: 1, props: { ...box }, ...extra }) as MotionClip;

function stacked(containers: number): MotionDoc {
  const doc = newMotionDoc(MotionFormat.Landscape);
  const root = clip('root', { autoLayout: { ...DEFAULT_AUTO_LAYOUT, order: [] } });
  const clips = [root];
  for (let c = 0; c < containers; c++) {
    clips.push(clip(`c${c}`, { parent: 'root', autoLayout: { ...DEFAULT_AUTO_LAYOUT, order: Array.from({ length: KIDS }, (_, k) => `c${c}k${k}`).reverse() } }));
    for (let k = 0; k < KIDS; k++) {
      clips.push(clip(`c${c}k${k}`, { parent: `c${c}` }));
    }
  }
  return { ...doc, tracks: [{ ...doc.tracks[0], clips }] } as MotionDoc;
}

function fastest(doc: MotionDoc): number {
  let best = Infinity;
  for (let i = 0; i < REPEATS; i++) {
    const started = performance.now();
    withAutoLayout(doc);
    best = Math.min(best, performance.now() - started);
  }
  return best;
}

describe('auto layout on an imported page', () => {
  it('grows linearly with the number of stacks, not with their square', () => {
    const small = fastest(stacked(SMALL));
    const large = fastest(stacked(SMALL * GROWTH));

    expect(large / small).toBeLessThan(LINEAR_BOUND);
  });

  it('keeps each stack in its declared order', () => {
    const laid = withAutoLayout(stacked(2));
    const at = (id: string) => { const p = laid.tracks[0].clips.find((c) => c.id === id)!.props; return Number(p.x) + Number(p.y); };

    expect(at('c0k3')).toBeLessThan(at('c0k0'));
  });
});
