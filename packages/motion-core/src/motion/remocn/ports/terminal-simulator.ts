import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'terminal-simulator',
  title: 'Terminal simulator',
  about: 'A terminal window types a build command and streams colour-coded log lines in bursts.',
  category: SnapcnCategory.Screen,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 240,
  background: '#050505',
  fonts: ['Geist Mono'],
  props: {
    prompt: { type: 'string', title: 'Prompt', default: '$', group: 'Content', maxLength: 8 },
    title: { type: 'string', title: 'Title', default: '~/projects/feega', group: 'Content', maxLength: 60 },
    windowColor: { type: 'string', title: 'Window colour', format: PropFormat.Color, default: '#0a0a0a', group: 'Style' },
    chromeColor: { type: 'string', title: 'Chrome colour', format: PropFormat.Color, default: '#1a1a1a', group: 'Style' },
    fontSize: { type: 'number', title: 'Font size', default: 18, minimum: 10, maximum: 32, step: 1, group: 'Style' },
    charsPerFrame: { type: 'number', title: 'Chars / frame', default: 1, minimum: 0.25, maximum: 6, step: 0.25, group: 'Motion' },
    chunkSize: { type: 'number', title: 'Chunk size', default: 1, minimum: 1, maximum: 20, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const fontSize = Number(p.fontSize);
    const charsPerFrame = Number(p.charsPerFrame);
    const chunkSize = Number(p.chunkSize);
    const speed = Number(p.speed);
    const LINES = [
      { text: 'npm run build', type: 'command', delay: 0 },
      { text: 'Resolving dependencies...', type: 'log', delay: 6 },
      { text: '> feega@1.0.0 build', type: 'log', delay: 4 },
      { text: '> next build', type: 'log', delay: 4 },
      { text: 'Compiling...', type: 'log', delay: 12 },
      { text: 'Compiled successfully in 4.2s', type: 'success', delay: 14 },
      { text: 'Generating static pages (24/24)', type: 'log', delay: 10 },
      { text: 'Build completed without errors', type: 'success', delay: 12 }
    ];
    const COLORS: Record<string, string> = { command: '#fafafa', log: '#a1a1aa', success: '#22c55e', error: '#ef4444' };
    const VISIBLE_LINES = 8;
    const START_OFFSET = 10;
    const DEFAULT_DELAY = 8;
    const AUTO_PAUSE = 18;
    const WINDOW_W = 900;
    const WINDOW_H = 480;
    const lineHeight = Math.round(fontSize * 1.6);

    const starts: number[] = [];
    let acc = START_OFFSET;
    LINES.forEach((line) => {
      acc += line.delay ?? DEFAULT_DELAY;
      starts.push(acc);
      acc += Math.ceil(line.text.length / (chunkSize * charsPerFrame)) + (line.text.trimEnd().endsWith('...') ? AUTO_PAUSE : 0);
    });

    const light = (color: string) => S.h('div', { style: { width: 12, height: 12, borderRadius: '50%', background: color, opacity: 0.85 } });
    const rows = LINES.map((line) => {
      const promptEl = line.type === 'command' ? S.h('span', { style: { color: '#22c55e', marginRight: 8 } }, String(p.prompt)) : null;
      const textEl = S.h('span') as HTMLElement;
      const cursor = S.h('span', { style: { display: 'inline-block', width: fontSize * 0.55, height: fontSize, background: COLORS[line.type], marginLeft: 2 } }) as HTMLElement;
      const row = S.h('div', { style: { height: lineHeight, fontSize, color: COLORS[line.type], display: 'none', alignItems: 'center', whiteSpace: 'pre' } }, promptEl, textEl, cursor) as HTMLElement;
      return { row, textEl, cursor, text: line.text };
    });
    const buffer = S.h('div', { style: { position: 'absolute', left: 20, right: 20, top: 20 } }, rows.map((r) => r.row)) as HTMLElement;
    const chrome = S.h('div', { style: { height: 40, background: String(p.chromeColor), display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' } },
      light('#ff5f57'), light('#febc2e'), light('#28c840'),
      S.h('div', { style: { flex: 1, textAlign: 'center', color: '#71717a', fontSize: 13 } }, String(p.title)));
    const body = S.h('div', { style: { flex: 1, padding: 20, overflow: 'hidden', position: 'relative' } }, buffer);
    const win = S.h('div', { style: { width: WINDOW_W, height: WINDOW_H, background: String(p.windowColor), borderRadius: 12, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', fontFamily: "'Geist Mono', ui-monospace, SFMono-Regular, monospace" } }, chrome, body);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, win));

    return (at) => {
      const frame = at * speed;
      let scroll = 0;
      for (let i = VISIBLE_LINES; i < LINES.length; i++) {
        if (frame >= starts[i]) {
          scroll -= lineHeight;
        }
      }
      buffer.style.translate = `0 ${scroll}px`;

      rows.forEach((r, i) => {
        const from = Math.round(starts[i] / speed);
        r.row.style.display = at >= from ? 'flex' : 'none';
        if (at < from) {
          return;
        }
        const local = (at - from) * speed;
        const total = r.text.length;
        const linear = Math.floor(S.interpolate(local, [0, total / charsPerFrame], [0, total], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
        const revealed = Math.min(total, Math.ceil(linear / chunkSize) * chunkSize);
        r.textEl.textContent = r.text.substring(0, revealed);
        const blinkOn = Math.floor((local / view.fps) * 2) % 2 === 0;
        r.cursor.style.display = revealed < total && blinkOn ? 'inline-block' : 'none';
      });
    };
  }
};
