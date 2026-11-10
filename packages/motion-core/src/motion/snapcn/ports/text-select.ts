import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'text-select',
  title: 'Text select',
  about: 'A headline types in word by word, the camera pushes in, and a caret drag selects the whole line with a glinting highlight.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 72,
  background: '#faf9f6',
  fonts: ['Inter'],
  props: {
    headline: { type: 'string', title: 'Headline', default: 'One command into your project.', group: 'Content', maxLength: 120 },
    fontSize: { type: 'number', title: 'Font size (px)', default: 20, minimum: 8, maximum: 120, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 500, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    shineColor: { type: 'string', title: 'Shine colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    glow: { type: 'boolean', title: 'Background glow', default: true, group: 'Style' },
    glowOpacity: { type: 'number', title: 'Glow opacity', default: 0.075, minimum: 0, maximum: 1, step: 0.005, group: 'Style' },
    selectionOpacity: { type: 'number', title: 'Selection opacity', default: 0.207, minimum: 0, maximum: 1, step: 0.01, group: 'Style' },
    shineOpacity: { type: 'number', title: 'Shine opacity', default: 0.5, minimum: 0, maximum: 1, step: 0.01, group: 'Style' },
    wordAt: { type: 'number', title: 'First word (s)', default: 0.066, minimum: 0, maximum: 5, step: 0.01, group: 'Motion' },
    wordStagger: { type: 'number', title: 'Word stagger (s)', default: 0.208, minimum: 0, maximum: 2, step: 0.01, group: 'Motion' },
    wordDuration: { type: 'number', title: 'Word land (s)', default: 0.13, minimum: 0.01, maximum: 2, step: 0.01, group: 'Motion' },
    cutAt: { type: 'number', title: 'Zoom start (s)', default: 1.13, minimum: 0, maximum: 10, step: 0.01, group: 'Motion' },
    zoomDuration: { type: 'number', title: 'Zoom duration (s)', default: 0.42, minimum: 0, maximum: 5, step: 0.01, group: 'Motion' },
    zoom: { type: 'number', title: 'Zoom', default: 2.39, minimum: 1, maximum: 6, step: 0.01, group: 'Motion' },
    selectAt: { type: 'number', title: 'Select start (s)', default: 1.4, minimum: 0, maximum: 10, step: 0.01, group: 'Motion' },
    selectDuration: { type: 'number', title: 'Select duration (s)', default: 0.26, minimum: 0.01, maximum: 5, step: 0.01, group: 'Motion' },
    shineDuration: { type: 'number', title: 'Shine pass (s)', default: 0.62, minimum: 0, maximum: 5, step: 0.01, group: 'Motion' },
    shineEvery: { type: 'number', title: 'Shine repeat (s)', default: 1.1, minimum: 0, maximum: 10, step: 0.01, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const REF_W = 810;
    const REF_H = 458;
    const TRACKING = -0.012;
    const WORD_GAP = -0.07;
    const SEL_HEIGHT = 0.941;
    const SEL_BELOW = 0.12;
    const SEL_PAD = 0.063;
    const SHIFT_X = 0.475;
    const SHIFT_Y = 0.085;
    const WORD_BLUR = 1;
    const COOL_DELAY = 0.208;
    const COOL_DUR = 0.208;
    const SHINE_DEPTH = 0.55;
    const SHINE_WIDTH = 0.3;
    const ANGLE = 90;
    const CENTER_Y = 0.5116;
    const SHEEN = [[0, 0.72], [0.1, 0.95], [0.19, 1.12], [0.3, 1.42], [0.37, 1.44], [0.44, 1.22], [0.51, 0.78], [0.59, 0.51], [0.69, 0.74], [0.78, 0.88], [0.89, 1.05], [1, 1.2]];
    const WORD_EASE = S.Easing.out(S.Easing.poly(4));
    const SELECT_EASE = S.Easing.out(S.Easing.poly(5));
    const ZOOM_EASE = S.Easing.bezier(0.2, 0.6, 0.35, 1);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

    const headline = String(p.headline);
    const fontSize = Number(p.fontSize);
    const fontWeight = Number(p.fontWeight);
    const wordAt = Number(p.wordAt);
    const wordStagger = Number(p.wordStagger);
    const wordDuration = Number(p.wordDuration);
    const cutAt = Number(p.cutAt);
    const zoomDuration = Number(p.zoomDuration);
    const zoom = Number(p.zoom);
    const selectAt = Number(p.selectAt);
    const selectDuration = Number(p.selectDuration);
    const shineDuration = Number(p.shineDuration);
    const shineEvery = Number(p.shineEvery);
    const shineOpacity = Number(p.shineOpacity);
    const selectionOpacity = Number(p.selectionOpacity);
    const speed = Number(p.speed);
    const face = S.pick(p.fontFamily, 'Inter, -apple-system, BlinkMacSystemFont, sans-serif');
    const accent = S.pick(p.accentColor, String(t.primary));
    const shineColor = S.pick(p.shineColor, '#ffffff');
    const words = headline.split(/\s+/).filter(Boolean);
    const lineHeight = fontSize * 1.2;
    const boxTop = CENTER_Y * REF_H - lineHeight / 2;
    const stageScale = Math.min(view.width / REF_W, view.height / REF_H);
    const type = { fontFamily: face, fontOpticalSizing: 'none', fontSize, fontWeight, lineHeight: `${lineHeight}px`, letterSpacing: `${TRACKING}em`, wordSpacing: `${WORD_GAP}em` };

    const wordInk = (now: number, i: number) => {
      const cue = wordAt + i * wordStagger;
      if (now < cue) {
        return { opacity: 0, cool: 0, blur: WORD_BLUR };
      }
      const k = S.interpolate(now, [cue, cue + wordDuration], [0, 1], { ...clamped, easing: WORD_EASE });
      const usesDrag = i === words.length - 1 && selectAt > cue;
      const coolFrom = usesDrag ? selectAt : cue + COOL_DELAY;
      const coolOver = usesDrag ? selectDuration / 2 : COOL_DUR;
      return { opacity: k, cool: S.interpolate(now, [coolFrom, coolFrom + coolOver], [0, 1], clamped), blur: WORD_BLUR * (1 - k) };
    };

    const lineShift = (now: number) => {
      if (now < wordAt) {
        return 1;
      }
      const landed = Math.min(words.length - 1, Math.floor((now - wordAt) / wordStagger));
      const cue = wordAt + landed * wordStagger;
      return 1 - S.interpolate(now, [cue, cue + wordDuration], [0, 1], { ...clamped, easing: WORD_EASE });
    };

    const sheen = () => `linear-gradient(${ANGLE}deg, ${SHEEN.map(([u, k]) => `${S.withAlpha(accent, Math.min(1, selectionOpacity * k))} ${(u * 100).toFixed(1)}%`).join(', ')})`;

    const shinePos = (now: number) => {
      const at = selectAt + selectDuration;
      if (shineDuration <= 0 || now < at) {
        return null;
      }
      const since = now - at;
      const u = (shineEvery > 0 ? since % shineEvery : since) / shineDuration;
      return u > 1 ? null : -SHINE_WIDTH / 2 + u * (1 + SHINE_WIDTH);
    };

    const shine = (pos: number) => {
      const half = SHINE_WIDTH / 2;
      const at = (x: number) => `${(x * 100).toFixed(1)}%`;
      const s0 = S.withAlpha(accent, 0);
      const s1 = S.withAlpha(accent, Math.min(1, shineOpacity * SHINE_DEPTH));
      return `linear-gradient(${ANGLE}deg, ${s0} ${at(pos - half)}, ${s1} ${at(pos - half * 0.55)}, ${S.withAlpha(shineColor, Math.min(1, shineOpacity))} ${at(pos)}, ${s1} ${at(pos + half * 0.55)}, ${s0} ${at(pos + half)})`;
    };

    const baselineEl = S.h('span', { style: { display: 'inline-block', width: 0, height: 0 } }) as HTMLElement;
    const probe = S.h('span', { style: { position: 'absolute', left: 0, top: 0, visibility: 'hidden', whiteSpace: 'pre', ...type } }, headline, baselineEl) as HTMLElement;
    const sel = S.h('div', { style: { position: 'absolute' } }) as HTMLElement;
    const line = S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, textAlign: 'center', whiteSpace: 'pre', textRendering: 'geometricPrecision', ...type } }) as HTMLElement;
    const group = S.h('div', { style: { position: 'absolute', left: 0, right: 0, top: boxTop, height: lineHeight } }, sel, line) as HTMLElement;
    const glow = p.glow === false ? null : S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: `radial-gradient(${0.46 * REF_W}px ${0.36 * REF_H}px at 50% ${CENTER_Y * 100}%, ${S.withAlpha(accent, Number(p.glowOpacity))} 0%, transparent 74%)` } });
    const stage = S.h('div', { style: { position: 'absolute', left: '50%', top: '50%', width: REF_W, height: REF_H, transform: `translate(-50%, -50%) scale(${stageScale})`, overflow: 'hidden', background: String(t.background) } }, glow, probe, group);
    view.root.replaceChildren(S.fill({ background: String(t.background) }, stage));

    const renderWords = (now: number) => {
      const nodes: (Node | string)[] = [];
      words.forEach((word, i) => {
        const w = wordInk(now, i);
        if (w.opacity <= 0) {
          return;
        }
        if (i > 0) {
          nodes.push(' ');
        }
        nodes.push(S.h('span', { style: { display: 'inline-block', color: S.mixOklch(accent, String(t.foreground), w.cool), opacity: w.opacity, filter: w.blur > 0.02 ? `blur(${w.blur}px)` : undefined } }, word));
      });
      line.replaceChildren(...nodes);
    };

    const renderSelection = (now: number, lineWidth: number, baseline: number) => {
      const sweep = S.interpolate(now, [selectAt, selectAt + selectDuration], [0, 1], { ...clamped, easing: SELECT_EASE });
      sel.style.display = sweep > 0 ? 'block' : 'none';
      const pad = fontSize * SEL_PAD;
      const pos = shinePos(now);
      sel.style.left = `${REF_W / 2 - lineWidth / 2 - pad}px`;
      sel.style.top = `${baseline + fontSize * SEL_BELOW - fontSize * SEL_HEIGHT}px`;
      sel.style.width = `${(lineWidth + pad * 2) * sweep}px`;
      sel.style.height = `${fontSize * SEL_HEIGHT}px`;
      sel.style.background = [pos === null || shineOpacity <= 0 ? null : shine(pos), sheen()].filter(Boolean).join(', ');
    };

    return (frame) => {
      const now = (frame * speed) / view.fps;
      const lineWidth = probe.offsetWidth || headline.length * fontSize * 0.5;
      const baseline = baselineEl.offsetTop || lineHeight * 0.8;
      const shift = lineShift(now);
      const scale = zoomDuration <= 0 ? (now >= cutAt ? zoom : 1) : S.interpolate(now, [cutAt, cutAt + zoomDuration], [1, zoom], { ...clamped, easing: ZOOM_EASE });
      group.style.transform = `translate(${shift * fontSize * SHIFT_X}px, ${shift * fontSize * SHIFT_Y}px) scale(${scale})`;
      group.style.transformOrigin = `50% ${baseline}px`;
      renderSelection(now, lineWidth, baseline);
      renderWords(now);
    };
  }
};
