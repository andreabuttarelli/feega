import { Ease } from '../../design';
import { Align, Direction, Justify } from '../../layout/auto-layout';
import type { MotionDoc } from '../../doc';
import { ActionKind, TransitionKind, TriggerKind } from '../../prototype/model';
import { DEFAULT_INTERACTIVE } from '../../interactive/settings';
import { box, DocKit } from './kit';

const W = 1280;
const H = 720;
const INK = '#0b1220';
const BRAND = '#4f46e5';
const PAPER = '#ffffff';
const RISE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function page(kit: DocKit) {
  kit.frame('page', { name: 'Launch', box: box(0, 0, W, H), fill: PAPER, layout: { direction: Direction.Vertical, align: Align.Center, justify: Justify.Center, gap: 32 } });
}

export function entranceDoc(): MotionDoc {
  const kit = new DocKit(W, H);
  page(kit);
  kit.text('headline', 'Release notes, written for you', {
    parent: 'page',
    name: 'Headline',
    size: 56,
    weight: 600,
    color: INK,
    animate: {
      opacity: [
        { frame: 6, value: 0, ease: RISE },
        { frame: 24, value: 1, ease: Ease.Linear }
      ],
      y: [
        { frame: 6, value: 0.04, ease: RISE },
        { frame: 24, value: 0, ease: Ease.Linear }
      ]
    }
  });
  return kit.doc();
}

export function springDoc(): MotionDoc {
  const kit = new DocKit(W, H);
  page(kit);
  kit.frame('card', {
    name: 'Card',
    parent: 'page',
    box: box(0, 0, 360, 220),
    fill: BRAND,
    radius: 16,
    animate: {
      scale: [
        { frame: 0, value: 0.6, ease: Ease.Elastic, intensity: 0.5 },
        { frame: 30, value: 1, ease: Ease.Linear }
      ]
    }
  });
  return kit.doc();
}

export function loopDoc(): MotionDoc {
  const kit = new DocKit(W, H);
  page(kit);
  kit.frame('dot', {
    name: 'Live dot',
    parent: 'page',
    box: box(0, 0, 16, 16),
    fill: '#12b981',
    radius: 8,
    animate: {
      opacity: [
        { frame: 0, value: 1, ease: Ease.Standard },
        { frame: 10, value: 0.2, ease: Ease.Standard },
        { frame: 20, value: 1, ease: Ease.Linear }
      ]
    }
  });
  return { ...kit.doc(), workArea: { from: 0, to: 30 }, interactive: { ...DEFAULT_INTERACTIVE, loop: true } };
}

export function hoverDoc(): MotionDoc {
  const kit = new DocKit(W, H);
  page(kit);
  kit.frame('cta', {
    name: 'Cta',
    parent: 'page',
    box: box(0, 0, 180, 52),
    fill: BRAND,
    radius: 10,
    layout: { direction: Direction.Horizontal, justify: Justify.Center, align: Align.Center },
    animate: {
      scale: [
        { frame: 0, value: 1, ease: [0.2, 0, 0, 1] },
        { frame: 6, value: 1.06, ease: Ease.Linear }
      ]
    },
    interactions: [{ id: 'grow', trigger: { kind: TriggerKind.Hover }, action: { kind: ActionKind.ScrollTo, target: 'page' }, transition: { kind: TransitionKind.Instant } }]
  });
  kit.text('cta-label', 'Get the beta', { parent: 'cta', name: 'Label', size: 16, weight: 600, color: PAPER });
  return kit.doc();
}
