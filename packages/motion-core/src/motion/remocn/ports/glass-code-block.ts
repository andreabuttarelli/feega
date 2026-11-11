import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'glass-code-block',
  title: 'Glass code block',
  about: 'A frosted-glass editor window whose syntax-coloured code lines fade in one after another.',
  category: SnapcnCategory.Screen,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 180,
  background: '#0b0b10',
  fonts: ['Geist Mono'],
  props: {
    title: { type: 'string', title: 'Title', default: 'hero.tsx', group: 'Content', maxLength: 60 },
    width: { type: 'number', title: 'Width', default: 760, minimum: 300, maximum: 1100, step: 10, group: 'Style' },
    height: { type: 'number', title: 'Height', default: 460, minimum: 200, maximum: 700, step: 10, group: 'Style' },
    fontSize: { type: 'number', title: 'Font size', default: 16, minimum: 10, maximum: 28, step: 1, group: 'Style' },
    glassColor: { type: 'string', title: 'Glass colour', default: 'rgba(10, 10, 10, 0.6)', group: 'Style' },
    staggerFrames: { type: 'number', title: 'Stagger frames', default: 4, minimum: 0, maximum: 30, step: 1, group: 'Motion' },
    showTrafficLights: { type: 'boolean', title: 'Traffic lights', default: true, group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const fontSize = Number(p.fontSize);
    const stagger = Number(p.staggerFrames);
    const speed = Number(p.speed);
    const CODE = [
      'import { motion } from "feega";',
      '',
      '// Generate a hero scene',
      'export function Hero() {',
      '  const frame = useCurrentFrame();',
      '  const opacity = frame / 30;',
      '  return <h1 style={{ opacity }}>Hello</h1>;',
      '}'
    ];
    const KEYWORDS = new Set(['import', 'from', 'export', 'function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'new', 'class', 'extends', 'default', 'true', 'false', 'null', 'undefined']);
    const COLORS: Record<string, string> = { code: '#e4e4e7', comment: '#52525b', string: '#86efac', keyword: '#c4b5fd', number: '#fcd34d' };
    const FADE_FRAMES = 8;
    const RISE_PX = 4;
    const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

    const kindOf = (token: string) => {
      if (/^["'`]/.test(token)) {
        return 'string';
      }
      if (/^\d+$/.test(token)) {
        return 'number';
      }
      return KEYWORDS.has(token) ? 'keyword' : 'code';
    };
    const tokenize = (line: string) => {
      if (line.trimStart().startsWith('//')) {
        return [{ text: line, kind: 'comment' }];
      }
      const matches = line.match(/"[^"]*"|'[^']*'|`[^`]*`|\b\d+\b|\b[A-Za-z_$][\w$]*\b|[^\w"']+/g) ?? [];
      return matches.map((text) => ({ text, kind: kindOf(text) }));
    };

    const light = (color: string) => S.h('div', { style: { width: 12, height: 12, borderRadius: '50%', background: color, opacity: 0.6 } });
    const lines = CODE.map((line, i) => {
      const tokens = tokenize(line);
      if (tokens.length === 0) {
        return S.h('div', { style: { height: fontSize * 0.8, opacity: 0 } }) as HTMLElement;
      }
      const gutter = S.h('span', { style: { width: 28, color: '#3f3f46', userSelect: 'none' } }, String(i + 1).padStart(2, ' '));
      const spans = tokens.map((t) => S.h('span', { style: { color: COLORS[t.kind] } }, t.text));
      return S.h('div', { style: { opacity: 0, whiteSpace: 'pre', display: 'flex', gap: 0 } }, gutter, S.h('span', null, spans)) as HTMLElement;
    });

    const chrome = S.h('div', { style: { height: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 } },
      p.showTrafficLights === false ? null : [light('#ff5f57'), light('#febc2e'), light('#28c840')],
      S.h('div', { style: { flex: 1, textAlign: 'center', color: '#a1a1aa', fontSize: 12, letterSpacing: '0.02em' } }, String(p.title)));
    const body = S.h('div', { style: { flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 4, fontSize, lineHeight: 1.55 } }, lines);
    const glass = S.h('div', { style: { width: '100%', height: '100%', borderRadius: 15, background: String(p.glassColor), backdropFilter: 'blur(16px)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Geist Mono', ui-monospace, SFMono-Regular, monospace" } }, chrome, body);
    const ring = S.h('div', { style: { position: 'relative', padding: 1, borderRadius: 16, background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 100%)', width: Number(p.width), height: Number(p.height), boxShadow: '0 50px 120px rgba(0,0,0,0.55)' } }, glass);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, ring));

    return (at) => {
      lines.forEach((el, i) => {
        const local = at - Math.round((i * stagger) / speed);
        el.style.opacity = String(S.interpolate(local, [0, FADE_FRAMES], [0, 1], clamp));
        el.style.translate = `0 ${S.interpolate(local, [0, FADE_FRAMES], [RISE_PX, 0], clamp)}px`;
      });
    };
  }
};
