import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'karaoke-captions',
  title: 'Karaoke captions',
  about: 'Captions that fill word by word as they are spoken: boxed, karaoke, highlight bar or clean pill looks. Fills a line; Word captions pages word by word.',
  category: SnapcnCategory.Caption,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#0a0a0b',
  fonts: ['Montserrat', 'Roboto'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Acme reconciles every transaction automatically', group: 'Content', maxLength: 400 },
    emphasize: { type: 'string', title: 'Emphasised words (comma separated)', default: 'automatically', group: 'Content', maxLength: 200 },
    srt: { type: 'string', title: 'SRT captions (overrides text)', default: '', group: 'Content', maxLength: 2000 },
    preset: { type: 'string', title: 'Look', enum: ['boxed', 'karaoke', 'highlight', 'clean'], default: 'boxed', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Montserrat', group: 'Style' },
    boxFont: { type: 'string', title: 'Boxed look font', format: PropFormat.Font, default: 'Roboto', group: 'Style' },
    fontSize: { type: 'number', title: 'Font size (px, 0 = auto)', default: 0, minimum: 0, maximum: 300, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight (0 = look)', default: 0, minimum: 0, maximum: 900, step: 100, group: 'Style' },
    uppercase: { type: 'string', title: 'Uppercase', enum: ['auto', 'on', 'off'], default: 'auto', group: 'Style' },
    pill: { type: 'string', title: 'Pill', enum: ['auto', 'on', 'off'], default: 'auto', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'dark', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent', format: PropFormat.Color, default: '#FFE81F', group: 'Style' },
    baseColor: { type: 'string', title: 'Unspoken (transparent = look)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    fillColor: { type: 'string', title: 'Spoken (transparent = look)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    strokeColor: { type: 'string', title: 'Outline', format: PropFormat.Color, default: '#000000', group: 'Style' },
    strokeRatio: { type: 'number', title: 'Outline ratio (-1 = look)', default: -1, minimum: -1, maximum: 0.5, step: 0.01, group: 'Style' },
    aspect: { type: 'string', title: 'Safe area', enum: ['landscape', 'portrait', 'square'], default: 'landscape', group: 'Style' },
    emphasisScale: { type: 'number', title: 'Emphasis scale', default: 1.08, minimum: 1, maximum: 2, step: 0.01, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const { width, height, fps, frames } = view;
    const FADE = 8;
    const LOOKS: Record<string, { weight: number; uppercase: boolean; sizeRatio: number; strokeRatio: number; bar: boolean; pill: boolean; shadow: boolean; box?: boolean }> = {
      boxed: { weight: 700, uppercase: false, sizeRatio: 0.062, strokeRatio: 0, bar: false, pill: false, shadow: false, box: true },
      karaoke: { weight: 900, uppercase: true, sizeRatio: 0.085, strokeRatio: 0.09, bar: false, pill: false, shadow: true },
      highlight: { weight: 800, uppercase: false, sizeRatio: 0.08, strokeRatio: 0.07, bar: true, pill: false, shadow: true },
      clean: { weight: 600, uppercase: false, sizeRatio: 0.067, strokeRatio: 0, bar: false, pill: true, shadow: false }
    };
    const SAFE: Record<string, { bottom: string; horizontal: string }> = {
      landscape: { bottom: '8%', horizontal: '10%' },
      portrait: { bottom: '18%', horizontal: '7%' },
      square: { bottom: '10%', horizontal: '8%' }
    };
    const TRI: Record<string, boolean | undefined> = { auto: undefined, on: true, off: false };
    const look = LOOKS[String(p.preset)] ?? LOOKS.karaoke;
    const safe = SAFE[String(p.aspect)] ?? SAFE.landscape;
    const face = S.pick(p.fontFamily, 'Montserrat');
    const boxFace = S.pick(p.boxFont, 'Roboto');
    const accent = String(p.accentColor);
    const speed = Number(p.speed);
    const emphasisScale = Number(p.emphasisScale);
    const size = Number(p.fontSize) > 0 ? Number(p.fontSize) : Math.round(look.sizeRatio * Math.min(width, height));
    const weight = Number(p.fontWeight) > 0 ? Number(p.fontWeight) : look.weight;
    const stroke = (Number(p.strokeRatio) >= 0 ? Number(p.strokeRatio) : look.strokeRatio) * size;
    const caps = TRI[String(p.uppercase)] ?? look.uppercase;
    const showPill = TRI[String(p.pill)] ?? look.pill;
    const unfilled = S.pick(p.baseColor, look.pill ? String(t.mutedForeground) : 'rgba(255,255,255,0.45)');
    const filled = S.pick(p.fillColor, look.pill ? String(t.foreground) : '#FFFFFF');
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const CUBIC_OUT = S.Easing.out(S.Easing.cubic);

    const splitWords = (s: string) => s.split(/\s+/).filter((w) => w.length > 0);
    const strip = (w: string) => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    const emphasisIndices = (s: string, list: string) => {
      const targets = list.split(',').map((w) => w.trim().toLowerCase()).filter((w) => w.length > 0);
      return splitWords(s).map((w, i) => (targets.indexOf(strip(w)) !== -1 ? i : -1)).filter((i) => i >= 0);
    };
    type Line = { text: string; startFrame: number; endFrame: number; wordTimings?: number[]; emphasize?: number[] };
    const srtMs = (stamp: string) => {
      const m = stamp.trim().match(/^(?:(\d+):)?(\d+):(\d+)[,.](\d{1,3})$/);
      if (!m) {
        return null;
      }
      return (m[1] ? Number(m[1]) : 0) * 3600000 + Number(m[2]) * 60000 + Number(m[3]) * 1000 + Number(m[4] + '000'.slice(m[4].length));
    };
    const parseSrt = (srt: string) => {
      const cues: { text: string; startMs: number; endMs: number }[] = [];
      for (const raw of srt.replace(/\r/g, '').trim().split(/\n\s*\n/)) {
        const rows = raw.split('\n').filter((l) => l.trim().length > 0);
        const timeLine = rows.find((l) => l.includes('-->'));
        if (!timeLine) {
          continue;
        }
        const [a, b] = timeLine.split('-->').map((x) => x.trim());
        const startMs = srtMs(a);
        const endMs = srtMs(b);
        if (startMs === null || endMs === null) {
          continue;
        }
        const text = rows.filter((l) => l !== timeLine && !/^\d+$/.test(l.trim())).join(' ').trim();
        if (text) {
          cues.push({ text, startMs, endMs });
        }
      }
      return cues;
    };
    const fromCues = (cues: { text: string; startMs: number; endMs: number }[]): Line[] => {
      const toFrame = (ms: number) => (ms / 1000) * fps;
      const groups: (typeof cues)[] = [];
      let current: typeof cues = [];
      for (const c of cues) {
        const prev = current[current.length - 1];
        if (prev && c.startMs - prev.endMs > 1200) {
          groups.push(current);
          current = [];
        }
        current.push(c);
      }
      if (current.length) {
        groups.push(current);
      }
      return groups.map((group) => {
        const timings: number[] = [];
        for (const c of group) {
          const parts = c.text.split(/\s+/).filter(Boolean);
          const per = Math.max(1, c.endMs - c.startMs) / Math.max(1, parts.length);
          parts.forEach((_, i) => timings.push(toFrame(c.startMs + i * per)));
        }
        const startMs = group[0].startMs;
        return { text: group.flatMap((c) => c.text.split(/\s+/).filter(Boolean)).join(' '), startFrame: toFrame(startMs), endFrame: Math.max(toFrame(group[group.length - 1].endMs), toFrame(startMs) + 1), wordTimings: timings };
      });
    };
    const windowsOf = (line: Line) => {
      const n = splitWords(line.text).length;
      const wt = line.wordTimings;
      if (wt && wt.length > 0) {
        return Array.from({ length: n }, (_, i) => {
          const start = wt[i] ?? wt[wt.length - 1];
          return { start, end: Math.max(wt[i + 1] ?? line.endFrame, start + 1) };
        });
      }
      const step = (line.endFrame - line.startFrame) / n;
      return Array.from({ length: n }, (_, i) => ({ start: line.startFrame + step * i, end: line.startFrame + step * (i + 1) }));
    };
    const progressOf = (f: number, w: { start: number; end: number }) => (w.end <= w.start ? (f >= w.end ? 1 : 0) : Math.min(1, Math.max(0, (f - w.start) / (w.end - w.start))));

    const srt = String(p.srt ?? '');
    const cues = srt.trim() ? parseSrt(srt) : [];
    const text = String(p.text);
    const lines: Line[] = cues.length ? fromCues(cues) : [{ text, startFrame: 10, endFrame: Math.max(Math.max(11, frames - 24), 11), emphasize: emphasisIndices(text, String(p.emphasize)) }];
    const activeIndex = (f: number) => {
      let active = -1;
      lines.forEach((l, i) => {
        if (f >= l.startFrame && f < l.endFrame + FADE) {
          active = i;
        }
      });
      return active;
    };

    const typeStyle = { fontFamily: face, fontWeight: weight, fontSize: size, lineHeight: `${Math.round(size * 1.2)}px`, letterSpacing: caps ? '-0.005em' : '-0.015em', textRendering: 'geometricPrecision', fontVariantLigatures: 'none', fontOpticalSizing: 'none' };
    const outline = stroke > 0 ? { WebkitTextStrokeWidth: `${stroke}px`, WebkitTextStrokeColor: String(p.strokeColor), paintOrder: 'stroke fill' } : {};
    const shadow = look.shadow ? { textShadow: `0 ${size * 0.05}px ${size * 0.045}px rgba(0,0,0,0.42)` } : {};
    const baseMark = S.h('span', { style: { display: 'inline-block', width: 0, height: 0 } }) as HTMLElement;
    const probe = S.h('span', { style: { ...typeStyle, position: 'absolute', left: -99999, top: 0, visibility: 'hidden', display: 'inline-block' } }, 'Hg', baseMark) as HTMLElement;
    const stage = S.h('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: safe.bottom, paddingLeft: safe.horizontal, paddingRight: safe.horizontal, pointerEvents: 'none' } }) as HTMLElement;
    view.root.replaceChildren(S.h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } }, probe), stage);

    const build = (line: Line) => {
      if (look.box) {
        const box = S.h('div', { style: { maxWidth: Math.round(width * 0.82), textAlign: 'center' } }, S.h('span', { style: { ...typeStyle, fontFamily: boxFace, display: 'inline', color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.9)', padding: `${size * 0.06}px ${size * 0.32}px`, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', lineHeight: `${Math.round(size * 1.46)}px`, borderRadius: 2 } }, caps ? line.text.toUpperCase() : line.text)) as HTMLElement;
        return { root: box, words: [] as HTMLElement[] };
      }
      const pillStyle = showPill ? { padding: `${size * 0.3}px ${size * 0.55}px`, borderRadius: size * 0.24, background: S.withAlpha(String(t.card), 0.92), border: `1px solid ${t.border}`, boxShadow: `0 8px 24px ${S.withAlpha(String(t.foreground), 0.1)}` } : {};
      const words = splitWords(line.text).map((w) => S.h('span', { style: { ...typeStyle, ...outline, ...shadow, display: 'inline-block' } }, caps ? w.toUpperCase() : w) as HTMLElement);
      const row = S.h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'center', columnGap: size * 0.28, rowGap: size * 0.06, textAlign: 'center', ...pillStyle } }, words) as HTMLElement;
      return { root: row, words };
    };
    let shown = -1;
    let built = build(lines[0]);

    return (at) => {
      const frame = at * speed;
      const index = activeIndex(frame);
      if (index !== shown) {
        shown = index;
        stage.replaceChildren();
        if (index >= 0) {
          built = build(lines[index]);
          stage.appendChild(built.root);
        }
      }
      if (index < 0) {
        return;
      }
      const line = lines[index];
      const enter = S.interpolate(frame - line.startFrame, [0, FADE], [0, 1], clamped);
      const exit = S.interpolate(frame - line.endFrame, [0, FADE], [1, 0], clamped);
      built.root.style.opacity = String(Math.min(enter, exit));
      const windows = windowsOf(line);
      const emphasized = new Set(line.emphasize ?? []);
      const baselineY = baseMark.getBoundingClientRect().top - probe.getBoundingClientRect().top;
      built.words.forEach((el, i) => {
        const progress = progressOf(frame, windows[i]);
        const spoken = progress >= 0.999;
        const isEm = emphasized.has(i);
        const scale = isEm ? S.interpolate(progress, [0, 1], [1, emphasisScale], { ...clamped, easing: CUBIC_OUT }) : 1;
        const onBar = look.bar && spoken;
        el.style.color = look.bar ? (spoken ? '#0B0B0C' : unfilled) : isEm && spoken ? accent : spoken ? filled : unfilled;
        el.style.transform = `scale(${scale})`;
        el.style.transformOrigin = `50% ${baselineY}px`;
        el.style.background = onBar ? accent : '';
        el.style.borderRadius = onBar ? `${size * 0.14}px` : '';
        el.style.padding = onBar ? `0 ${size * 0.11}px` : '';
        el.style.webkitTextStrokeWidth = onBar ? '0' : stroke > 0 ? `${stroke}px` : '';
      });
    };
  }
};
