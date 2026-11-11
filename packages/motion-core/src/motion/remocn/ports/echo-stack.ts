import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'echo-stack',
  title: 'Echo stack',
  about: 'A bold word focuses in while outlined copies of it drift above and below like a fading echo.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 120,
  background: '#0a0a0a',
  fonts: ['Inter'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Bold.', group: 'Content', maxLength: 40 },
    fontSize: { type: 'number', title: 'Font size (px)', default: 170, minimum: 60, maximum: 300, step: 2, group: 'Style' },
    color: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#fafafa', group: 'Style' },
    echoColor: { type: 'string', title: 'Echo colour', format: PropFormat.Color, default: '#fafafa', group: 'Style' },
    echoes: { type: 'number', title: 'Echoes per side', default: 3, minimum: 1, maximum: 6, step: 1, group: 'Style' },
    echoOpacity: { type: 'number', title: 'Echo opacity', default: 0.35, minimum: 0.05, maximum: 1, step: 0.05, group: 'Style' },
    direction: { type: 'string', title: 'Direction', enum: ['up', 'down'], default: 'up', group: 'Motion' },
    cycle: { type: 'number', title: 'Frames per row', default: 60, minimum: 15, maximum: 240, step: 5, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const echoes = Math.max(0, Math.round(Number(p.echoes)));
    const echoOpacity = Number(p.echoOpacity);
    const cycle = Math.max(1, Number(p.cycle));
    const sign = p.direction === 'down' ? 1 : -1;
    const NS = 'http://www.w3.org/2000/svg';
    const WEIGHT = 800;
    const PITCH_EM = 1.05;
    const HIDDEN = 0.55;
    const MAIN = [0, 14];
    const UNFOLD = [8, 26];
    const FADE_IN = [8, 24];
    const START_SPREAD = 0.6;
    const MAX_BLUR = 12;
    const STROKE_PX = 1.5;
    const FRAME_RATE = 30;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const easeOut = { ...clamped, easing: S.Easing.out(S.Easing.cubic) };
    const smooth = (x: number) => {
      const c = Math.min(1, Math.max(0, x));
      return c * c * (3 - 2 * c);
    };
    const fadeAt = (distance: number) => {
      const d = Math.abs(distance);
      if (d < HIDDEN) {
        return 0;
      }
      if (d < 1) {
        return smooth((d - HIDDEN) / (1 - HIDDEN));
      }
      const reach = Math.max(1, echoes + 0.5);
      return Math.max(0, 1 - (d - 1) / (reach - 1));
    };

    const unit = view.height / 720;
    const size = Number(p.fontSize) * unit;
    const pitch = PITCH_EM * size;
    const echoColor = String(p.echoColor) || String(p.color);
    const type = { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', fontSize: size, lineHeight: 1, fontWeight: WEIGHT, fontVariationSettings: `"wght" ${WEIGHT}`, whiteSpace: 'pre' };

    const outline = document.createElementNS(NS, 'filter');
    outline.setAttribute('id', 'echo-stack-outline');
    const erode = document.createElementNS(NS, 'feMorphology');
    erode.setAttribute('in', 'SourceAlpha');
    erode.setAttribute('operator', 'erode');
    erode.setAttribute('radius', String(STROKE_PX * unit));
    erode.setAttribute('result', 'inner');
    const ring = document.createElementNS(NS, 'feComposite');
    ring.setAttribute('in', 'SourceAlpha');
    ring.setAttribute('in2', 'inner');
    ring.setAttribute('operator', 'out');
    ring.setAttribute('result', 'ring');
    const flood = document.createElementNS(NS, 'feFlood');
    flood.setAttribute('flood-color', echoColor);
    const clip = document.createElementNS(NS, 'feComposite');
    clip.setAttribute('in2', 'ring');
    clip.setAttribute('operator', 'in');
    [erode, ring, flood, clip].forEach((node) => outline.appendChild(node));
    const defs = S.h('defs', null) as SVGElement;
    defs.appendChild(outline);
    const filterHost = S.h('svg', { width: 0, height: 0, style: { position: 'absolute' } }, defs);

    const reach = echoes + 2;
    const slots = Array.from({ length: reach * 2 + 1 }, (_, i) => i - reach);
    const ghosts = slots.map(() => S.h('div', { 'aria-hidden': 'true', style: { ...type, position: 'absolute', left: '50%', top: '50%', color: echoColor, filter: 'url(#echo-stack-outline)' } }, String(p.text)) as HTMLElement);
    const main = S.h('div', { style: { ...type, position: 'relative', color: String(p.color) } }, String(p.text)) as HTMLElement;
    const stack = S.h('div', { style: { position: 'relative' } }, ghosts, main);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, filterHost, stack));

    return (frame) => {
      const t = (frame * FRAME_RATE) / view.fps;
      const k = S.interpolate(t, MAIN, [0, 1], easeOut);
      const blur = MAX_BLUR * (1 - k);
      const phase = sign * ((t / cycle) % 1);
      const spread = S.interpolate(t, UNFOLD, [START_SPREAD, 1], easeOut);
      const fadeIn = S.interpolate(t, FADE_IN, [0, 1], easeOut);

      main.style.opacity = String(k);
      main.style.transform = `scale(${1.04 - 0.04 * k})`;
      main.style.filter = blur > 0.05 ? `blur(${blur * unit}px)` : '';
      ghosts.forEach((el, i) => {
        const offset = slots[i] + phase;
        const opacity = echoOpacity * fadeIn * fadeAt(offset);

        el.style.display = opacity <= 0 ? 'none' : 'block';
        el.style.opacity = String(opacity);
        el.style.transform = `translate(-50%, calc(-50% + ${offset * spread * pitch}px))`;
      });
    };
  }
};
