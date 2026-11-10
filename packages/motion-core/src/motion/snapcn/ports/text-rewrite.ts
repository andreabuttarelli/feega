import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'text-rewrite',
  title: 'Text rewrite',
  about: 'A headline types in word by word beside a mark, gets selected, the selection erases the opening words and the line rewrites itself.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 102,
  background: '#faf9f6',
  fonts: ['Inter'],
  props: {
    headline: { type: 'string', title: 'Headline', default: 'Or just add snapcn', group: 'Content', maxLength: 120 },
    keep: { type: 'number', title: 'Words kept after erase', default: 1, minimum: 0, maximum: 20, step: 1, group: 'Content' },
    append: { type: 'string', title: 'Appended word', default: 'registry', group: 'Content', maxLength: 60 },
    markAt: { type: 'number', title: 'Mark appears (s)', default: 0.117, minimum: 0, maximum: 10, step: 0.01, group: 'Motion' },
    wordAt: { type: 'number', title: 'First word (s)', default: 0.217, minimum: 0, maximum: 10, step: 0.01, group: 'Motion' },
    wordStagger: { type: 'number', title: 'Word stagger (s)', default: 0.189, minimum: 0.01, maximum: 5, step: 0.01, group: 'Motion' },
    wordDuration: { type: 'number', title: 'Word fade (s)', default: 0.085, minimum: 0, maximum: 5, step: 0.01, group: 'Motion' },
    coolDelay: { type: 'number', title: 'Accent hold (s)', default: 0.189, minimum: 0, maximum: 5, step: 0.01, group: 'Motion' },
    coolDuration: { type: 'number', title: 'Accent fade (s)', default: 0.189, minimum: 0, maximum: 5, step: 0.01, group: 'Motion' },
    cutAt: { type: 'number', title: 'Zoom start (s)', default: 1.033, minimum: 0, maximum: 10, step: 0.01, group: 'Motion' },
    zoomDuration: { type: 'number', title: 'Zoom length (s, 0 = cut)', default: 0, minimum: 0, maximum: 10, step: 0.01, group: 'Motion' },
    zoom: { type: 'number', title: 'Zoom', default: 2.41, minimum: 1, maximum: 6, step: 0.01, group: 'Motion' },
    dragAt: { type: 'number', title: 'Select start (s)', default: 1.033, minimum: 0, maximum: 10, step: 0.01, group: 'Motion' },
    dragDuration: { type: 'number', title: 'Select length (s)', default: 0.2, minimum: 0, maximum: 5, step: 0.01, group: 'Motion' },
    eraseAt: { type: 'number', title: 'Erase start (s)', default: 1.45, minimum: 0, maximum: 10, step: 0.01, group: 'Motion' },
    eraseDuration: { type: 'number', title: 'Erase length (s)', default: 0.517, minimum: 0, maximum: 5, step: 0.01, group: 'Motion' },
    rewriteAt: { type: 'number', title: 'Rewrite start (s)', default: 2, minimum: 0, maximum: 10, step: 0.01, group: 'Motion' },
    rewriteDuration: { type: 'number', title: 'Rewrite length (s)', default: 0.533, minimum: 0, maximum: 5, step: 0.01, group: 'Motion' },
    deselectAt: { type: 'number', title: 'Deselect start (s)', default: 2.85, minimum: 0, maximum: 10, step: 0.01, group: 'Motion' },
    deselectDuration: { type: 'number', title: 'Deselect length (s)', default: 0.15, minimum: 0, maximum: 5, step: 0.01, group: 'Motion' },
    fontSize: { type: 'number', title: 'Font size (px)', default: 20, minimum: 6, maximum: 120, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 500, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    centerY: { type: 'number', title: 'Centre y (0-1)', default: 0.4902, minimum: 0, maximum: 1, step: 0.001, group: 'Style' },
    selectionOpacity: { type: 'number', title: 'Selection opacity', default: 0.21, minimum: 0, maximum: 1, step: 0.01, group: 'Style' },
    selectionAngle: { type: 'number', title: 'Selection sheen angle', default: 90, minimum: 0, maximum: 360, step: 1, group: 'Style' },
    showMark: { type: 'string', title: 'Mark', enum: ['show', 'hide'], default: 'show', group: 'Style' },
    markColor: { type: 'string', title: 'Mark colour (transparent = accent)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    markSize: { type: 'number', title: 'Mark size (em)', default: 1.15, minimum: 0.2, maximum: 5, step: 0.05, group: 'Style' },
    glow: { type: 'string', title: 'Glow', enum: ['on', 'off'], default: 'on', group: 'Style' },
    glowColor: { type: 'string', title: 'Glow colour (transparent = accent)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    glowOpacity: { type: 'number', title: 'Glow opacity', default: 0.075, minimum: 0, maximum: 1, step: 0.005, group: 'Style' },
    accentColor: { type: 'string', title: 'Accent (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const FACE = 'Text Rewrite Inter';
    const FACE_URL = 'https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2';
    if (typeof FontFace !== 'undefined' && ![...document.fonts].some((f) => f.family === FACE || f.family === `"${FACE}"`)) {
      const loaded = new FontFace(FACE, `url(${FACE_URL}) format("woff2")`, { weight: '100 900' });
      document.fonts.add(loaded);
      loaded.load().catch(() => undefined);
    }
    const face = S.pick(p.fontFamily, `"${FACE}"`);

    const REF_W = 810;
    const REF_H = 458;
    const TRACKING = -0.012;
    const WORD_GAP = -0.05;
    const SEL_HEIGHT = 0.954;
    const SEL_BELOW = 0.083;
    const SEL_PAD = 0.11;
    const MARK_GAP = 0.4;
    const MARK_RISE = 0.4;
    const SHEEN = [[0, 0.93], [0.1, 1.19], [0.19, 1.24], [0.3, 1.49], [0.37, 1.56], [0.44, 1.03], [0.51, 0.57], [0.59, 0.49], [0.69, 0.59], [0.78, 0.75], [0.89, 1.03], [1, 1.16]];
    const SWEEP_EASE = S.Easing.bezier(0.42, 0, 0.19, 1);
    const DRAG_EASE = S.Easing.out(S.Easing.poly(3.5));
    const WORD_EASE = S.Easing.out(S.Easing.cubic);
    const ZOOM_EASE = S.Easing.bezier(0.2, 0.6, 0.35, 1);
    const MARK_PATH = 'M15.757 15.459c-3.324 0.816 -6.07 2.966 -7.563 5.911 -1.194 2.388 -1.174 1.672 -1.174 24.66 0 19.982 0.02 21.077 0.378 22.132 0.955 2.926 2.946 4.498 6.588 5.215 1.99 0.398 2.528 0.657 3.702 1.732 1.055 0.975 1.473 2.169 1.473 4.219 0.02 2.408 0.836 3.901 2.647 4.856l1.035 0.537 19.505 0.06c17.574 0.06 19.624 0.02 20.739 -0.259 1.493 -0.418 2.647 -1.333 3.403 -2.766l0.537 -1.015 0.06 -6.269c0.04 -3.443 0.04 -6.807 0 -7.444l-0.06 -1.194 -0.617 0.995c-0.717 1.174 -2.01 2.289 -3.383 2.906l-0.975 0.458 -16.121 0.06c-11.763 0.04 -16.42 -0 -17.216 -0.159 -2.548 -0.557 -5.135 -2.408 -6.468 -4.657 -1.294 -2.189 -1.314 -2.548 -1.254 -16.44l0.06 -12.439 0.478 -1.154c0.876 -2.209 2.926 -4.18 5.374 -5.155l1.115 -0.458 16.519 -0.06c16.101 -0.04 16.539 -0.04 17.813 0.358 1.592 0.498 2.966 1.473 3.941 2.826l0.736 1.035 0.06 -6.648c0.06 -7.304 -0.06 -8.319 -1.115 -9.832 -0.597 -0.876 -1.95 -1.811 -3.025 -2.11 -0.438 -0.119 -9.096 -0.199 -23.386 -0.179 -18.37 0.02 -22.908 0.06 -23.804 0.279zM79.665 31.819c-6.508 3.901 -11.902 7.185 -11.981 7.304 -0.08 0.119 -0.139 5.055 -0.1 10.947l0.04 10.748 2.886 1.811c1.592 0.995 4.14 2.587 5.672 3.523 1.533 0.935 5.632 3.463 9.096 5.613 3.463 2.15 6.488 3.901 6.707 3.901 0.219 -0 0.537 -0.139 0.697 -0.318 0.279 -0.279 0.318 -2.806 0.318 -24.958 0 -15.544 -0.08 -24.839 -0.199 -25.157 -0.139 -0.398 -0.318 -0.517 -0.736 -0.517 -0.358 0.02 -4.617 2.448 -12.399 7.105z';
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

    const n = (k: string) => Number(p[k]);
    const fontSize = n('fontSize');
    const fontWeight = n('fontWeight');
    const centerY = n('centerY');
    const speed = n('speed');
    const accent = S.pick(p.accentColor, String(t.primary));
    const wash = S.pick(p.glowColor, accent);
    const markFill = S.pick(p.markColor, accent);
    const showMark = p.showMark !== 'hide';
    const headline = String(p.headline);
    const append = String(p.append);
    const words = headline.split(/\s+/).filter(Boolean);
    const kept = Math.max(0, Math.min(words.length, Math.round(n('keep'))));
    const cut = words.length - kept;
    const lineHeight = Math.round(fontSize * 1.35);
    const stageScale = Math.min(view.width / REF_W, view.height / REF_H);

    const ease = (now: number, at: number, dur: number, easing?: (x: number) => number) => (dur <= 0 ? (now >= at ? 1 : 0) : S.interpolate(now, [at, at + dur], [0, 1], { ...clamped, easing }));
    const landed = (now: number) => {
      const at = n('wordAt');
      if (now < at) {
        return { count: 0, grow: 0 };
      }
      const count = Math.min(words.length, Math.floor((now - at) / n('wordStagger') + 1e-6) + 1);
      const cue = at + (count - 1) * n('wordStagger');
      return { count, grow: ease(now, cue, n('wordDuration'), WORD_EASE) };
    };
    const wordInk = (now: number, i: number) => {
      const cue = n('wordAt') + i * n('wordStagger');
      if (now < cue) {
        return { opacity: 0, cool: 0 };
      }
      const opacity = S.interpolate(now, [cue, cue + n('wordDuration')], [0, 1], { ...clamped, easing: WORD_EASE });
      const last = i === words.length - 1;
      const from = last ? n('dragAt') : cue + n('coolDelay');
      const span = last ? n('dragDuration') / 2 : n('coolDuration');
      return { opacity, cool: S.interpolate(now, [from, from + Math.max(1e-4, span)], [0, 1], clamped) };
    };
    const sheen = () => `linear-gradient(${n('selectionAngle')}deg, ${SHEEN.map(([u, k]) => `${S.withAlpha(accent, Math.min(1, n('selectionOpacity') * k))} ${(u * 100).toFixed(1)}%`).join(', ')})`;

    const textStyle = { fontFamily: face, fontSize, fontWeight, lineHeight: `${lineHeight}px`, letterSpacing: `${TRACKING}em`, wordSpacing: `${WORD_GAP}em`, whiteSpace: 'pre', textRendering: 'geometricPrecision' };
    const wordProbes = words.map((w) => S.h('span', null, w) as HTMLElement);
    const spaceProbe = S.h('span', null, ' ') as HTMLElement;
    const appendProbe = S.h('span', null, append) as HTMLElement;
    const baseProbe = S.h('span', { style: { display: 'inline-block', width: 0, height: 0 } }) as HTMLElement;
    const probe = S.h('span', { style: { ...textStyle, position: 'absolute', left: 0, top: 0, visibility: 'hidden', pointerEvents: 'none' } }, wordProbes, spaceProbe, appendProbe, baseProbe);

    const glowLayer = p.glow === 'off' ? null : S.h('div', { style: { position: 'absolute', inset: 0, background: `radial-gradient(46% 34% at 50% ${centerY * 100}%, ${S.withAlpha(wash, n('glowOpacity'))} 0%, ${S.withAlpha(wash, 0)} 100%)` } });
    const group = S.h('div', { style: { position: 'absolute', left: 0, right: 0, top: centerY * REF_H - lineHeight / 2, height: lineHeight } }) as HTMLElement;
    const stage = S.h('div', { style: { position: 'absolute', left: '50%', top: '50%', width: REF_W, height: REF_H, transform: `translate(-50%, -50%) scale(${stageScale})`, overflow: 'hidden' } }, glowLayer, probe, group);
    view.root.replaceChildren(S.fill({ background: String(t.background) }, stage));

    return (frame) => {
      const now = (frame * speed) / view.fps;
      const W = wordProbes.map((e) => e.offsetWidth);
      const SP = spaceProbe.offsetWidth;
      const APP = appendProbe.offsetWidth;
      const baseline = baseProbe.offsetTop;
      const offset = (i: number) => W.slice(0, i).reduce((a, b) => a + b + SP, 0);
      const runWidth = (k: number) => (k <= 0 ? 0 : offset(k) - SP);

      const pad = fontSize * SEL_PAD;
      const gap = fontSize * MARK_GAP;
      const markW = fontSize * n('markSize');
      const tail = showMark ? gap + markW : 0;

      const { count, grow } = landed(now);
      const drag = ease(now, n('dragAt'), n('dragDuration'), DRAG_EASE);
      const erase = ease(now, n('eraseAt'), n('eraseDuration'), SWEEP_EASE);
      const write = ease(now, n('rewriteAt'), n('rewriteDuration'), SWEEP_EASE);
      const drop = ease(now, n('deselectAt'), n('deselectDuration'));
      const zoomDuration = n('zoomDuration');
      const scale = zoomDuration <= 0 ? (now >= n('cutAt') ? n('zoom') : 1) : S.interpolate(now, [n('cutAt'), n('cutAt') + zoomDuration], [1, n('zoom')], { ...clamped, easing: ZOOM_EASE });

      const opening = count > 0 ? (count > 1 ? SP : 0) + (W[count - 1] ?? 0) : 0;
      const grown = runWidth(Math.max(0, count - 1)) + opening * grow;
      const drawn = runWidth(count);
      const full = runWidth(words.length);
      const aLeft = REF_W / 2 - (full + tail) / 2;
      const keptLeft = aLeft + offset(cut);
      const keptWidth = full - offset(cut);
      const extra = append ? SP + APP : 0;
      const bLeft = REF_W / 2 - (keptWidth + extra + tail) / 2;
      const rewriting = write > 0;
      const left = rewriting ? keptLeft + (bLeft - keptLeft) * write : REF_W / 2 - (grown + tail) / 2;
      const k0 = rewriting ? left : left + offset(cut) * erase;
      const k1 = rewriting ? left + keptWidth + extra * write : left + drawn;
      const selFrom = erase > 0 || rewriting ? k0 : left - pad;
      const selTo = rewriting ? k1 : left + drawn + pad;
      const s1 = selFrom + (selTo - selFrom) * drag;
      const s0 = selFrom + (s1 - selFrom) * drop;
      const markX = rewriting ? k1 : left + grown;

      group.style.transform = `scale(${scale})`;
      group.style.transformOrigin = `50% ${zoomDuration > 0 ? `${baseline}px` : '50%'}`;

      const selection = drag > 0 && drop < 1 ? S.h('div', { style: { position: 'absolute', left: s0, top: baseline + fontSize * SEL_BELOW - fontSize * SEL_HEIGHT, width: Math.max(0, s1 - s0), height: fontSize * SEL_HEIGHT, background: sheen() } }) : null;
      const shown = rewriting ? [...words.slice(cut), ...(append ? [append] : [])] : words.slice(0, count);
      const spans = shown.map((word, i) => {
        const idx = rewriting ? cut + i : i;
        const ink = wordInk(now, idx);
        return S.h('span', { style: { color: rewriting ? String(t.foreground) : S.mixOklch(accent, String(t.foreground), ink.cool), opacity: rewriting ? 1 : ink.opacity } }, i > 0 ? ' ' : null, word);
      });
      const windowEl = S.h('div', { style: { position: 'absolute', left: k0, top: 0, width: Math.max(0, k1 - k0), height: lineHeight, overflow: 'hidden' } }, S.h('div', { style: { ...textStyle, position: 'absolute', left: left - k0, top: 0, width: 'max-content' } }, spans));
      const mark = showMark && now >= n('markAt') ? S.h('svg', { viewBox: '0 0 100 100', width: markW, height: markW, style: { position: 'absolute', left: markX + gap, top: baseline - fontSize * MARK_RISE - markW / 2, overflow: 'visible' } }, S.h('path', { d: MARK_PATH, fill: markFill })) : null;
      group.replaceChildren(...[selection, windowEl, mark].filter((e): e is Element => Boolean(e)));
    };
  }
};
