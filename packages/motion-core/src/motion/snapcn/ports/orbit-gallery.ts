import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'orbit-gallery',
  title: 'Orbit gallery',
  about: 'Cards stream along an Archimedean spiral into the centre while a title, subtitle and pill button fade up over a soft scrim.',
  category: SnapcnCategory.Scene,
  width: 1080,
  height: 1920,
  fps: 30,
  frames: 300,
  background: '#0a0a0b',
  fonts: [],
  props: {
    title: { type: 'string', title: 'Title', default: 'A whole new universe', group: 'Content', maxLength: 120 },
    subtitle: { type: 'string', title: 'Subtitle', default: 'Article — The Design Process', group: 'Content', maxLength: 120 },
    buttonLabel: { type: 'string', title: 'Button label (empty hides)', default: 'Explore', group: 'Content', maxLength: 40 },
    images: { type: 'string', title: 'Image URLs, comma separated (empty = tiles)', default: '', group: 'Content', maxLength: 2000 },
    footerLeft: { type: 'string', title: 'Footer left', default: '', group: 'Content', maxLength: 60 },
    footerCenter: { type: 'string', title: 'Footer centre', default: '', group: 'Content', maxLength: 60 },
    footerRight: { type: 'string', title: 'Footer right', default: '', group: 'Content', maxLength: 60 },
    turns: { type: 'number', title: 'Spiral turns', default: 3, minimum: 1, maximum: 10, step: 0.5, group: 'Layout' },
    spacing: { type: 'number', title: 'Card spacing', default: 5, minimum: 1, maximum: 40, step: 0.5, group: 'Layout' },
    spread: { type: 'number', title: 'Spread', default: 7, minimum: 1, maximum: 20, step: 0.5, group: 'Layout' },
    sizeAttenuation: { type: 'number', title: 'Shrink toward centre', default: 2, minimum: 0, maximum: 6, step: 0.1, group: 'Layout' },
    imageSize: { type: 'number', title: 'Card size', default: 172, minimum: 20, maximum: 600, step: 1, group: 'Layout' },
    cardAspect: { type: 'number', title: 'Card aspect (w/h)', default: 0.78, minimum: 0.3, maximum: 2, step: 0.01, group: 'Layout' },
    cornerRadius: { type: 'number', title: 'Corner rounding (0-20)', default: 5, minimum: 0, maximum: 20, step: 1, group: 'Layout' },
    fadeIn: { type: 'number', title: 'Fade in (% of path)', default: 20, minimum: 0, maximum: 100, step: 1, group: 'Motion' },
    fadeOut: { type: 'number', title: 'Fade out (% of path)', default: 0, minimum: 0, maximum: 100, step: 1, group: 'Motion' },
    orbitSeconds: { type: 'number', title: 'Seconds per turnover', default: 40, minimum: 1, maximum: 240, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' },
    textColor: { type: 'string', title: 'Text colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'dark', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const tokens = S.themeOf(String(p.mode));
    const face = S.pick(p.fontFamily, 'Inter, -apple-system, BlinkMacSystemFont, sans-serif');
    const stage = S.pick(p.background, String(tokens.background));
    const ink = S.pick(p.textColor, String(tokens.foreground));
    const { width, height, fps, frames } = view;
    const turns = Number(p.turns);
    const spacing = Number(p.spacing);
    const sizeAttenuation = Number(p.sizeAttenuation);
    const cardAspect = Number(p.cardAspect);
    const fadeIn = Number(p.fadeIn);
    const fadeOut = Number(p.fadeOut);
    const cornerRadius = Number(p.cornerRadius);
    const speed = Number(p.speed);
    const title = String(p.title);
    const subtitle = String(p.subtitle);
    const buttonLabel = String(p.buttonLabel);
    const artwork = String(p.images).split(',').map((s) => s.trim()).filter(Boolean);
    const FILLS = ['linear-gradient(135deg, #2b5fd9, #14306e)', 'linear-gradient(135deg, #c96f2f, #7a3c12)', 'linear-gradient(135deg, #e8e4da, #b6ad99)', 'linear-gradient(135deg, #c8332b, #6e1511)', 'linear-gradient(135deg, #b9a0d0, #6f5590)', 'linear-gradient(135deg, #4c6b3c, #24361a)', 'linear-gradient(135deg, #1f4dd8, #0d2262)', 'linear-gradient(135deg, #d9d2c5, #a09684)'];
    const TWO_PI = Math.PI * 2;
    const ARC_SAMPLES = 1024;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const outCubic = S.Easing.out(S.Easing.cubic);
    const outBack = S.Easing.out(S.Easing.back(1.4));

    const minDim = Math.min(width, height);
    const R = 0.48 * minDim * (1 + (Number(p.spread) - 1) * 0.18);
    const baseSize = Number(p.imageSize) * (minDim / 600);
    const nImgs = artwork.length || 1;

    const point = (n: number, r: number) => {
      const ang = n * turns * TWO_PI;
      const rad = r * (1 - n);
      return { x: rad * Math.cos(ang), y: -rad * Math.sin(ang) };
    };

    const samples = 2000;
    const cum = new Float64Array(samples + 1);
    let prev = point(0, 1);
    for (let k = 1; k <= samples; k++) {
      const pt = point(k / samples, 1);
      cum[k] = cum[k - 1] + Math.hypot(pt.x - prev.x, pt.y - prev.y);
      prev = pt;
    }
    const total = cum[samples] || 1;
    const nForArc = new Float64Array(ARC_SAMPLES + 1);
    let j = 0;
    for (let a = 0; a <= ARC_SAMPLES; a++) {
      const target = (a / ARC_SAMPLES) * total;
      while (j < samples && cum[j + 1] < target) {
        j++;
      }
      const seg = cum[j + 1] - cum[j];
      nForArc[a] = (j + (seg > 0 ? (target - cum[j]) / seg : 0)) / samples;
    }
    const arcToN = (s: number) => {
      const x = Math.max(0, Math.min(ARC_SAMPLES, s * ARC_SAMPLES));
      const i = Math.floor(x);
      const a = nForArc[i];
      return a + (nForArc[Math.min(i + 1, ARC_SAMPLES)] - a) * (x - i);
    };

    const stepFrac = Math.max(0.005, (spacing * 0.5) / 100);
    const slots = Math.min(400, Math.ceil(1 / stepFrac) + 2);
    const stepsPerLoop = Math.max(1, Math.round(frames / fps / Number(p.orbitSeconds) / stepFrac));
    const cardBg = S.mixOklch(stage, String(tokens.card), 0.35);
    const shadowInk = S.withAlpha(S.mixOklch(stage, '#000', 0.75), 0.4);
    const titleSize = Math.min(width * 0.066, height * 0.11);
    const centerBlurR = minDim * 0.16;

    const cardEls = Array.from({ length: slots }, (_, i) => {
      const imgIdx = i % nImgs;
      const src = artwork.length ? artwork[imgIdx % nImgs] : '';
      const img = src ? S.h('img', { src, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } }) as HTMLImageElement : null;
      if (img) {
        img.onerror = () => img.remove();
      }
      return S.h('div', { style: { position: 'absolute', left: '50%', top: '50%', overflow: 'hidden', backgroundColor: cardBg } }, S.h('div', { style: { position: 'absolute', inset: 0, backgroundImage: FILLS[imgIdx % FILLS.length] } }), img) as HTMLElement;
    });

    const showScrim = (title || subtitle || buttonLabel) && S.parseColor(stage).alpha !== 0;
    const scrim = showScrim ? S.h('div', { style: { position: 'absolute', left: '50%', top: '50%', width: width * 0.66, height: height * 0.5, marginLeft: -(width * 0.66) / 2, marginTop: -(height * 0.5) / 2, borderRadius: '50%', backgroundImage: `radial-gradient(ellipse at center, ${S.withAlpha(stage, 0.62)} 0%, ${S.withAlpha(stage, 0.34)} 42%, transparent 70%)`, zIndex: 9 } }) as HTMLElement : null;
    const titleEl = title ? S.h('div', { style: { fontSize: titleSize, fontWeight: 500, letterSpacing: '-0.015em', lineHeight: 1.08, color: ink, maxWidth: '82%' } }, title) as HTMLElement : null;
    const subEl = subtitle ? S.h('div', { style: { marginTop: titleSize * 0.42, fontSize: titleSize * 0.26, letterSpacing: '0.02em', color: ink } }, subtitle) as HTMLElement : null;
    const btnEl = buttonLabel ? S.h('div', { style: { marginTop: titleSize * 0.5, padding: `${titleSize * 0.14}px ${titleSize * 0.34}px`, borderRadius: 9999, backgroundColor: S.withAlpha(ink, 0.14), fontSize: titleSize * 0.23, fontWeight: 500, color: ink } }, buttonLabel) as HTMLElement : null;
    const hasFooter = Boolean(p.footerLeft || p.footerCenter || p.footerRight);
    const footer = hasFooter ? S.h('div', { style: { position: 'absolute', left: width * 0.05, right: width * 0.05, bottom: height * 0.032, display: 'flex', justifyContent: 'space-between', fontSize: titleSize * 0.22, color: ink, zIndex: 10 } }, S.h('span', {}, String(p.footerLeft)), S.h('span', {}, String(p.footerCenter)), S.h('span', {}, String(p.footerRight))) as HTMLElement : null;
    const lockup = S.fill({ alignItems: 'center', justifyContent: 'center', textAlign: 'center', zIndex: 10 }, titleEl, subEl, btnEl);
    view.root.replaceChildren(S.fill({ backgroundColor: stage, fontFamily: face, fontVariationSettings: "'opsz' 14", display: 'block' }, cardEls, scrim, lockup, footer));

    return (frame) => {
      const t = frame * speed;
      const base = ((((t / frames) * stepsPerLoop * stepFrac) % 1) + 1) % 1;
      const intro = S.interpolate(t, [0, 16], [0, 1], clamped);
      const order = cardEls.map((el, i) => {
        const s = (((base + i * stepFrac) % 1) + 1) % 1;
        return { el, tt: s * 100, n: arcToN(s) };
      }).sort((a, b) => a.n - b.n);

      order.forEach(({ el, tt, n }) => {
        let opacity = 1;
        if (tt < fadeIn) {
          opacity = tt / fadeIn;
        } else if (fadeOut > 0 && tt > 100 - fadeOut) {
          opacity = (100 - tt) / fadeOut;
        }
        const pt = point(n, R);
        const dist = Math.hypot(pt.x, pt.y);
        const scale = sizeAttenuation > 0 ? Math.min(dist / R, 1) ** (sizeAttenuation * 0.5) : 1;
        if (opacity < 0.01 || scale < 0.002) {
          el.style.display = 'none';
          return;
        }
        const p2 = point(Math.min(n + 0.001, 1), R);
        const angleDeg = (Math.atan2(p2.y - pt.y, p2.x - pt.x) * 180) / Math.PI;
        const ch = baseSize * scale;
        const cw = ch * cardAspect;
        const blurPx = dist < centerBlurR ? (1 - dist / centerBlurR) * 4 : 0;
        const st = el.style;
        st.display = '';
        st.width = `${cw}px`;
        st.height = `${ch}px`;
        st.marginLeft = `${-cw / 2}px`;
        st.marginTop = `${-ch / 2}px`;
        st.zIndex = String(Math.round(n * 8));
        st.translate = `${pt.x.toFixed(2)}px ${pt.y.toFixed(2)}px`;
        st.rotate = `${angleDeg.toFixed(2)}deg`;
        st.opacity = String(opacity * intro);
        st.filter = blurPx > 0.15 ? `blur(${blurPx.toFixed(2)}px)` : '';
        st.borderRadius = `${(cornerRadius / 20) * (Math.min(cw, ch) / 2)}px`;
        st.boxShadow = `0 ${(ch * 0.12).toFixed(1)}px ${(ch * 0.3).toFixed(1)}px ${shadowInk}`;
        el.parentElement?.appendChild(el);
      });
      if (scrim) {
        scrim.style.opacity = String(intro);
      }
      if (titleEl) {
        titleEl.style.opacity = String(S.interpolate(t, [8, 34], [0, 1], clamped));
        titleEl.style.translate = `0px ${S.interpolate(t, [8, 34], [titleSize * 0.4, 0], { ...clamped, easing: outCubic })}px`;
        titleEl.style.filter = `blur(${S.interpolate(t, [8, 30], [8, 0], clamped)}px)`;
      }
      if (subEl) {
        subEl.style.opacity = String(0.65 * S.interpolate(t, [16, 40], [0, 1], clamped));
        subEl.style.translate = `0px ${S.interpolate(t, [16, 40], [titleSize * 0.25, 0], { ...clamped, easing: outCubic })}px`;
      }
      if (btnEl) {
        btnEl.style.opacity = String(S.interpolate(t, [24, 44], [0, 1], clamped));
        btnEl.style.scale = String(S.interpolate(t, [24, 48], [0.7, 1], { ...clamped, easing: outBack }));
      }
      if (footer) {
        footer.style.opacity = String(0.78 * S.interpolate(t, [30, 50], [0, 1], clamped));
      }
    };
  }
};
