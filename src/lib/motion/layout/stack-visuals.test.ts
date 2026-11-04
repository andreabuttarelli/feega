import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { CodeTarget, exportCode } from '@feega/motion-core/motion/codegen/index';
import { EffectKind } from '@feega/motion-core/motion/effects/registry';
import { setAutoLayout, wrapInStack } from './ops';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const texted = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'Hello', x: 0.5, y: 0.5, width: 0.4, height: 0.1 } }, 't'));
const wrapped = must(setAutoLayout(must(wrapInStack(texted, ['t'], 'stack', 'lane')), 'stack', { padding: { top: 16, right: 16, bottom: 16, left: 16 } }));

const SHADOW = { id: 'fx1', kind: EffectKind.DropShadow, enabled: true, params: { distance: 0, blur: 12, opacity: 0.5, color: '#000000' } };

const styled: MotionDoc = {
  ...wrapped,
  tracks: wrapped.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'stack' ? { ...c, clipContent: true, effects: [SHADOW], props: { ...c.props, fill: '#ff3366', roundness: 0.1 } } : c)) }))
};

const files = exportCode(styled, { name: 'Card', target: CodeTarget.Html }).files;
const content = (path: string) => files.find((f) => f.path === path)?.content ?? '';
const tokens = new Map([...content('styles/tokens.css').matchAll(/(--[\w-]+): ([^;]+);/g)].map((m) => [m[1], m[2]]));
const css = content('styles/page.css').replace(/var\((--[\w-]+)\)/g, (_, name: string) => tokens.get(name) ?? name);

describe('a Stack exports its own visuals on the flex box', () => {
  it('paints its fill', () => {
    expect(css).toContain('background-color: #ff3366');
  });

  it('rounds its corners', () => {
    expect(css).toMatch(/border-radius: \d+px/);
  });

  it('clips its content', () => {
    expect(css).toContain('overflow: hidden');
  });

  it('casts its shadow', () => {
    expect(css).toContain('box-shadow');
  });

  it('lays out with flex and padding', () => {
    expect(css).toContain('display: flex');
    expect(css).toMatch(/padding: 16px/);
  });
});
