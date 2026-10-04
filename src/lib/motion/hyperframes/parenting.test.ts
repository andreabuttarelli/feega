// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import gsap from 'gsap';
import { FEEGA_TOKENS } from '../brand';
import { Ease } from '../design';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { ParentOpacity } from '../parent';
import { addNull, setParent, setParentOpacity } from '../parent-ops';
import { addClip, setKeyframes, type OpResult } from '../timeline';
import { seekPlan } from '../custom/determinism';
import { composeHtml } from './compose';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const rigged = (() => {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 120, props: { shape: 'rect', x: 0.3, y: 0.5, width: 0.2, height: 0.2 } }, 'card'));
  doc = must(addClip(doc, { component: 'Text', from: 0, durationInFrames: 120 }, 'caption'));
  doc = must(addNull(doc, { from: 0, durationInFrames: 120, x: 0.4, y: 0.5 }, 'rig'));
  doc = must(setKeyframes(doc, 'rig', 'rotateZ', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 90, value: 45, ease: Ease.Linear }]));
  doc = must(setKeyframes(doc, 'rig', 'opacity', [{ frame: 0, value: 1, ease: Ease.Linear }, { frame: 90, value: 0.2, ease: Ease.Linear }]));
  doc = must(setParent(doc, 'card', 'rig'));
  doc = must(setParent(doc, 'caption', 'rig'));
  return { ...doc, durationInFrames: 120 };
})();

const compose = (doc: MotionDoc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });

describe('parenting in the composition', () => {
  it('a child sits inside a copy of its parent wrappers, outside its own', () => {
    const html = compose(rigged);
    const card = html.slice(html.indexOf('data-clip="card"'));
    const copy = card.indexOf('class="kf kc-rig ko-rig"');

    expect(copy).toBeGreaterThan(0);
    expect(copy).toBeLessThan(card.indexOf('id="sh-card"'));
  });

  it('the parent animation reaches every copy, its opacity only the children that inherit it', () => {
    const html = compose(must(setParentOpacity(rigged, 'caption', ParentOpacity.Ignore)));
    const caption = html.slice(html.indexOf('data-clip="caption"'));

    expect(html).toContain('tl.fromTo("#kf-rig,.kc-rig"');
    expect(html).toContain('tl.fromTo("#kf-rig,.ko-rig"');
    expect(caption.slice(0, caption.indexOf('</div>'))).not.toContain('ko-rig');
  });

  it('a doc without parents keeps its wrappers and selectors as they were', () => {
    const html = compose(must(setParent(rigged, 'card', null)));

    expect(html).not.toContain('kc-card');
  });
});

function boot(doc: MotionDoc) {
  const html = compose(doc);
  const root = html.slice(html.indexOf('<div id="root"'), html.lastIndexOf('</div>', html.indexOf('<script>const tl') > 0 ? html.indexOf('<script>const tl') : html.length) + 6);
  const script = /<script>([^<]*const tl=gsap\.timeline[\s\S]*?)<\/script>/.exec(html)![1];
  document.body.innerHTML = root;
  const w = window as unknown as Record<string, unknown>;
  w.gsap = gsap;
  window.eval(script);
  return (w.__timelines as Record<string, gsap.core.Timeline>).main;
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__timelines;
});

describe('parenting at runtime', () => {
  it('every copy shows the parent transform of that frame, from any seek order', () => {
    const tl = boot(rigged);
    const copies = () => [...document.querySelectorAll<HTMLElement>('.kc-rig')].map((e) => `${e.style.transform}|${e.style.opacity}`);
    const own = () => (document.getElementById('kf-rig') as HTMLElement).style.transform;

    const seen = new Map<number, string>();
    for (const t of seekPlan(4, 30)) {
      tl.totalTime(t, true);
      const shot = copies();
      expect(new Set(shot.map((s) => s.split('|')[0]))).toEqual(new Set([own()]));
      expect(seen.get(t) ?? shot.join()).toBe(shot.join());
      seen.set(t, shot.join());
    }
    expect(copies()).toHaveLength(2);
  });
});
