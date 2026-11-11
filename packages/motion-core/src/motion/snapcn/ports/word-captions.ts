import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'word-captions',
  title: 'Word captions',
  about: 'Social-style captions that page through the script word by word, with boxed, YouTube, Beast, Hormozi, pop and clean looks.',
  category: SnapcnCategory.Caption,
  width: 1080,
  height: 1920,
  fps: 30,
  frames: 96,
  background: '#0a0a0b',
  fonts: ['Montserrat', 'Roboto'],
  props: {
    words: { type: 'string', title: 'Script', default: 'Stop losing hours to manual invoices', group: 'Content', maxLength: 2000 },
    srt: { type: 'string', title: 'SRT (overrides script)', default: '', group: 'Content', maxLength: 2000 },
    preset: { type: 'string', title: 'Look', enum: ['boxed', 'youtube', 'beast', 'hormozi', 'pop', 'clean'], default: 'boxed', group: 'Style' },
    activeStyle: { type: 'string', title: 'Active word', enum: ['pop', 'highlight', 'color'], default: 'pop', group: 'Style' },
    aspect: { type: 'string', title: 'Safe area', enum: ['16:9', '1:1', '9:16'], default: '16:9', group: 'Layout' },
    framesPerWord: { type: 'number', title: 'Frames per word', default: 14, minimum: 1, maximum: 120, step: 1, group: 'Motion' },
    pageBreakMs: { type: 'number', title: 'Page break gap (ms)', default: 420, minimum: 0, maximum: 5000, step: 10, group: 'Motion' },
    groupSize: { type: 'number', title: 'Fixed group size (0 = pages)', default: 0, minimum: 0, maximum: 3, step: 1, group: 'Layout' },
    maxWords: { type: 'number', title: 'Max words per page (0 = look)', default: 0, minimum: 0, maximum: 20, step: 1, group: 'Layout' },
    maxChars: { type: 'number', title: 'Max chars per page (0 = look)', default: 0, minimum: 0, maximum: 120, step: 1, group: 'Layout' },
    maxWidth: { type: 'number', title: 'Max width px (0 = 86%)', default: 0, minimum: 0, maximum: 4000, step: 1, group: 'Layout' },
    fontSize: { type: 'number', title: 'Font size px (0 = look)', default: 0, minimum: 0, maximum: 400, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight (0 = look)', default: 0, minimum: 0, maximum: 900, step: 100, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Montserrat', group: 'Style' },
    uppercase: { type: 'string', title: 'Uppercase', enum: ['look', 'on', 'off'], default: 'look', group: 'Style' },
    textColor: { type: 'string', title: 'Text (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    pillColor: { type: 'string', title: 'Pill (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent', format: PropFormat.Color, default: '#FFE81F', group: 'Style' },
    accentCycle: { type: 'string', title: 'Hormozi accents (comma list)', default: '#27E36B, #FFE81F, #FF4D4D, #3EA8FF', group: 'Style', maxLength: 300 },
    strokeColor: { type: 'string', title: 'Stroke', format: PropFormat.Color, default: '#000000', group: 'Style' },
    strokeRatio: { type: 'number', title: 'Stroke ratio (-1 = look)', default: -1, minimum: -1, maximum: 0.5, step: 0.005, group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'dark', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const num = (k: string) => Number(p[k]) || 0;
    const t = S.themeOf(String(p.mode));
    const { fps, width, height } = view;
    const LOOKS: Record<string, { weight: number; uppercase: boolean; maxWords: number; maxChars: number; sizeRatio: number; strokeRatio: number; tracking: string; pop: number; block: boolean; pill: boolean; shadow: boolean; box?: boolean }> = {
      boxed: { weight: 700, uppercase: false, maxWords: 7, maxChars: 28, sizeRatio: 0.062, strokeRatio: 0, tracking: '-0.005em', pop: 1, block: false, pill: false, shadow: false, box: true },
      youtube: { weight: 800, uppercase: false, maxWords: 6, maxChars: 26, sizeRatio: 0.075, strokeRatio: 0.075, tracking: '-0.015em', pop: 1.07, block: false, pill: false, shadow: true },
      beast: { weight: 900, uppercase: true, maxWords: 3, maxChars: 16, sizeRatio: 0.125, strokeRatio: 0.1, tracking: '-0.005em', pop: 1.14, block: false, pill: false, shadow: true },
      hormozi: { weight: 800, uppercase: true, maxWords: 3, maxChars: 14, sizeRatio: 0.115, strokeRatio: 0.085, tracking: '-0.005em', pop: 1.06, block: true, pill: false, shadow: true },
      pop: { weight: 800, uppercase: false, maxWords: 4, maxChars: 22, sizeRatio: 0.11, strokeRatio: 0.07, tracking: '-0.015em', pop: 1.12, block: false, pill: false, shadow: true },
      clean: { weight: 700, uppercase: false, maxWords: 8, maxChars: 42, sizeRatio: 0.06, strokeRatio: 0, tracking: '-0.01em', pop: 1.06, block: false, pill: true, shadow: false }
    };
    const SAFE: Record<string, number> = { '16:9': 8, '1:1': 11, '9:16': 20 };
    const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    type Word = { text: string; startFrame: number; endFrame: number };
    type Group = { words: Word[]; startFrame: number; endFrame: number };

    const face = S.pick(p.fontFamily, 'Montserrat');
    const ink = S.pick(p.textColor, String(t.foreground));
    const pillPicked = S.pick(p.pillColor, '');
    const scrim = pillPicked || S.withAlpha(String(t.background), 0.55);
    const look = LOOKS[String(p.preset)] ?? LOOKS.beast;
    const size = num('fontSize') > 0 ? num('fontSize') : Math.round(look.sizeRatio * Math.min(width, height));
    const weight = num('fontWeight') > 0 ? num('fontWeight') : look.weight;
    const stroke = (num('strokeRatio') >= 0 && p.strokeRatio !== undefined ? num('strokeRatio') : look.strokeRatio) * size;
    const caps = p.uppercase === 'on' ? true : p.uppercase === 'off' ? false : look.uppercase;
    const block = num('maxWidth') > 0 ? num('maxWidth') : Math.round(width * 0.86);
    const framesPerWord = num('framesPerWord') || 14;
    const accentCycle = String(p.accentCycle ?? '').split(',').map((c) => c.trim()).filter(Boolean);
    const strokeColor = S.pick(p.strokeColor, '#000000');

    const srtMs = (stamp: string) => {
      const m = stamp.trim().match(/^(?:(\d+):)?(\d+):(\d+)[,.](\d{1,3})$/);
      if (!m) {
        return null;
      }
      return (m[1] ? Number(m[1]) : 0) * 3600000 + Number(m[2]) * 60000 + Number(m[3]) * 1000 + Number(m[4] + '000'.slice(m[4].length));
    };
    const parseSrt = (srt: string) =>
      srt.replace(/\r/g, '').trim().split(/\n\s*\n/).flatMap((raw) => {
        const lines = raw.split('\n').filter((l) => l.trim().length > 0);
        const timeLine = lines.find((l) => l.includes('-->'));
        if (!timeLine) {
          return [];
        }
        const [from, to] = timeLine.split('-->');
        const startMs = srtMs(from);
        const endMs = srtMs(to);
        const text = lines.filter((l) => l !== timeLine && !/^\d+$/.test(l.trim())).join(' ').trim();
        return startMs === null || endMs === null || !text ? [] : [{ text, startMs, endMs }];
      });
    const fromCaptions = (caps: { text: string; startMs: number; endMs: number }[]): Word[] =>
      caps.flatMap((c) => {
        const ws = c.text.split(/\s+/).filter(Boolean);
        const per = Math.max(1, c.endMs - c.startMs) / Math.max(1, ws.length);
        const parts = ws.length <= 1 ? [c] : ws.map((text, i) => ({ text, startMs: c.startMs + i * per, endMs: c.startMs + (i + 1) * per }));
        return parts.map((w) => ({ text: w.text, startFrame: (w.startMs / 1000) * fps, endFrame: Math.max((w.endMs / 1000) * fps, (w.startMs / 1000) * fps + 1) }));
      });
    const scheduled = (): Word[] =>
      String(p.words).split(/\s+/).filter(Boolean).map((text, i) => ({ text, startFrame: i * framesPerWord, endFrame: Math.max((i + 1) * framesPerWord, i * framesPerWord + 1) }));
    const srt = String(p.srt ?? '');
    const timed = srt.trim() ? fromCaptions(parseSrt(srt)) : scheduled();

    const pages = (): Group[] => {
      const out: Group[] = [];
      let current: Word[] = [];
      let chars = 0;
      const maxWords = Math.max(1, num('maxWords') || look.maxWords);
      const maxChars = Math.max(1, num('maxChars') || look.maxChars);
      const maxGap = ((Number(p.pageBreakMs) || 0) / 1000) * fps;
      const flush = () => {
        if (current.length) {
          out.push({ words: current, startFrame: current[0].startFrame, endFrame: current[current.length - 1].endFrame });
        }
        current = [];
        chars = 0;
      };
      timed.forEach((word) => {
        const prev = current[current.length - 1];
        const gap = prev ? word.startFrame - prev.endFrame : 0;
        if (prev && (current.length >= maxWords || chars + word.text.length + 1 > maxChars || gap > maxGap)) {
          flush();
        }
        current.push(word);
        chars += word.text.length + 1;
      });
      flush();
      return out;
    };
    const fixed = (size: number): Group[] => {
      const out: Group[] = [];
      for (let i = 0; i < timed.length; i += size) {
        const chunk = timed.slice(i, i + size);
        out.push({ words: chunk, startFrame: chunk[0].startFrame, endFrame: chunk[chunk.length - 1].endFrame });
      }
      return out;
    };
    const groups = num('groupSize') > 0 ? fixed(Math.min(3, Math.max(1, Math.floor(num('groupSize'))))) : pages();

    const lineHeight = Math.round(size * 1.14);
    const typeStyle = { fontFamily: face, fontWeight: weight, fontSize: size, lineHeight: `${lineHeight}px`, letterSpacing: look.tracking, textRendering: 'geometricPrecision', fontVariantLigatures: 'none' };
    const outline = stroke > 0 ? { WebkitTextStrokeWidth: `${stroke}px`, WebkitTextStrokeColor: strokeColor, paintOrder: 'stroke fill' } : {};
    const shadow = look.shadow ? { textShadow: `0 ${size * 0.055}px ${size * 0.05}px ${S.withAlpha(String(t.background), 0.42)}` } : {};

    const base = S.h('span', { style: { display: 'inline-block', width: 0, height: 0 } }) as HTMLElement;
    const probe = S.h('span', { style: { ...typeStyle, position: 'absolute', left: -99999, top: 0, visibility: 'hidden', display: 'inline-block' } }, 'Hg', base) as HTMLElement;
    const host = S.h('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: `${SAFE[String(p.aspect)] ?? SAFE['9:16']}%`, paddingLeft: '5%', paddingRight: '5%', pointerEvents: 'none' } }, probe) as HTMLElement;
    const link = S.h('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Roboto:wght@500;700&display=block' });
    const warm = S.h('span', { style: { position: 'absolute', left: -99999, fontFamily: 'Roboto', fontWeight: weight } }, 'Hg');
    view.root.replaceChildren(link, warm, host);

    const popScale = (frame: number, start: number) => 1 + (look.pop - 1) * S.spring({ frame: frame - start, fps, config: { damping: 11, stiffness: 190, mass: 0.7 }, durationInFrames: 14 });
    const caseOf = (s: string) => (caps ? s.toUpperCase() : s);

    const boxed = (group: Group, frame: number) =>
      S.h('div', { style: { maxWidth: block, textAlign: 'center', opacity: S.interpolate(frame - group.startFrame, [0, 3], [0, 1], CLAMP) } },
        S.h('span', { style: { ...typeStyle, fontFamily: 'Roboto', display: 'inline', color: ink, backgroundColor: S.withAlpha(String(t.background), 0.9), padding: `${size * 0.06}px ${size * 0.32}px`, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', lineHeight: `${Math.round(size * 1.46)}px`, borderRadius: 2 } }, group.words.map((w) => caseOf(w.text)).join(' ')));

    const flow = (group: Group, frame: number, groupIdx: number, baselineY: number) => {
      const accent = look.block && accentCycle.length > 0 ? accentCycle[Math.max(0, groupIdx) % accentCycle.length] : S.pick(p.accentColor, '#FFE81F');
      const pill = look.pill ? { padding: `${size * 0.3}px ${size * 0.5}px`, borderRadius: size * 0.22, backgroundColor: scrim } : {};
      const spans = group.words.map((word) => {
        const isActive = frame >= word.startFrame && frame < word.endFrame;
        const scale = isActive && p.activeStyle === 'pop' ? popScale(frame, word.startFrame) : 1;
        const useAccent = isActive && p.activeStyle !== 'pop';
        const fill = look.block ? ink : isActive ? accent : ink;
        const chip = look.block && isActive ? { backgroundColor: accent, borderRadius: size * 0.12, padding: `0 ${size * 0.1}px`, WebkitTextStrokeWidth: `${stroke * 0.6}px` } : {};
        return S.h('span', { style: { ...typeStyle, ...outline, ...shadow, display: 'inline-block', color: useAccent ? accent : fill, transform: `scale(${scale})`, transformOrigin: `50% ${baselineY}px`, ...chip } }, caseOf(word.text));
      });
      return S.h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'center', columnGap: size * 0.26, rowGap: size * 0.04, maxWidth: block, textAlign: 'center', ...pill, opacity: S.interpolate(frame - group.startFrame, [0, 3], [0, 1], CLAMP) } }, spans);
    };

    return (at) => {
      const frame = at * (Number(p.speed) || 1);
      let groupIdx = -1;
      for (let i = groups.length - 1; i >= 0; i--) {
        if (frame >= groups[i].startFrame && frame < groups[i].endFrame) {
          groupIdx = i;
          break;
        }
      }
      const group = groupIdx === -1 ? null : groups[groupIdx];
      const baselineY = base.getBoundingClientRect().top - probe.getBoundingClientRect().top;
      const body = group === null ? null : look.box ? boxed(group, frame) : flow(group, frame, groupIdx, baselineY);
      host.replaceChildren(probe, ...(body ? [body] : []));
    };
  }
};
