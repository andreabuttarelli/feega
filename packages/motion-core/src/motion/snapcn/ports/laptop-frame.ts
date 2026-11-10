import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'laptop-frame',
  title: 'Laptop frame',
  about: 'A floating laptop rises in with a live notch and a landing page on screen, with an optional push into the screen.',
  category: SnapcnCategory.Screen,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 240,
  background: '#faf9f6',
  fonts: ['Inter'],
  props: {
    screenSrc: { type: 'string', title: 'Screen image or clip', format: PropFormat.Media, default: '', group: 'Content', maxLength: 2000 },
    notchLabel: { type: 'string', title: 'Notch label', default: 'AirPods Connected', group: 'Content', maxLength: 60 },
    batteryLevel: { type: 'number', title: 'Battery level (%)', default: 85, minimum: 0, maximum: 100, step: 1, group: 'Content' },
    showNotch: { type: 'string', title: 'Notch', enum: ['on', 'off'], default: 'on', group: 'Content' },
    entrance: { type: 'string', title: 'Entrance', enum: ['rise', 'open', 'none'], default: 'rise', group: 'Motion' },
    finale: { type: 'string', title: 'Finale', enum: ['none', 'zoom-to-screen'], default: 'none', group: 'Motion' },
    restTilt: { type: 'number', title: 'Lid tilt (deg)', default: 18, minimum: 0, maximum: 80, step: 1, group: 'Layout' },
    radius: { type: 'number', title: 'Lid radius (px)', default: 22, minimum: 0, maximum: 60, step: 1, group: 'Layout' },
    scale: { type: 'number', title: 'Scale', default: 0.95, minimum: 0.2, maximum: 2, step: 0.01, group: 'Layout' },
    floatLoop: { type: 'string', title: 'Float', enum: ['on', 'off'], default: 'on', group: 'Motion' },
    floatAmplitude: { type: 'number', title: 'Float amplitude (px)', default: 4, minimum: 0, maximum: 40, step: 0.5, group: 'Motion' },
    bezelColor: { type: 'string', title: 'Bezel (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    screenColor: { type: 'string', title: 'Screen (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    indicatorColor: { type: 'string', title: 'Battery colour', format: PropFormat.Color, default: '#30D158', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const shell = S.themeOf('dark');
    const c = (k: string) => String(t[k]);
    const sh = (k: string) => String(shell[k]);
    const LID_WIDTH = 820;
    const LID_HEIGHT = 500;
    const BEZEL = 14;
    const DECK_WIDTH = 900;
    const DECK_HEIGHT = 22;
    const PERSPECTIVE = 1600;
    const ENTRANCE_FRAMES = 30;
    const PUSH_START = 140;
    const PUSH_END = 185;
    const COLUMN_HEIGHT = LID_HEIGHT + DECK_HEIGHT;
    const NOTCH = { idle: 116, loading: 150, done: 320, loadingStart: 72, doneStart: 120 };
    const CAMERA_EASE = S.Easing.bezier(0.2, 0.6, 0.35, 1);
    const OUT = S.Easing.out(S.Easing.cubic);
    const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const { fps, width, height } = view;
    const entrance = String(p.entrance);
    const finale = String(p.finale);
    const restTilt = Number(p.restTilt);
    const radius = Number(p.radius);
    const scale = Number(p.scale);
    const face = S.pick(p.fontFamily, 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
    const lidColor = S.pick(p.bezelColor, S.mixOklch(sh('background'), sh('foreground'), 0.09));
    const glass = S.pick(p.screenColor, c('card'));
    const indicator = S.pick(p.indicatorColor, '#30D158');
    const src = S.media(p.screenSrc)[0] ?? '';

    const risers: [HTMLElement, number][] = [];
    const rise = (el: Element, delay: number) => {
      risers.push([el as HTMLElement, delay]);
      return el;
    };
    const grad = `linear-gradient(135deg, ${c('primary')}, ${S.mixOklch(c('primary'), c('foreground'), 0.18)})`;
    const placeholder = () =>
      S.h('div', { style: { position: 'absolute', inset: 0, background: `linear-gradient(165deg, ${c('card')} 0%, ${S.mixOklch(c('card'), c('primary'), 0.06)} 100%)`, color: c('foreground'), display: 'flex', flexDirection: 'column' } },
        rise(S.h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 34px' } },
          S.h('div', { style: { display: 'flex', alignItems: 'center', gap: 9 } }, S.h('div', { style: { width: 24, height: 24, borderRadius: 7, background: grad } }), S.h('span', { style: { fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' } }, 'Acme')),
          S.h('div', { style: { display: 'flex', alignItems: 'center', gap: 20 } }, ['Product', 'Pricing', 'Docs'].map((l) => S.h('span', { style: { fontSize: 13.5, color: c('mutedForeground') } }, l)), S.h('div', { style: { padding: '7px 14px', borderRadius: 8, backgroundColor: c('foreground'), color: c('background'), fontSize: 13, fontWeight: 600 } }, 'Sign in'))), 6),
        S.h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 40px', gap: 18 } },
          rise(S.h('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 999, border: `1px solid ${c('border')}`, backgroundColor: c('card'), fontSize: 12.5, fontWeight: 600, color: c('primary') } }, S.h('span', { style: { width: 6, height: 6, borderRadius: 999, backgroundColor: c('primary') } }), 'Now in public beta'), 12),
          rise(S.h('div', { style: { fontSize: 46, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, maxWidth: 560 } }, 'Ship demos that sell.'), 16),
          rise(S.h('div', { style: { fontSize: 16.5, lineHeight: 1.5, color: c('mutedForeground'), maxWidth: 440 } }, 'Turn your product into a polished launch video in minutes — no editor, no render farm.'), 20),
          rise(S.h('div', { style: { display: 'flex', gap: 10, marginTop: 6 } },
            S.h('div', { style: { padding: '11px 20px', borderRadius: 10, background: grad, color: c('primaryForeground'), fontSize: 14.5, fontWeight: 600, boxShadow: `0 10px 24px ${S.withAlpha(c('primary'), 0.32)}` } }, 'Get started'),
            S.h('div', { style: { padding: '11px 20px', borderRadius: 10, border: `1px solid ${c('border')}`, backgroundColor: c('card'), fontSize: 14.5, fontWeight: 600 } }, 'Watch demo')), 24)));

    const mediaStyle = { position: 'absolute', inset: 0, width: '100%', height: '100%', maxWidth: 'none', objectFit: 'cover' };
    const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(src);
    const media = src ? (S.h(isVideo ? 'video' : 'img', isVideo ? { src, muted: true, playsinline: true, preload: 'auto', style: mediaStyle } : { src, alt: '', style: mediaStyle }) as HTMLElement) : null;
    const screenContent = media ?? placeholder();

    const dot = (size: number, color: string, extra: Record<string, string | number> = {}) => S.h('div', { style: { width: size, height: size, borderRadius: 999, backgroundColor: color, ...extra } }) as HTMLElement;
    const layer = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };
    const idleLayer = S.h('div', { style: { ...layer, gap: 6 } }, dot(9, S.mixOklch(sh('background'), sh('foreground'), 0.12), { border: `1px solid ${S.mixOklch(sh('background'), sh('foreground'), 0.2)}` }), dot(5, S.mixOklch(sh('background'), sh('foreground'), 0.06))) as HTMLElement;
    const loaders = [0, 1, 2].map(() => dot(5, sh('foreground')));
    const loadingLayer = S.h('div', { style: { ...layer, gap: 4 } }, loaders) as HTMLElement;
    const battery = Math.max(0, Math.min(100, Number(p.batteryLevel)));
    const doneLayer = S.h('div', { style: { ...layer, gap: 8 } },
      S.h('span', { style: { fontSize: 12, fontWeight: 500, letterSpacing: '-0.01em', color: sh('foreground'), whiteSpace: 'nowrap' } }, String(p.notchLabel)),
      S.h('div', { style: { width: 22, height: 11, borderRadius: 3, border: `1.5px solid ${indicator}`, padding: 1.5, display: 'flex', alignItems: 'center' } }, S.h('div', { style: { width: `${battery}%`, height: '100%', borderRadius: 1, backgroundColor: indicator } }))) as HTMLElement;
    const notch = S.h('div', { style: { position: 'absolute', top: 9, left: '50%', translate: '-50% 0px', height: 30, borderRadius: 999, backgroundColor: sh('background'), overflow: 'hidden', zIndex: 10 } }, idleLayer, loadingLayer, doneLayer) as HTMLElement;
    const notchWrap = S.h('div', {}, notch) as HTMLElement;

    const inner = Math.max(4, radius - BEZEL);
    const screen = S.h('div', { style: { position: 'relative', width: '100%', height: '100%', borderRadius: `${inner}px ${inner}px 4px 4px`, backgroundColor: glass, overflow: 'hidden' } }, screenContent, p.showNotch === 'off' ? null : notchWrap);
    const lid = S.h('div', { style: { width: LID_WIDTH, height: LID_HEIGHT, borderRadius: `${radius}px ${radius}px 6px 6px`, backgroundColor: lidColor, padding: BEZEL, transformOrigin: 'center bottom' } }, screen) as HTMLElement;
    const deck = S.h('div', { style: { position: 'relative', width: DECK_WIDTH, height: DECK_HEIGHT, borderRadius: '6px 6px 40px 40px', background: `linear-gradient(to bottom, ${S.withAlpha(sh('foreground'), 0.16)}, ${S.withAlpha(sh('background'), 0)} 34%, ${S.withAlpha(sh('background'), 0.34)}), ${lidColor}`, boxShadow: `0 40px 80px ${S.withAlpha(sh('background'), 0.45)}` } },
      S.h('div', { style: { position: 'absolute', top: 0, left: '50%', translate: '-50% 0px', width: 132, height: 8, borderRadius: '0 0 6px 6px', backgroundColor: S.withAlpha(sh('background'), 0.28) } }));
    const posed = S.h('div', {}, S.h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', perspective: PERSPECTIVE } }, lid, deck)) as HTMLElement;
    const camera = S.h('div', { style: { transformOrigin: 'center center', textRendering: 'geometricPrecision' } }, posed) as HTMLElement;
    view.root.replaceChildren(S.h('style', {}, '.snapcn-laptop, .snapcn-laptop * { box-sizing: border-box; }'), S.h('div', { className: 'snapcn-laptop', style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: face, fontOpticalSizing: 'none' } }, camera));

    const pose = (frame: number) => {
      if (entrance === 'none') {
        return { opacity: 1, y: 0 };
      }
      if (entrance === 'open') {
        return { opacity: S.interpolate(frame, [0, 10], [0, 1], CLAMP), y: S.interpolate(frame, [0, 24], [24, 0], { ...CLAMP, easing: OUT }) };
      }
      return { opacity: S.interpolate(frame, [0, 12], [0, 1], CLAMP), y: S.interpolate(frame, [0, 26], [70, 0], { ...CLAMP, easing: OUT }) };
    };
    const tiltAt = (frame: number) => {
      const opened = entrance === 'open' ? S.interpolate(frame, [0, ENTRANCE_FRAMES], [82, restTilt], { ...CLAMP, easing: OUT }) : restTilt;
      if (finale !== 'zoom-to-screen' || frame < PUSH_START) {
        return opened;
      }
      return S.interpolate(frame, [PUSH_START, PUSH_END], [restTilt, 0], { ...CLAMP, easing: CAMERA_EASE });
    };
    const cameraAt = (frame: number) => {
      if (finale !== 'zoom-to-screen') {
        return { s: 1, y: 0 };
      }
      const k = S.interpolate(frame, [PUSH_START, PUSH_END], [0, 1], { ...CLAMP, easing: CAMERA_EASE });
      const cover = Math.max(width / ((LID_WIDTH - 2 * BEZEL) * scale), height / ((LID_HEIGHT - 2 * BEZEL) * scale));
      return { s: 1 + (cover - 1) * k, y: (COLUMN_HEIGHT / 2 - LID_HEIGHT / 2) * scale * cover * k };
    };
    const bobAt = (frame: number) => {
      if (p.floatLoop === 'off' || (finale === 'zoom-to-screen' && frame >= PUSH_START)) {
        return 0;
      }
      const v = Math.sin((Math.max(0, frame - ENTRANCE_FRAMES) / (fps * 5)) * Math.PI * 2) * Number(p.floatAmplitude);
      return v === 0 ? 0 : -v;
    };
    const notchAt = (frame: number) => {
      const { loadingStart: a, doneStart: b } = NOTCH;
      notch.style.width = `${S.interpolate(frame, [a - 8, a, b - 4, b + 12], [NOTCH.idle, NOTCH.loading, NOTCH.loading, NOTCH.done], { ...CLAMP, easing: S.Easing.inOut(S.Easing.cubic) })}px`;
      idleLayer.style.opacity = String(S.interpolate(frame, [a - 6, a], [1, 0], CLAMP));
      loadingLayer.style.opacity = String(S.interpolate(frame, [a - 6, a, b - 6, b], [0, 1, 1, 0], CLAMP));
      doneLayer.style.opacity = String(S.interpolate(frame, [b - 4, b + 6], [0, 1], CLAMP));
      loaders.forEach((d, i) => {
        d.style.opacity = String(0.4 + 0.6 * (0.5 + 0.5 * Math.sin(frame / 4 - i * 0.9)));
      });
      const fade = finale === 'zoom-to-screen' ? S.interpolate(frame, [PUSH_START, PUSH_START + 10], [1, 0], CLAMP) : 1;
      notchWrap.style.opacity = String(fade);
      notchWrap.style.display = fade > 0 ? '' : 'none';
    };

    return (at) => {
      const frame = at * (Number(p.speed) || 1);
      const cam = cameraAt(frame);
      camera.style.transform = `translateY(${cam.y}px) scale(${cam.s})`;
      const ps = pose(frame);
      posed.style.opacity = String(ps.opacity);
      posed.style.translate = `0px ${ps.y + bobAt(frame)}px`;
      posed.style.scale = String(scale);
      lid.style.transform = `rotateX(${tiltAt(frame)}deg)`;
      notchAt(frame);
      risers.forEach(([el, delay]) => {
        const r = S.interpolate(frame, [delay, delay + 14], [0, 1], { ...CLAMP, easing: OUT });
        el.style.opacity = String(r);
        el.style.transform = `translateY(${(1 - r) * 14}px)`;
      });
      if (media) {
        const r = S.interpolate(frame, [4, 22], [0, 1], CLAMP);
        media.style.opacity = String(r);
        media.style.filter = `blur(${(1 - r) * 8}px)`;
      }
      if (media instanceof HTMLVideoElement) {
        media.currentTime = frame / fps;
      }
    };
  }
};
