import { describe, expect, it } from 'vitest';
import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import { fitToNode } from '$lib/motion/custom-size';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from './page-tree';
import { urlPlan } from './url-doc';

const DARK = { r: 0.1, g: 0.1, b: 0.12, a: 1 };
const CARD = { r: 0.2, g: 0.3, b: 0.9, a: 1 };

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

const blog = (): PageTree => {
  const body = 'Right now, this information only exists on my device. But with a bit of luck, it will travel through time and space to your device.';
  const paragraph: RestNode = { id: 'p', type: 'TEXT', name: 'paragraph', characters: body, absoluteBoundingBox: box(340, 200, 600, 60), textAutoResize: 'HEIGHT', fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], style: { fontFamily: 'Inter', fontSize: 17, fontWeight: 400, lineHeightUnit: 'PIXELS', lineHeightPx: 30 } };
  const card: RestNode = { id: 'card', type: 'FRAME', name: 'code', absoluteBoundingBox: box(340, 300, 600, 120), fills: [{ type: 'SOLID', color: CARD }], children: [] };
  return { title: 'Blog', url: 'https://example.com/', width: 1280, height: 600, truncated: false, root: { id: 'root', type: 'FRAME', absoluteBoundingBox: box(0, 0, 1280, 600), fills: [{ type: 'SOLID', color: DARK }], children: [paragraph, card] } };
};

const pagePx = (doc: MotionDoc, tree: PageTree) => doc.width / tree.width;

const boxOf = (doc: MotionDoc, test: (c: MotionClip) => boolean, per: number) => {
  const laid = withAutoLayout(doc);
  const clip = (laid.tracks.flatMap((t) => t.clips) as MotionClip[]).find(test)!;
  const p = clip.props as { x: number; y: number; width: number; height: number };
  return { x: Math.round(((p.x - p.width / 2) * laid.width) / per), width: Math.round((p.width * laid.width) / per) };
};

describe('an imported page resized on the canvas', () => {
  it('reflows its centred column like the page in a narrower window: the page fills the frame, the column shrinks to it (overreacted.io at 768 and 390)', () => {
    const tree = blog();
    let n = 0;
    const doc = urlPlan(tree, () => `c${++n}`)!.plan.items[0].doc;
    const per = pagePx(doc, tree);
    const narrow = (width: number) => {
      const sized = fitToNode(doc, { width: Math.round(width * per), height: doc.height });
      return sized.ok ? sized.doc : doc;
    };
    const card = (c: MotionClip) => JSON.stringify(c.props.fills ?? '').toUpperCase().includes('#334DE6');
    const page = (c: MotionClip) => !c.parent && JSON.stringify(c.props.fills ?? '').toUpperCase().includes('#1A1A1F');

    expect(boxOf(doc, card, per)).toEqual({ x: 340, width: 600 });
    expect(boxOf(narrow(768), page, per)).toEqual({ x: 0, width: 768 });
    expect(boxOf(narrow(768), card, per)).toEqual({ x: 84, width: 600 });
    expect(boxOf(narrow(390), card, per)).toEqual({ x: 0, width: 390 });
  });
});
