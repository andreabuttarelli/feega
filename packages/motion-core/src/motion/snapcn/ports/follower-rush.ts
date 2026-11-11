import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'follower-rush',
  title: 'Follower rush',
  about: 'One follow notification turns into a growing avatar pile that bends into a travelling wave while the follower count races up.',
  category: SnapcnCategory.Social,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 300,
  background: '#ffffff',
  fonts: ['Inter'],
  props: {
    totalFollowers: { type: 'number', title: 'Total followers', default: 5000, minimum: 0, maximum: 100000000, step: 1, group: 'Content' },
    names: { type: 'string', title: 'Follower names (comma separated)', default: 'Manon,Melon,Victor,Shane,Lisa,Natasha,Annie,Abdull,Kratos,Jhone,Matt,Huggy,Felomi,Hazar,Mikasa,Silmon,Luciano,Nova,Priya,Theo,Amelia,Rafael,Sofia,Kai,Jordan,Nora,Dana,Milo,Yuki,Bruno,Elena,Omar,Ivy,Leo,Zara,Finn,Maya,Cole', group: 'Content', maxLength: 2000 },
    accentColor: { type: 'string', title: 'Accent (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    orientation: { type: 'string', title: 'Orientation', enum: ['horizontal', 'vertical'], default: 'horizontal', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const tk = S.themeOf(String(p.mode));
    const t = { bg: String(tk.card), fg: String(tk.foreground), fgMuted: String(tk.mutedForeground), avatarBg: String(tk.muted) };
    const face = S.pick(p.fontFamily, 'Inter');
    const accent = S.pick(p.accentColor, String(tk.primary));
    const parsed = String(p.names).split(',').map((n) => n.trim()).filter(Boolean);
    const pool = parsed.length ? parsed : ['Manon'];
    const isVertical = p.orientation === 'vertical';
    const speed = Number(p.speed);
    const refW = isVertical ? 720 : 1280;
    const refH = isVertical ? 1280 : 720;
    const stageScale = Math.min(view.width / refW, view.height / refH);

    const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
    const smoothstep = (x: number) => {
      const c = clamp01(x);
      return c * c * (3 - 2 * c);
    };
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
    const followerCount = (fc: number, target: number, startF: number, midF: number, endF: number, midCount: number) => {
      if (fc <= startF) {
        return 1;
      }
      if (fc <= midF) {
        return Math.min(target, Math.max(1, Math.round(1 + ((fc - startF) / (midF - startF)) * (midCount - 1))));
      }
      const q = clamp01((fc - midF) / (endF - midF));
      return Math.min(target, Math.round(midCount * (target / midCount) ** q));
    };
    const waveScroll = (fc: number, growEnd: number, explodeEnd: number, v0: number, vMax: number) => {
      const f = Math.max(0, fc - growEnd);
      const T = explodeEnd - growEnd;
      if (f <= T) {
        return v0 * f + ((vMax - v0) * f * f) / (2 * T);
      }
      return (T * (v0 + vMax)) / 2 + vMax * (f - T);
    };

    const APPEAR = 8;
    const INLINE_END = 20;
    const MORPH_END = 34;
    const GROW_END = 84;
    const EXPLODE_END = 140;
    const MAX = 22;
    const SLOTS = MAX + 2;
    const NAME_SLOT = 9;
    const D = isVertical ? 60 : 66;
    const ring = isVertical ? 3 : 4;
    const pilePitch = D * 0.76;
    const iconSize = D * 0.92;
    const iconGap = D * 0.24;
    const rowY = isVertical ? refH * 0.4 : 316;
    const textY = isVertical ? refH * 0.52 : 452;
    const inlineY = refH / 2;
    const fontSize = isVertical ? 40 : 48;
    const waveMargin = isVertical ? 44 : 74;
    const waveSpan = refW - waveMargin * 2;
    const waveP = waveSpan / (MAX - 1);
    const target = Math.max(0, Math.round(Number(p.totalFollowers))) + 1;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

    const BADGE = 'M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z';
    const badge = (size: number) => S.h('svg', { viewBox: '0 0 22 22', width: size, height: size, fill: accent, style: { flexShrink: 0, display: 'block' } }, S.h('path', { d: BADGE }));
    const person = (size: number) => S.h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: accent, style: { display: 'block' } }, S.h('circle', { cx: 12, cy: 7.2, r: 4 }), S.h('path', { d: 'M12 13.4c-4.05 0-7.2 2.3-7.2 5.6 0 .55.45 1 1 1h12.4c.55 0 1-.45 1-1 0-3.3-3.15-5.6-7.2-5.6z' }));
    const avatar = (name: string) => S.h('div', { style: { position: 'relative', width: D, height: D, borderRadius: 9999, background: t.avatarBg, boxShadow: `0 0 0 ${ring}px ${t.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.fgMuted, fontFamily: face, fontWeight: 700, fontSize: D * 0.4, overflow: 'hidden', flexShrink: 0 } }, name.charAt(0).toUpperCase());
    const othersText = (others: number) => (others <= 0 ? 'followed you' : `and ${String(others).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} others followed you`);
    const followLine = () => {
      const nameEl = S.h('span', { style: { fontWeight: 800, color: t.fg, letterSpacing: '-0.01em' } }) as HTMLElement;
      const restEl = S.h('span', { style: { fontWeight: 500, color: t.fgMuted } }) as HTMLElement;
      const el = S.h('div', { style: { display: 'inline-flex', alignItems: 'center', gap: fontSize * 0.24, whiteSpace: 'nowrap', fontFamily: face, fontSize, lineHeight: 1 } }, nameEl, badge(fontSize * 0.62), restEl);
      return { el, set: (name: string, others: number) => {
        if (nameEl.textContent !== name) {
          nameEl.textContent = name;
        }
        const rest = othersText(others);
        if (restEl.textContent !== rest) {
          restEl.textContent = rest;
        }
      } };
    };

    const inlineLine = followLine();
    inlineLine.set(pool[0], 0);
    const inline = S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: iconGap } }, person(iconSize), avatar(pool[0]), S.h('div', { style: { marginLeft: iconGap * 0.6 } }, inlineLine.el)) as HTMLElement;
    const icon = S.h('div', { style: { position: 'absolute' } }, person(iconSize)) as HTMLElement;
    const edge = (waveMargin / refW) * 100;
    const mask = `linear-gradient(to right, transparent 0%, #000 ${edge + 1}%, #000 ${100 - edge - 1}%, transparent 100%)`;
    const crowd = S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, WebkitMaskImage: mask, maskImage: mask } }) as HTMLElement;
    const slots = Array.from({ length: SLOTS }, (_, i) => {
      const el = S.h('div', { style: { position: 'absolute', zIndex: SLOTS - i } }) as HTMLElement;
      crowd.appendChild(el);
      return { el, name: '' };
    });
    const textLine = followLine();
    const text = S.h('div', { style: { position: 'absolute', left: 0, right: 0, top: textY, display: 'flex', justifyContent: 'center', textRendering: 'geometricPrecision' } }, textLine.el) as HTMLElement;
    const stage = S.h('div', { style: { position: 'absolute', left: '50%', top: '50%', width: refW, height: refH, transform: `translate(-50%, -50%) scale(${stageScale})` } }, inline, icon, crowd, text) as HTMLElement;
    view.root.replaceChildren(S.fill({ background: t.bg, fontOpticalSizing: 'none' }, stage));

    const nameFreeze = Math.floor((EXPLODE_END - INLINE_END) / NAME_SLOT);

    return (frame) => {
      const fc = frame * speed;
      const count = followerCount(fc, target, INLINE_END, GROW_END, EXPLODE_END, MAX);
      stage.style.opacity = String(S.interpolate(fc, [0, APPEAR], [0, 1], clamped));
      const stackP = smoothstep((fc - INLINE_END) / (MORPH_END - INLINE_END));
      const inlineOut = smoothstep((fc - INLINE_END) / 7);
      const textIn = smoothstep((fc - (INLINE_END + 7)) / (MORPH_END - INLINE_END));
      const sp = smoothstep((fc - GROW_END) / (EXPLODE_END - GROW_END));
      const iconOpacity = S.interpolate(fc, [GROW_END - 6, GROW_END + 36], [1, 0], clamped);

      inline.style.display = inlineOut < 1 ? 'flex' : 'none';
      inline.style.opacity = String(1 - inlineOut);
      inline.style.transform = `translateY(${lerp(0, -18, inlineOut)}px)`;

      const pileCountF = Math.min(MAX, fc <= INLINE_END ? 1 : fc <= GROW_END ? 1 + ((fc - INLINE_END) / (GROW_END - INLINE_END)) * (MAX - 1) : MAX);
      const groupLeft = (refW - (iconSize + iconGap + (pileCountF - 1) * pilePitch + D)) / 2;
      const pileStartCX = groupLeft + iconSize + iconGap + D / 2;

      icon.style.display = iconOpacity > 0 && sp < 1 ? 'block' : 'none';
      icon.style.left = `${groupLeft + iconSize / 2}px`;
      icon.style.top = `${lerp(inlineY, rowY, stackP)}px`;
      icon.style.transform = `translate(-50%, -50%) scale(${1 - sp})`;
      icon.style.opacity = String(iconOpacity * stackP);

      crowd.style.opacity = String(stackP);
      const waveAmp = (isVertical ? 40 : 46) * sp;
      const wavePhase = fc * 0.05;
      const scrollPx = waveScroll(fc, GROW_END, EXPLODE_END, isVertical ? 0.6 : 0.85, isVertical ? 15 : 22);
      const scrollUnit = Math.floor(scrollPx / waveP);
      slots.forEach((slot, i) => {
        const popIn = smoothstep(clamp01(count - i));
        const opacity = lerp(i < MAX ? popIn : 0, 1, sp);
        if (opacity <= 0.001) {
          slot.el.style.display = 'none';
          return;
        }
        const name = pool[(i + scrollUnit) % pool.length];
        if (slot.name !== name) {
          slot.name = name;
          slot.el.replaceChildren(avatar(name));
        }
        const cx = lerp(pileStartCX + i * pilePitch, waveMargin + i * waveP - (scrollPx % waveP), sp);
        const waveCY = rowY + waveAmp * Math.sin((cx / refW) * Math.PI * 2 * 1.55 + wavePhase);
        slot.el.style.display = 'block';
        slot.el.style.left = `${cx}px`;
        slot.el.style.top = `${lerp(lerp(inlineY, rowY, stackP), waveCY, sp)}px`;
        slot.el.style.transform = `translate(-50%, -50%) scale(${lerp(lerp(0.55, 1, popIn), 1, sp)})`;
        slot.el.style.opacity = String(opacity);
      });

      const nameIdx = fc < INLINE_END ? 0 : Math.min(Math.floor((fc - INLINE_END) / NAME_SLOT), nameFreeze);
      textLine.set(pool[nameIdx % pool.length], count - 1);
      text.style.transform = `translateY(-50%) translateY(${lerp(12, 0, textIn)}px)`;
      text.style.opacity = String(textIn);
    };
  }
};
