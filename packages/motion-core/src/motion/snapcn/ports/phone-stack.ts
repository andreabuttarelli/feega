import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'phone-stack',
  title: 'Phone stack',
  about: 'Phone screens rise out of a blur one after another, pushing the older ones back so only their tops peek out.',
  category: SnapcnCategory.Screen,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 120,
  background: '#f3f3ee',
  fonts: [],
  props: {
    videos: { type: 'string', title: 'Clips', format: PropFormat.Media, default: '', group: 'Content', maxLength: 2000 },
    time: { type: 'string', title: 'Status bar time', default: '9:41', group: 'Content', maxLength: 10 },
    glowColor: { type: 'string', title: 'Glow colour', format: PropFormat.Color, default: '#cdb4e6', group: 'Style' },
    statusColor: { type: 'string', title: 'Status bar colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    stagger: { type: 'number', title: 'Stagger (frames)', default: 14, minimum: 1, maximum: 60, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const EMPTY_SCREENS = 5;
    const p = view.props;
    const REF_W = 716;
    const REF_H = 398;
    const SCREEN = { w: 240, top: 74, cx: 358, radius: 26 };
    const STEP_SCALE = 0.83;
    const STEP_RISE = 24.6;
    const DEPTH = 3;
    const ENTER = { top: 400, scale: 1.12, blur: 9 };
    const MOVE = 26;
    const RISE = S.Easing.bezier(0.16, 1, 0.3, 1);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const { width, height, fps } = view;
    const background = String(p.background);
    const glow = String(p.glowColor);
    const stagger = Number(p.stagger);
    const tick = (Number(p.speed) * 30) / fps;
    const u = width / REF_W;
    const dy = (height - REF_H * u) / 2;
    const clips = S.media(p.videos);
    const videos = Array.from({ length: Math.max(clips.length, EMPTY_SCREENS) }, (_, i) => clips[i] ?? '');
    const n = videos.length;

    const slot = (depth: number) => {
      let top = SCREEN.top;
      for (let d = 1; d <= depth; d++) {
        top -= STEP_RISE * STEP_SCALE ** (d - 1);
      }
      return { scale: STEP_SCALE ** depth, top };
    };

    const progress = (i: number, frame: number) => {
      let acc = 0;
      for (let k = i; k < n; k++) {
        acc += S.interpolate(frame, [k * stagger, k * stagger + MOVE], [0, 1], { ...clamped, easing: RISE });
      }
      return acc;
    };

    const icons = `<svg viewBox="0 0 68 12" fill="currentColor" style="display:block;height:100%"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="6" width="3" height="6" rx="1"/><rect x="10" y="3.5" width="3" height="8.5" rx="1"/><rect x="15" y="1" width="3" height="11" rx="1"/><path d="M31 2.2c2.6 0 5 1 6.8 2.7l-1.3 1.4A7.9 7.9 0 0 0 31 4.1a7.9 7.9 0 0 0-5.5 2.2l-1.3-1.4A9.8 9.8 0 0 1 31 2.2Zm0 3.8c1.6 0 3 .6 4.1 1.6L33.8 9a3.9 3.9 0 0 0-5.6 0l-1.3-1.4A5.8 5.8 0 0 1 31 6Zm0 3.7 1.6 1.7L31 12l-1.6-1.6L31 9.7Z"/><rect x="43.5" y="1.5" width="21" height="9" rx="2.6" fill="none" stroke="currentColor" opacity="0.45"/><rect x="45.5" y="3.5" width="17" height="5" rx="1.3"/><rect x="65.5" y="4.3" width="1.6" height="3.4" rx="0.8" opacity="0.45"/></svg>`;
    const cover = { position: 'absolute', inset: 0, width: '100%', height: '100%', maxWidth: 'none', objectFit: 'cover' };
    const isVideo = S.videoOf(p.videos);

    const screens = videos.map((src, i) => {
      const media = src ? (S.h(isVideo(src) ? 'video' : 'img', { src, muted: true, playsInline: true, preload: 'auto', style: cover }) as HTMLImageElement | HTMLVideoElement) : null;
      const bar = S.h('div', { style: { position: 'absolute', left: 0, right: 0, top: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.28), rgba(0,0,0,0))' } }) as HTMLElement;
      const island = S.h('div', { style: { position: 'absolute', left: '50%', transform: 'translateX(-50%)', background: '#000000' } }) as HTMLElement;
      const clock = S.h('div', { style: { position: 'absolute', display: 'flex', alignItems: 'center', color: String(p.statusColor), fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif', fontWeight: 600 } }, String(p.time)) as HTMLElement;
      const iconBox = S.h('div', { style: { position: 'absolute', display: 'flex', alignItems: 'center', color: String(p.statusColor) } }) as HTMLElement;
      const iconWrap = S.h('div', {}) as HTMLElement;
      iconWrap.innerHTML = icons;
      iconBox.append(iconWrap);
      const el = S.h('div', { style: { position: 'absolute', overflow: 'hidden', backgroundColor: '#ffffff', zIndex: i, display: 'none' } }, media, bar, island, clock, iconBox) as HTMLElement;
      return { el, media, bar, island, clock, iconBox, iconWrap, start: Math.floor((i * stagger) / tick) };
    });

    const blob = (bottom: number, w: number, h: number, opacity: number, blur: number, z: number) => S.h('div', { style: { position: 'absolute', left: '50%', bottom: `${bottom}px`, width: `${w}px`, height: `${h}px`, transform: 'translateX(-50%)', borderRadius: '50%', background: glow, opacity, filter: `blur(${blur}px)`, zIndex: z } });
    const foot = S.h('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, height: `${0.38 * height}px`, background: `linear-gradient(to bottom, transparent 0%, color-mix(in srgb, ${background} 55%, transparent) 60%, ${background} 100%)`, zIndex: 100 } });
    view.root.replaceChildren(S.h('div', { style: { position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: background } }, blob(-0.55 * height, 1.5 * width, 1.1 * height, 0.55, 70 * u, 0), screens.map((s) => s.el), foot, blob(-0.45 * height, 1.1 * width, 0.7 * height, 0.35, 60 * u, 101)));

    const place = (s: (typeof screens)[number], pr: number, at: number) => {
      const enter = Math.min(pr, 1);
      const depth = Math.max(pr - 1, 0);
      const lo = slot(Math.floor(depth));
      const hi = slot(Math.floor(depth) + 1);
      const f = depth - Math.floor(depth);
      const scale = enter < 1 ? ENTER.scale + (1 - ENTER.scale) * enter : lo.scale + (hi.scale - lo.scale) * f;
      const top = enter < 1 ? ENTER.top + (SCREEN.top - ENTER.top) * enter : lo.top + (hi.top - lo.top) * f;
      const blur = ENTER.blur * (1 - enter);
      const opacity = Math.min(1, enter * 2.5) * S.interpolate(depth, [DEPTH - 1, DEPTH], [1, 0], clamped);
      if (opacity <= 0) {
        s.el.style.display = 'none';
        return;
      }
      const w = SCREEN.w * scale * u;
      const ih = 0.094 * w;
      const itop = 0.028 * w;
      Object.assign(s.el.style, { display: 'block', left: `${SCREEN.cx * u - w / 2}px`, top: `${dy + top * u}px`, width: `${w}px`, height: `${w * (852 / 393)}px`, borderRadius: `${SCREEN.radius * scale * u}px`, boxShadow: `0 ${8 * u}px ${28 * u}px rgba(70, 50, 110, 0.14), 0 0 0 ${0.6 * u}px rgba(255, 255, 255, 0.9)`, opacity: String(opacity), filter: blur > 0.05 ? `blur(${blur * u}px)` : '' });
      s.bar.style.height = `${itop * 2 + ih}px`;
      Object.assign(s.island.style, { top: `${itop}px`, width: `${0.32 * w}px`, height: `${ih}px`, borderRadius: `${ih / 2}px` });
      Object.assign(s.clock.style, { left: `${0.09 * w}px`, top: `${itop}px`, height: `${ih}px`, fontSize: `${0.045 * w}px` });
      Object.assign(s.iconBox.style, { right: `${0.07 * w}px`, top: `${itop}px`, height: `${ih}px` });
      s.iconWrap.style.height = `${0.034 * w}px`;
      if (s.media instanceof HTMLVideoElement) {
        const t = Math.max(0, at - s.start) / fps;
        if (Math.abs(s.media.currentTime - t) > 0.001) {
          s.media.currentTime = t;
        }
      }
    };

    return (at) => {
      const frame = at * tick;
      screens.forEach((s, i) => {
        const pr = progress(i, frame);
        if (pr <= 0) {
          s.el.style.display = 'none';
          return;
        }
        place(s, pr, at);
      });
    };
  }
};
