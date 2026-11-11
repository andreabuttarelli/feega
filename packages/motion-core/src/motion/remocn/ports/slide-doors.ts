import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'slide-doors',
  title: 'Slide doors',
  about: 'A line of text splits like sliding doors along a track, pushing open to let the next, smaller line grow into place.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 165,
  background: '#0B1F33',
  fonts: ['Plus Jakarta Sans'],
  props: {
    theme: { type: 'string', title: 'Theme', enum: ['dark', 'light'], default: 'dark', group: 'Style' },
    highlight: { type: 'string', title: 'Highlight', default: 'feega.', group: 'Content', maxLength: 40 },
    hold: { type: 'number', title: 'Hold', default: 28, minimum: 0, maximum: 84, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.25, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = view.width;
    const H = view.height;
    const LINES = ['Scenes that move.', 'Code you own.', 'Arriving in your feega.'];
    const DARK_BG = '#0B1F33';
    const THEMES = {
      dark: { bg: DARK_BG, ink: '#E8EEF2', teal: '#00BFA5', track: 'rgba(232,238,242,0.16)' },
      light: { bg: '#E8EEF2', ink: '#0B1F33', teal: '#00A08A', track: 'rgba(11,31,51,0.14)' }
    } as const;
    const SCALE_MIN = 0.58;
    const WEIGHT = 400;
    const TRACK = -0.03;
    const WORD = 0.14;
    const ENTER = 20;
    const CRACK = 8;
    const PUSH = 16;
    const CLEAR = 14;
    const OPEN = CRACK + PUSH + CLEAR;
    const PAD = 0.22;
    const PROBE_PX = 100;
    const FALLBACK_CHAR_EM = 0.52;
    const MIN_HOLD = 8;
    const speed = Number(p.speed);
    const c = THEMES[p.theme === 'light' ? 'light' : 'dark'];
    const face = '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
    const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const easeOut = S.Easing.bezier(0.22, 1, 0.36, 1);
    const easePush = S.Easing.bezier(0.45, 0, 0.35, 1);
    const holdFrames = Math.max(MIN_HOLD, Number(p.hold));
    const step = CRACK + PUSH + holdFrames;
    const openAt = (k: number) => ENTER + holdFrames + k * step;
    const strip = (s: string) => s.replace(/[.,!?;:’'"]+$/u, '');
    const target = strip(String(p.highlight)).toLowerCase();

    view.root.style.background = p.theme === 'light' && p.background === DARK_BG ? c.bg : String(p.background);
    view.root.style.overflow = 'hidden';

    const track = S.h('div', { style: { position: 'absolute', background: c.track } }) as HTMLElement;
    const bar = S.h('div', { style: { position: 'absolute', background: c.teal } }) as HTMLElement;
    const stage = S.h('div', { style: { position: 'absolute', left: 0, width: W } }) as HTMLElement;
    view.root.replaceChildren(track, bar, stage);

    let metrics: { words: string[]; split: number; left: number; right: number; full: number }[] | null = null;
    let parts: { left: HTMLElement; right: HTMLElement; whole: HTMLElement }[] = [];

    const measure = () => {
      const probe = S.h('span', {
        style: { position: 'absolute', left: '-99999px', top: 0, visibility: 'hidden', whiteSpace: 'pre', fontFamily: face, fontWeight: WEIGHT, fontSize: PROBE_PX, lineHeight: 1, letterSpacing: `${TRACK}em`, wordSpacing: `${WORD}em` }
      }) as HTMLElement;
      view.root.appendChild(probe);
      const w = (s: string) => {
        if (!s) {
          return 0;
        }
        probe.textContent = s;
        const measured = probe.getBoundingClientRect().width;
        const px = measured > 0 ? measured : s.length * PROBE_PX * FALLBACK_CHAR_EM;
        return px / PROBE_PX - TRACK;
      };
      const out = LINES.map((line) => {
        const words = line.split(' ').filter(Boolean);
        const full = w(words.join(' '));
        let split = -1;
        let best = Number.POSITIVE_INFINITY;
        for (let k = 0; k < words.length - 1; k++) {
          const d = Math.abs(w(words.slice(0, k + 1).join(' ')) - full / 2);
          if (d < best) {
            best = d;
            split = k;
          }
        }
        const left = split >= 0 ? w(words.slice(0, split + 1).join(' ')) : full;
        const right = split >= 0 ? w(words.slice(split + 1).join(' ')) : 0;
        return { words, split, left, right, full };
      });
      probe.remove();
      return out;
    };

    const portrait = H > W * 1.1;
    const minDim = Math.min(W, H);
    const cx = W / 2;
    let F = 0;
    let lineH = 0;
    let trackY = 0;
    let pad = 0;
    let far = 0;
    let stroke = 0;

    const build = () => {
      metrics = measure();
      const widest = Math.max(...metrics.map((l) => l.full), 0.1);
      F = Math.min((W * (portrait ? 0.86 : 0.8)) / widest, H * (portrait ? 0.075 : 0.14));
      lineH = F * 1.25;
      trackY = H * (portrait ? 0.7 : 0.74);
      pad = PAD * F;
      far = W * 0.62;
      stroke = Math.max(1.5, minDim * 0.0026);
      stage.style.top = `${trackY - lineH - F * 0.12}px`;
      stage.style.height = `${lineH}px`;
      track.style.top = `${trackY}px`;
      track.style.height = `${stroke}px`;
      bar.style.top = `${trackY - stroke * 0.5}px`;
      bar.style.height = `${stroke * 2}px`;

      const last = LINES.length - 1;
      const textEl = (k: number, words: string[]) =>
        S.h(
          'div',
          { style: { position: 'absolute', top: 0, height: lineH, lineHeight: `${lineH}px`, whiteSpace: 'pre', fontFamily: face, fontWeight: WEIGHT, fontSize: F, letterSpacing: `${TRACK}em`, wordSpacing: `${WORD}em`, color: c.ink, display: 'none' } },
          words.map((word, i) => S.h('span', { style: k === last && target && strip(word).toLowerCase() === target ? { color: c.teal } : {} }, word + (i < words.length - 1 ? ' ' : '')))
        ) as HTMLElement;

      parts = metrics.map((l, k) => {
        const leftWords = l.split >= 0 ? l.words.slice(0, l.split + 1) : l.words;
        const rightWords = l.split >= 0 ? l.words.slice(l.split + 1) : [];
        return { left: textEl(k, leftWords), right: textEl(k, rightWords), whole: textEl(k, l.words) };
      });
      parts.forEach((pt) => stage.append(pt.left, pt.right, pt.whole));
    };

    const hide = (el: HTMLElement) => {
      el.style.display = 'none';
    };

    return (at) => {
      if (!metrics) {
        build();
      }
      const m = metrics!;
      const t = at * speed;
      parts.forEach((pt) => {
        hide(pt.left);
        hide(pt.right);
        hide(pt.whole);
      });

      let cur = 0;
      for (let k = 0; k < LINES.length - 1; k++) {
        if (t >= openAt(k)) {
          cur = k + 1;
        }
      }
      const opening = cur > 0 && t < openAt(cur - 1) + OPEN;
      const out = opening ? cur - 1 : -1;

      const doors = (k: number, dl: number, dr: number) => {
        const l = m[k];
        const x0 = cx - (l.full * F) / 2;
        parts[k].left.style.display = 'block';
        parts[k].left.style.left = `${x0}px`;
        parts[k].left.style.transform = `translateX(${-dl}px)`;
        if (l.split < 0) {
          return;
        }
        parts[k].right.style.display = 'block';
        parts[k].right.style.left = `${x0 + (l.full - l.right) * F}px`;
        parts[k].right.style.transform = `translateX(${dr}px)`;
      };

      const trackIn = S.interpolate(t, [0, ENTER], [0, 1], { ...clamp, easing: easeOut });
      const halfW = (W / 2) * trackIn;
      track.style.left = `${cx - halfW}px`;
      track.style.width = `${halfW * 2}px`;
      bar.style.display = 'none';

      if (t < ENTER || (cur === 0 && !opening)) {
        const q = S.interpolate(t, [0, ENTER], [0, 1], { ...clamp, easing: easeOut });
        doors(0, (1 - q) * far, (1 - q) * far);
        return;
      }

      if (!opening) {
        const l = m[cur];
        const whole = parts[cur].whole;
        whole.style.display = 'block';
        whole.style.left = `${cx - (l.full * F) / 2}px`;
        whole.style.transform = 'none';
        whole.style.opacity = '1';
        return;
      }

      const tau = t - openAt(out);
      const lo = m[out];
      const ln = m[cur];
      const x0 = cx - (lo.full * F) / 2;
      const edgeL = x0 + lo.left * F;
      const edgeR = lo.split >= 0 ? x0 + (lo.full - lo.right) * F : edgeL;
      const g0 = edgeR - edgeL;
      const gCrack = ln.full * SCALE_MIN * F + 2 * pad;
      const gRest = ln.full * F + 2 * pad;
      const push = S.interpolate(tau, [CRACK, CRACK + PUSH], [0, 1], { ...clamp, easing: easePush });
      const s = SCALE_MIN + (1 - SCALE_MIN) * push;
      const nw = ln.full * s * F;
      let gapW: number;
      if (tau < CRACK) {
        const k = S.interpolate(tau, [0, CRACK], [0, 1], { ...clamp, easing: easeOut });
        gapW = g0 + (Math.max(gCrack, g0) - g0) * k;
      } else {
        const after = Math.max(0, tau - CRACK - PUSH);
        gapW = Math.max(nw + 2 * pad, g0) + 2 * (F * 0.04 * after * after);
      }
      const centre0 = (edgeL + edgeR) / 2;
      const drift = S.interpolate(gapW, [g0, Math.max(g0 + 1, gRest)], [0, 1], clamp);
      const centre = centre0 + (cx - centre0) * drift;
      const dl = edgeL - (centre - gapW / 2);
      const dr = centre + gapW / 2 - edgeR;
      const fits = S.interpolate(gapW - ln.full * SCALE_MIN * F - pad, [0, pad], [0, 1], clamp);
      const gapL = centre - gapW / 2;
      const gapR = centre + gapW / 2;

      doors(out, dl, dr);
      const whole = parts[cur].whole;
      whole.style.display = 'block';
      whole.style.left = `${centre - (ln.full * F) / 2}px`;
      whole.style.transformOrigin = `${(ln.full * F) / 2}px ${lineH * 0.7}px`;
      whole.style.transform = `scale(${s})`;
      whole.style.opacity = String(fits);

      bar.style.display = 'block';
      bar.style.left = `${Math.max(0, gapL)}px`;
      bar.style.width = `${Math.max(0, Math.min(W, gapR) - Math.max(0, gapL))}px`;
    };
  }
};
