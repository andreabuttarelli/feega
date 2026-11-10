import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'text-highlight',
  title: 'Text highlight',
  about: 'A word is wiped in by its spinning logo mark, which then rushes at the viewer and floods the frame; or marker, colour, underline, strike or shimmer.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 120,
  background: '#faf9f6',
  fonts: ['Inter'],
  props: {
    before: { type: 'string', title: 'Text before', default: '', group: 'Content', maxLength: 120 },
    highlight: { type: 'string', title: 'Highlighted text', default: 'Acme', group: 'Content', maxLength: 120 },
    after: { type: 'string', title: 'Text after', default: '', group: 'Content', maxLength: 120 },
    replaceWith: { type: 'string', title: 'Strikethrough replacement', default: '', group: 'Content', maxLength: 120 },
    preset: { type: 'string', title: 'Preset', enum: ['logo-wipe', 'marker', 'color', 'underline', 'strikethrough', 'shimmer'], default: 'logo-wipe', group: 'Content' },
    logoSrc: { type: 'string', title: 'Logo', format: PropFormat.Asset, assetKind: 'image', default: null, group: 'Content', maxLength: 2000 },
    fontSize: { type: 'number', title: 'Font size (px)', default: 56, minimum: 12, maximum: 300, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 600, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    baseColor: { type: 'string', title: 'Text colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    highlightedTextColor: { type: 'string', title: 'Highlighted text colour', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    shineColor: { type: 'string', title: 'Shimmer colour', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    coverColor: { type: 'string', title: 'Flood colour (transparent = accent)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    thickness: { type: 'number', title: 'Line thickness (0 = auto)', default: 0, minimum: 0, maximum: 40, step: 1, group: 'Style' },
    logoScale: { type: 'number', title: 'Logo scale', default: 1.05, minimum: 0.2, maximum: 4, step: 0.05, group: 'Style' },
    startAt: { type: 'number', title: 'Start (frames)', default: 6, minimum: 0, maximum: 120, step: 1, group: 'Motion' },
    drawDuration: { type: 'number', title: 'Draw (frames)', default: 14, minimum: 1, maximum: 120, step: 1, group: 'Motion' },
    springDamping: { type: 'number', title: 'Spring damping', default: 18, minimum: 1, maximum: 100, step: 1, group: 'Motion' },
    spinTurns: { type: 'number', title: 'Logo spin turns', default: 1, minimum: 0, maximum: 5, step: 0.25, group: 'Motion' },
    holdDuration: { type: 'number', title: 'Hold before rush (frames)', default: 12, minimum: 0, maximum: 120, step: 1, group: 'Motion' },
    rushDuration: { type: 'number', title: 'Rush (frames)', default: 24, minimum: 1, maximum: 120, step: 1, group: 'Motion' },
    rushScale: { type: 'number', title: 'Rush scale', default: 42, minimum: 1, maximum: 100, step: 1, group: 'Motion' },
    rushDrift: { type: 'number', title: 'Rush drift', default: 0.55, minimum: -2, maximum: 2, step: 0.05, group: 'Motion' },
    swingOut: { type: 'number', title: 'Swing out', default: 0.25, minimum: -2, maximum: 2, step: 0.05, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const num = (k: string) => Number(p[k]);
    const str = (k: string) => String(p[k] ?? '');
    const fontSize = num('fontSize');
    const startAt = num('startAt');
    const drawDuration = num('drawDuration');
    const preset = str('preset');
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const face = S.pick(p.fontFamily, 'Inter, -apple-system, BlinkMacSystemFont, sans-serif');
    const base = S.pick(p.baseColor, String(t.foreground));
    const accent = S.pick(p.accentColor, String(t.primary));
    const lum = (c: string) => S.rgbToOklch(S.parseColor(c)).l;
    const shine = S.pick(p.shineColor, lum(String(t.card)) >= lum(String(t.foreground)) ? String(t.card) : String(t.foreground));
    const emphasis = S.pick(p.highlightedTextColor, preset === 'color' || preset === 'strikethrough' ? accent : base);
    const thickness = num('thickness') > 0 ? num('thickness') : Math.max(2, Math.round(fontSize * 0.08));
    const highlight = str('highlight');
    const textStyle = { fontSize, fontWeight: num('fontWeight'), color: base, letterSpacing: '-0.02em', lineHeight: 1.25, fontFamily: face, fontOpticalSizing: 'none', whiteSpace: 'pre-wrap', textAlign: 'center', maxWidth: '80%' };
    const center = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };

    if (preset === 'logo-wipe') {
      const WIPE_EASE = S.Easing.bezier(0.2, 0.6, 0.35, 1);
      const RUSH_EASE = S.Easing.bezier(0.45, 0.2, 0.45, 1);
      const INK_LAG = 0.7;
      const rushScale = num('rushScale');
      const rushDrift = num('rushDrift');
      const markSize = fontSize * num('logoScale');
      const perspective = (travel: number) => (rushScale <= 1 ? 1 : 1 / (1 - (1 - 1 / rushScale) * Math.min(Math.max(travel, 0), 0.9999)));
      let gain = 1;
      for (let i = 1; i < 128; i++) {
        gain = Math.max(gain, Math.sin((Math.PI * i) / 128) * perspective(i / 128));
      }
      const W = view.width;
      const H = view.height;
      const reach = (driftPx: number) => Math.hypot(Math.max(Math.abs(driftPx), Math.abs(W / 2 + driftPx), Math.abs(W - driftPx), Math.abs(W - W / 2 - driftPx)), H / 2) * 1.05;
      const MARK = S.mark.d;
      const logo = str('logoSrc')
        ? S.h('img', { src: str('logoSrc'), alt: '', style: { display: 'block', width: markSize, height: markSize, maxWidth: 'none', objectFit: 'contain' } })
        : S.h('svg', { width: markSize, height: markSize, viewBox: `0 ${(S.mark.height - S.mark.width) / 2} ${S.mark.width} ${S.mark.width}`, fill: 'none', style: { display: 'block' } }, S.h('path', { d: MARK, fill: accent }));
      const word = S.h('span', { style: { display: 'block', backgroundImage: `linear-gradient(90deg, ${accent}, ${emphasis})`, backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent' } }, highlight) as HTMLElement;
      const ink = S.h('div', { style: { position: 'absolute', left: '50%', top: '50%', borderRadius: '50%', background: S.pick(p.coverColor, accent) } }) as HTMLElement;
      const spin = S.h('div', { style: { transformOrigin: '50% 50%' } }, logo) as HTMLElement;
      const mark = S.h('div', { style: { position: 'absolute', top: '50%', width: 'max-content' } }, ink, spin) as HTMLElement;
      const lockup = S.h('div', { style: { position: 'relative', paddingLeft: markSize + fontSize * 0.3 } }, S.h('span', { style: { ...textStyle, position: 'relative', display: 'inline-block', maxWidth: undefined, whiteSpace: 'nowrap' } }, word, mark));
      view.root.replaceChildren(S.h('div', { style: { ...center, overflow: 'visible' } }, lockup));

      return (at) => {
        const frame = at * num('speed');
        const wipe = S.interpolate(frame, [startAt, startAt + drawDuration], [0, 1], { ...clamped, easing: WIPE_EASE });
        const edge = (1 - wipe) * 100;
        const rushStart = startAt + drawDuration + num('holdDuration');
        const travel = S.interpolate(frame, [rushStart, rushStart + num('rushDuration')], [0, 1], { ...clamped, easing: RUSH_EASE });
        const rushed = perspective(travel);
        const markBox = markSize * rushed;
        const diagonal = Math.hypot(W, H);
        const worldDrift = (rushDrift * W) / rushScale;
        const worldBow = (num('swingOut') * W) / gain;
        const swingPx = rushed * (worldDrift * travel - worldBow * Math.sin(Math.PI * travel));
        const flood = S.interpolate(markBox, [diagonal * 0.55, diagonal * 1.45], [0, 1], clamped);
        const inkPx = swingPx * (1 - INK_LAG);
        const radius = flood <= 0 ? 0 : S.interpolate(flood, [0, 1], [markBox * 0.03, reach(rushDrift * W * (1 - INK_LAG))]);
        word.style.clipPath = `inset(0 0 0 ${edge}%)`;
        mark.style.left = `${edge}%`;
        mark.style.translate = `calc(-100% - ${fontSize * 0.16}px + ${swingPx}px) -50%`;
        ink.style.translate = `calc(-50% - ${swingPx - inkPx}px) -50%`;
        ink.style.width = `${2 * radius}px`;
        ink.style.height = `${2 * radius}px`;
        spin.style.rotate = `${num('spinTurns') * 360 * wipe + 30 * travel}deg`;
        spin.style.scale = String(S.interpolate(wipe, [0, 1], [0.55, 1], clamped) * rushed);
      };
    }

    const host = S.h('span', { style: textStyle }) as HTMLElement;
    view.root.replaceChildren(S.h('div', { style: center }, host));
    const toward = (k: number) => S.interpolateColors(k, [0, 1], [base, emphasis]);

    const nodeAt = (frame: number, sweep: number): Element => {
      const late = S.interpolate(sweep, [0.5, 0.85], [0, 1], clamped);
      const lin = S.interpolate(frame, [startAt, startAt + drawDuration], [0, 1], clamped);
      if (preset === 'marker') {
        return S.h('span', { style: { position: 'relative', display: 'inline-block' } }, S.h('span', { style: { position: 'absolute', inset: '-0.02em -0.12em', background: S.withAlpha(accent, 0.16), borderRadius: '0.12em', transformOrigin: 'left center', transform: `scaleX(${sweep})`, zIndex: 0 } }), S.h('span', { style: { position: 'relative', zIndex: 1, color: toward(late) } }, highlight));
      }
      if (preset === 'color') {
        return S.h('span', { style: { color: toward(lin) } }, highlight);
      }
      if (preset === 'underline') {
        return S.h('span', { style: { position: 'relative', display: 'inline-block' } }, S.h('span', { style: { color: toward(late) } }, highlight), S.h('span', { style: { position: 'absolute', left: 0, right: 0, bottom: '-0.06em', height: thickness, background: accent, borderRadius: thickness / 2, transformOrigin: 'left center', transform: `scaleX(${sweep})` } }));
      }
      if (preset === 'strikethrough') {
        const drawEnd = startAt + drawDuration;
        const fade = S.interpolate(frame, [drawEnd, drawEnd + drawDuration * 0.5], [0, 1], clamped);
        const width = S.interpolate(frame, [startAt, drawEnd], [0, 100], clamped);
        return S.h('span', { style: { display: 'inline-grid', verticalAlign: 'baseline', justifyItems: 'center' } }, S.h('span', { style: { gridArea: '1 / 1', position: 'relative', whiteSpace: 'pre', opacity: 1 - fade } }, highlight, S.h('span', { style: { position: 'absolute', left: 0, top: '50%', height: thickness, width: `${width}%`, background: accent, transform: 'translateY(-50%)', borderRadius: thickness / 2 } })), S.h('span', { style: { gridArea: '1 / 1', whiteSpace: 'pre', color: emphasis, opacity: fade, transform: `translateY(${8 - 8 * fade}px)` } }, str('replaceWith') || highlight));
      }
      const pos = S.interpolate(frame, [startAt, startAt + drawDuration], [200, -100], clamped);
      return S.h('span', { style: { position: 'relative', display: 'inline-block' } }, S.h('span', { style: { color: emphasis } }, highlight), S.h('span', { style: { position: 'absolute', inset: 0, color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text', backgroundImage: `linear-gradient(110deg, transparent 30%, ${shine} 50%, transparent 70%)`, backgroundSize: '200% 100%', backgroundPosition: `${pos}% 50%` } }, highlight));
    };

    return (at) => {
      const frame = at * num('speed');
      const sweep = S.spring({ frame: frame - startAt, fps: view.fps, config: { damping: num('springDamping') }, durationInFrames: drawDuration });
      host.replaceChildren(str('before'), nodeAt(frame, sweep), str('after'));
    };
  }
};
