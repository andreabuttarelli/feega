import { Ease, TransitionKind } from '$lib/motion/design';
import { DEVICES, Device } from '$lib/motion/devices';
import { IMAGE_ZOOM, TITLE_LOOK } from '$lib/motion/components';
import { FontCategory, FontSource, type FontFace } from '$lib/motion/fonts/model';
import { EASE_BEZIER } from '$lib/motion/keyframes';
import { STYLES } from '$lib/motion/style';
import { MotionStyle } from '$lib/motion/style-model';
import { FillKind } from '$lib/motion/shape/schema';
import { edge, type Beat, type Key } from '$lib/motion/template-kit';
import { FieldType } from './fields';
import { boxAspect, colour, text, type Design, type Field } from './design-kit';

const APPLE = STYLES[MotionStyle.AppleMinimal];
const { ink: INK, paper: PAPER, muted: MUTED } = APPLE.palette;
const ACCENT = 'brand.accent';
const FAMILY = APPLE.type.family;
const { hero: HERO, line: LINE, small: SMALL } = APPLE.type.sizes;
const { display: DISPLAY, text: BODY } = APPLE.type.weights;
const ENTER = APPLE.eases.enter;
const LINEAR = EASE_BEZIER[Ease.Linear];
const SNAP = 0.4;
const STAGGER = APPLE.seconds.stagger;
const SHOW = 0.5;
const OUT = edge(TransitionKind.Fade, APPLE.seconds.exit);
const DRIFT = 0.012;
const WORD_BEAT = 1.97;

const FONTS: FontFace[] = [{ family: FAMILY, source: FontSource.Google, category: FontCategory.Sans, weights: [BODY, DISPLAY], italic: false, axes: [] }];

const display = (size: number, color = PAPER) => ({ font: FAMILY, weight: DISPLAY, size, color, tracking: TITLE_LOOK.tracking, leading: 1.04 });
const body = (size: number, color = PAPER) => ({ font: FAMILY, weight: BODY, size, color, tracking: size <= SMALL ? 0 : -0.02, leading: 1.25 });
const line = (color = PAPER) => ({ ...body(LINE, color), weight: DISPLAY, tracking: TITLE_LOOK.tracking });

function snapUp(seconds = SNAP): Record<string, Key[]> {
  return {
    opacity: [[0, 0, ENTER], [seconds, 1, ENTER]],
    y: [[0, APPLE.movement.rise, ENTER], [seconds, 0, ENTER]],
    blur: [[0, APPLE.movement.blur, ENTER], [seconds, 0, ENTER]]
  };
}

function settle(seconds = SNAP): Record<string, Key[]> {
  return {
    opacity: [[0, 0, ENTER], [seconds, 1, ENTER]],
    scale: [[0, APPLE.movement.settle, ENTER], [seconds, 1, ENTER]],
    blur: [[0, APPLE.movement.blur, ENTER], [seconds, 0, ENTER]]
  };
}

function drift(len: number, from = 1, pan = DRIFT): Record<string, Key[]> {
  return {
    opacity: [[0, 0, ENTER], [SHOW, 1, ENTER]],
    scale: [[0, from, LINEAR], [len, from * APPLE.movement.pushIn, LINEAR]],
    x: [[0, pan, LINEAR], [len, -pan, LINEAR]]
  };
}

const fill = (fillColour: string, seconds: number, id = 'bg'): Beat => ({ id, track: 'back', component: 'Shape', at: 0, len: seconds, props: { shape: 'rect', fill: fillColour, x: 0.5, y: 0.5, width: 1, height: 1 } });
const picture = (key: string, label: string, clipId: string, box: { width: number; height: number }): Field => ({ key, label, type: FieldType.Asset, clipId, prop: 'assetId', aspect: boxAspect(box.width, box.height) });
const amount = (key: string, label: string, clipId: string, prop: string): Field => ({ key, label, type: FieldType.Number, clipId, prop, min: 0, max: 1 });

const FULL = { width: 1, height: 1 };
const BAND = { width: 1, height: 0.8 };
const PRODUCT = { width: 0.66, height: 0.7 };
const WINDOW = { width: 0.74, height: 0.66 };
const LOGO = { width: 0.14, height: 0.2 };

const SCENE_DESIGNS: Omit<Design, 'fonts'>[] = [
  {
    id: 'scene-hero-title',
    name: 'Scene · Hero title',
    description: 'Apple minimal. One giant line on black, its words snapping up one after another. The hook.',
    seconds: 3,
    beats: [fill(INK, 3), { id: 'title', track: 'front', component: 'Text', at: 0.1, len: 2.9, props: { text: 'Think different.', ...display(HERO), y: 0.5, width: 0.9, height: 0.34 }, keys: snapUp(), exit: OUT }],
    fields: [text('title', 'Title', 'title'), colour('background', 'Background', 'bg', 'fill'), colour('text_color', 'Title colour', 'title', 'color')]
  },
  {
    id: 'scene-eyebrow-title',
    name: 'Scene · Eyebrow and title',
    description: 'Apple minimal. A small accent eyebrow, then a giant title under it a beat later.',
    seconds: 3.5,
    beats: [
      fill(INK, 3.5),
      { id: 'eyebrow', track: 'middle', component: 'Text', at: 0.1, len: 3.4, props: { text: 'Introducing', ...body(SMALL, ACCENT), y: 0.33, width: 0.6, height: 0.06 }, keys: snapUp(), exit: OUT },
      { id: 'title', track: 'front', component: 'Text', at: 0.1 + STAGGER * 1.5, len: 3.4 - STAGGER * 1.5, props: { text: 'The new thing.', ...display(HERO), y: 0.52, width: 0.9, height: 0.3 }, keys: snapUp(), exit: OUT }
    ],
    fields: [text('eyebrow', 'Eyebrow', 'eyebrow'), text('title', 'Title', 'title'), colour('accent', 'Eyebrow colour', 'eyebrow', 'color'), colour('background', 'Background', 'bg', 'fill'), colour('text_color', 'Title colour', 'title', 'color')]
  },
  {
    id: 'scene-feature-line',
    name: 'Scene · Feature line',
    description: 'Apple minimal. One sentence, large, centred on black: one feature per scene.',
    seconds: 3.5,
    beats: [fill(INK, 3.5), { id: 'line', track: 'front', component: 'Text', at: 0.1, len: 3.4, props: { text: 'One idea, said simply.', ...line(), y: 0.5, width: 0.74, height: 0.36 }, keys: snapUp(), exit: OUT }],
    fields: [text('line', 'Line', 'line'), colour('background', 'Background', 'bg', 'fill'), colour('text_color', 'Text colour', 'line', 'color')]
  },
  {
    id: 'scene-feature-line-light',
    name: 'Scene · Feature line, light',
    description: 'Apple minimal. The feature line in black on white, to alternate with the dark scenes.',
    seconds: 3,
    beats: [fill(PAPER, 3), { id: 'line', track: 'front', component: 'Text', at: 0.1, len: 2.9, props: { text: 'Built for teams.', ...line(INK), y: 0.5, width: 0.74, height: 0.36 }, keys: snapUp(), exit: OUT }],
    fields: [text('line', 'Line', 'line'), colour('background', 'Background', 'bg', 'fill'), colour('text_color', 'Text colour', 'line', 'color')]
  },
  {
    id: 'scene-feature-accent',
    name: 'Scene · Feature with accent',
    description: 'Apple minimal. A line in white, the second line in the accent colour right after it.',
    seconds: 3.5,
    beats: [
      fill(INK, 3.5),
      { id: 'line', track: 'middle', component: 'Text', at: 0.1, len: 3.4, props: { text: 'Simple to start.', ...line(), y: 0.43, width: 0.8, height: 0.14 }, keys: snapUp(), exit: OUT },
      { id: 'accent_line', track: 'front', component: 'Text', at: 0.1 + STAGGER * 3, len: 3.4 - STAGGER * 3, props: { text: 'Built to scale.', ...line(ACCENT), y: 0.57, width: 0.8, height: 0.14 }, keys: snapUp(), exit: OUT }
    ],
    fields: [text('line', 'Line', 'line'), text('accent_line', 'Accent line', 'accent_line'), colour('accent', 'Accent', 'accent_line', 'color'), colour('background', 'Background', 'bg', 'fill')]
  },
  {
    id: 'scene-big-number',
    name: 'Scene · Big number',
    description: 'Apple minimal. One huge number in the accent colour, what it measures in small grey type under it.',
    seconds: 3.5,
    beats: [
      fill(INK, 3.5),
      { id: 'number', track: 'front', component: 'Text', at: 0.1, len: 3.4, props: { text: '10×', ...display(0.3, ACCENT), y: 0.45, width: 0.9, height: 0.42 }, keys: settle(), exit: OUT },
      { id: 'label', track: 'middle', component: 'Text', at: 0.1 + STAGGER * 2, len: 3.4 - STAGGER * 2, props: { text: 'faster than before', ...body(SMALL, MUTED), y: 0.74, width: 0.6, height: 0.06 }, keys: snapUp(), exit: OUT }
    ],
    fields: [text('number', 'Number', 'number'), text('label', 'What it measures', 'label'), colour('accent', 'Number colour', 'number', 'color'), colour('background', 'Background', 'bg', 'fill')]
  },
  {
    id: 'scene-quote',
    name: 'Scene · Quote',
    description: 'Apple minimal. A large quote and its author in small grey type.',
    seconds: 4.5,
    beats: [
      fill(INK, 4.5),
      { id: 'quote', track: 'front', component: 'Text', at: 0.1, len: 4.4, props: { text: '“The best tool we added this year.”', ...line(), y: 0.45, width: 0.76, height: 0.4 }, keys: snapUp(), exit: OUT },
      { id: 'author', track: 'middle', component: 'Text', at: 0.1 + STAGGER * 4, len: 4.4 - STAGGER * 4, props: { text: 'Ada Lovelace, Analytical Engines', ...body(SMALL, MUTED), y: 0.72, width: 0.6, height: 0.06 }, keys: snapUp(), exit: OUT }
    ],
    fields: [text('quote', 'Quote', 'quote'), text('author', 'Author', 'author'), colour('background', 'Background', 'bg', 'fill'), colour('text_color', 'Quote colour', 'quote', 'color')]
  },
  {
    id: 'scene-split-statement',
    name: 'Scene · Split statement',
    description: 'Apple minimal. A big statement on the left, one small explaining paragraph on the right.',
    seconds: 4,
    beats: [
      fill(INK, 4),
      { id: 'statement', track: 'front', component: 'Text', at: 0.1, len: 3.9, props: { text: 'Fast.\nBy design.', ...display(HERO), x: 0.3, y: 0.5, width: 0.46, height: 0.5, align: 'left' }, keys: snapUp(), exit: OUT },
      { id: 'detail', track: 'middle', component: 'Text', at: 0.1 + STAGGER * 4, len: 3.9 - STAGGER * 4, props: { text: 'It explains the line.', ...body(SMALL, MUTED), x: 0.74, y: 0.56, width: 0.3, height: 0.2, align: 'left' }, keys: snapUp(), exit: OUT }
    ],
    fields: [text('statement', 'Statement', 'statement'), text('detail', 'Detail', 'detail'), colour('background', 'Background', 'bg', 'fill'), colour('text_color', 'Statement colour', 'statement', 'color')]
  },
  {
    id: 'scene-product-reveal',
    name: 'Scene · Product reveal',
    description: 'Apple minimal. The product, or one readable section of a screenshot (zoom inside the box on focus x/y), under a soft light, drifting with a slow push-in and pan the whole time; a small caption under it.',
    seconds: 4,
    beats: [
      fill(INK, 4),
      { id: 'light', track: 'back', component: 'Shape', at: 0, len: 4, props: { shape: 'rect', fillKind: FillKind.Radial, fill: PAPER, fill2: INK, x: 0.5, y: 0.5, width: 1, height: 1, opacity: 0.14 } },
      { id: 'photo', track: 'middle', component: 'Image', at: 0, len: 4, props: { x: 0.5, y: 0.44, ...PRODUCT, fit: 'cover', focusX: 0.5, focusY: 0.2 }, keys: drift(4, 0.97), exit: OUT },
      { id: 'caption', track: 'front', component: 'Text', at: 0.5, len: 3.5, props: { text: 'Product name', ...body(SMALL, MUTED), y: 0.86, width: 0.6, height: 0.06 }, keys: snapUp(), exit: OUT }
    ],
    fields: [picture('photo', 'Product or screenshot', 'photo', PRODUCT), { key: 'fit', label: 'Photo fit', type: FieldType.Select, clipId: 'photo', prop: 'fit', options: ['contain', 'cover'] }, amount('focus_x', 'Focus X', 'photo', 'focusX'), amount('focus_y', 'Focus Y', 'photo', 'focusY'), { key: 'zoom', label: 'Zoom on the section', type: FieldType.Number, clipId: 'photo', prop: 'zoom', min: IMAGE_ZOOM.min, max: IMAGE_ZOOM.max }, text('caption', 'Caption', 'caption'), colour('background', 'Background', 'bg', 'fill')]
  },
  {
    id: 'scene-ui-closeup',
    name: 'Scene · UI close-up',
    description: 'Apple minimal. A sharp screenshot full frame, cropped on the part that matters (focus x/y), pushing in and panning the whole time: readable, never a page shrunk small, never zoomed past its pixels.',
    seconds: 4,
    beats: [
      fill(INK, 4),
      { id: 'screen', track: 'middle', component: 'Image', at: 0, len: 4, props: { x: 0.5, y: 0.5, ...FULL, fit: 'cover', focusX: 0.5, focusY: 0.3 }, keys: drift(4), exit: OUT }
    ],
    fields: [picture('screen', 'Screenshot', 'screen', FULL), amount('focus_x', 'Focus X', 'screen', 'focusX'), amount('focus_y', 'Focus Y', 'screen', 'focusY')]
  },
  {
    id: 'scene-ui-window',
    name: 'Scene · UI window',
    description: 'Apple minimal. A screenshot as a large window under one small line, drifting in slowly.',
    seconds: 4.5,
    beats: [
      fill(INK, 4.5),
      { id: 'caption', track: 'front', component: 'Text', at: 0.1, len: 4.4, props: { text: 'One small line about the screen.', ...body(SMALL), y: 0.12, width: 0.6, height: 0.06 }, keys: snapUp(), exit: OUT },
      { id: 'screen', track: 'middle', component: 'Image', at: 0.1 + STAGGER, len: 4.4 - STAGGER, props: { x: 0.5, y: 0.58, ...WINDOW, fit: 'cover', focusX: 0.5, focusY: 0 }, keys: drift(4.4 - STAGGER, 0.98, DRIFT / 2), exit: OUT }
    ],
    fields: [picture('screen', 'Screenshot', 'screen', WINDOW), text('caption', 'Caption', 'caption'), amount('focus_y', 'Focus Y', 'screen', 'focusY'), colour('background', 'Background', 'bg', 'fill')]
  },
  {
    id: 'scene-device-hero',
    name: 'Scene · Device hero',
    description: 'Apple minimal. A device with the screenshot on its screen, turning a few degrees, slowly, on black.',
    seconds: 4,
    beats: [
      fill(INK, 4),
      { id: 'device', track: 'middle', component: 'Device3D', at: 0, len: 4, props: { device: Device.LaptopPro, startAngle: -APPLE.movement.turn, endAngle: APPLE.movement.turn, easing: Ease.Linear, lighting: 'studio', zoom: 1.25, x: 0.5, y: 0.5, width: 1, height: 1 }, keys: { opacity: [[0, 0, ENTER], [SHOW, 1, ENTER]] }, exit: OUT }
    ],
    fields: [{ ...picture('screen', 'Screen', 'device', { width: 16, height: 10 }), prop: 'screen' }, { key: 'device', label: 'Device', type: FieldType.Select, clipId: 'device', prop: 'device', options: [...DEVICES] }, colour('background', 'Background', 'bg', 'fill')]
  },
  {
    id: 'scene-device-split',
    name: 'Scene · Device and line',
    description: 'Apple minimal. A phone on the right turning slightly, one large line on the left.',
    seconds: 4,
    beats: [
      fill(INK, 4),
      { id: 'line', track: 'front', component: 'Text', at: 0.2, len: 3.8, props: { text: 'In your pocket.', ...line(), x: 0.3, y: 0.5, width: 0.42, height: 0.3, align: 'left' }, keys: snapUp(), exit: OUT },
      { id: 'device', track: 'middle', component: 'Device3D', at: 0, len: 4, props: { device: Device.PhonePro, startAngle: -APPLE.movement.turn, endAngle: APPLE.movement.turn, easing: Ease.Linear, lighting: 'studio', x: 0.7, y: 0.5, width: 0.5, height: 0.92 }, keys: { opacity: [[0, 0, ENTER], [SHOW, 1, ENTER]] }, exit: OUT }
    ],
    fields: [{ ...picture('screen', 'Screen', 'device', { width: 9, height: 19.5 }), prop: 'screen' }, text('line', 'Line', 'line'), colour('background', 'Background', 'bg', 'fill')]
  },
  {
    id: 'scene-media-caption',
    name: 'Scene · Picture with a line',
    description: 'Apple minimal. A picture across the frame drifting the whole time, one line in the black band under it.',
    seconds: 4,
    beats: [
      fill(INK, 4),
      { id: 'photo', track: 'middle', component: 'Image', at: 0, len: 4, props: { x: 0.5, y: 0.4, ...BAND, fit: 'cover' }, keys: drift(4), exit: OUT },
      { id: 'line', track: 'front', component: 'Text', at: 0.3, len: 3.7, props: { text: 'One line under the picture.', ...line(), y: 0.9, width: 0.8, height: 0.1 }, keys: snapUp(), exit: OUT }
    ],
    fields: [picture('photo', 'Picture', 'photo', BAND), text('line', 'Line', 'line')]
  },
  {
    id: 'scene-dissolve',
    name: 'Scene · Dissolve',
    description: 'Apple minimal. Two pictures full frame, each drifting the whole time, the second dissolving over the first.',
    seconds: 5,
    beats: [
      { id: 'first', track: 'back', component: 'Image', at: 0, len: 3.4, props: { x: 0.5, y: 0.5, ...FULL, fit: 'cover' }, keys: drift(3.4) },
      { id: 'second', track: 'middle', component: 'Image', at: 2.2, len: 2.8, props: { x: 0.5, y: 0.5, ...FULL, fit: 'cover' }, keys: { ...drift(2.8, 1, -DRIFT), opacity: [[0, 0, ENTER], [1.2, 1, ENTER]] }, exit: OUT }
    ],
    fields: [picture('first', 'First picture', 'first', FULL), picture('second', 'Second picture', 'second', FULL)]
  },
  {
    id: 'scene-match-cut',
    name: 'Scene · Match cut',
    description: 'Apple minimal. Three words cut on the beat in the same place, the last in the accent colour.',
    seconds: 3 * WORD_BEAT,
    beats: [
      fill(INK, 3 * WORD_BEAT),
      { id: 'word_1', track: 'front', component: 'Text', at: 0, len: WORD_BEAT, props: { text: 'Fast.', ...display(HERO), y: 0.5, width: 0.9, height: 0.3 }, keys: snapUp(0.3) },
      { id: 'word_2', track: 'front', component: 'Text', at: WORD_BEAT, len: WORD_BEAT, props: { text: 'Simple.', ...display(HERO), y: 0.5, width: 0.9, height: 0.3 } },
      { id: 'word_3', track: 'front', component: 'Text', at: 2 * WORD_BEAT, len: WORD_BEAT, props: { text: 'Yours.', ...display(HERO, ACCENT), y: 0.5, width: 0.9, height: 0.3 }, exit: OUT }
    ],
    fields: [text('word_1', 'First word', 'word_1'), text('word_2', 'Second word', 'word_2'), text('word_3', 'Third word', 'word_3'), colour('accent', 'Last word colour', 'word_3', 'color'), colour('background', 'Background', 'bg', 'fill')]
  },
  {
    id: 'scene-three-points',
    name: 'Scene · Three points',
    description: 'Apple minimal. Three short lines snapping in one after another, one under the other.',
    seconds: 4.5,
    beats: [
      fill(INK, 4.5),
      { id: 'point_1', track: 'front', component: 'Text', at: 0.1, len: 4.4, props: { text: 'First point.', ...line(), y: 0.34, width: 0.8, height: 0.13 }, keys: snapUp(), exit: OUT },
      { id: 'point_2', track: 'front', component: 'Text', at: 0.1 + STAGGER * 2.5, len: 4.4 - STAGGER * 2.5, props: { text: 'Second point.', ...line(), y: 0.5, width: 0.8, height: 0.13 }, keys: snapUp(), exit: OUT },
      { id: 'point_3', track: 'front', component: 'Text', at: 0.1 + STAGGER * 5, len: 4.4 - STAGGER * 5, props: { text: 'Third point.', ...line(ACCENT), y: 0.66, width: 0.8, height: 0.13 }, keys: snapUp(), exit: OUT }
    ],
    fields: [text('point_1', 'First point', 'point_1'), text('point_2', 'Second point', 'point_2'), text('point_3', 'Third point', 'point_3'), colour('accent', 'Last point colour', 'point_3', 'color'), colour('background', 'Background', 'bg', 'fill')]
  },
  {
    id: 'scene-logo-end-card',
    name: 'Scene · Logo end card',
    description: 'Apple minimal. The logo alone in the centre, the address in small grey type under it.',
    seconds: 3.5,
    beats: [
      fill(INK, 3.5),
      { id: 'logo', track: 'front', component: 'Logo', at: 0.1, len: 3.4, props: { x: 0.5, y: 0.45, ...LOGO }, keys: settle(SHOW) },
      { id: 'url', track: 'middle', component: 'Text', at: 0.1 + STAGGER * 3, len: 3.4 - STAGGER * 3, props: { text: 'example.com', ...body(SMALL, MUTED), y: 0.64, width: 0.5, height: 0.06 }, keys: snapUp() }
    ],
    fields: [picture('logo', 'Logo', 'logo', LOGO), text('url', 'Address', 'url'), colour('background', 'Background', 'bg', 'fill')]
  }
];

export const SCENES: Design[] = SCENE_DESIGNS.map((design) => ({ ...design, fonts: FONTS }));
