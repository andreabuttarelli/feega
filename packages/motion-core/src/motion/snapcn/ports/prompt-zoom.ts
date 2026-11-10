import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'prompt-zoom',
  title: 'Prompt zoom',
  about: 'An assistant field types a prompt into itself and, mid-sentence, hard-cuts into the caret and keeps typing.',
  category: SnapcnCategory.Ai,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 90,
  background: '#faf9f6',
  fonts: ['Inter', 'Source Serif 4'],
  props: {
    greeting: { type: 'string', title: 'Greeting', default: 'Up late?', group: 'Content', maxLength: 60 },
    placeholder: { type: 'string', title: 'Placeholder', default: 'How can I help you today?', group: 'Content', maxLength: 80 },
    text: { type: 'string', title: 'Prompt', default: 'Get me a plan for tomorrow', group: 'Content', maxLength: 120 },
    chips: { type: 'string', title: 'Chips (comma separated)', default: '', group: 'Content', maxLength: 200 },
    model: { type: 'string', title: 'Model label', default: 'Auto', group: 'Content', maxLength: 30 },
    effort: { type: 'string', title: 'Effort label', default: 'Medium', group: 'Content', maxLength: 30 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    accentColor: { type: 'string', title: 'Mark colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    typeStart: { type: 'number', title: 'Typing starts (s)', default: 0.35, minimum: 0, maximum: 10, step: 0.05, group: 'Motion' },
    cutAt: { type: 'number', title: 'Cut at (s)', default: 1, minimum: 0, maximum: 10, step: 0.05, group: 'Motion' },
    charsPerSecond: { type: 'number', title: 'Characters per second', default: 18, minimum: 1, maximum: 100, step: 1, group: 'Motion' },
    zoom: { type: 'number', title: 'Cut zoom', default: 2.547, minimum: 1, maximum: 6, step: 0.01, group: 'Camera' },
    focusX: { type: 'number', title: 'Focus X', default: 0.27, minimum: 0, maximum: 1, step: 0.01, group: 'Camera' },
    focusY: { type: 'number', title: 'Focus Y', default: 0.516, minimum: 0, maximum: 1, step: 0.01, group: 'Camera' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const FACES = [
      ['Prompt Zoom Inter', 'https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2'],
      ['Prompt Zoom Serif', 'https://fonts.gstatic.com/s/sourceserif4/v15/vEFF2_tTDB4M7-auWDN0ahZJW3IX2ih5nk3AucvUHf6kDXr4.woff2']
    ];
    let redraw = () => {};
    FACES.forEach(([name, url]) => {
      if (typeof FontFace === 'undefined' || [...document.fonts].some((f) => f.family === name)) {
        return;
      }
      const face = new FontFace(name, `url(${url}) format("woff2")`, { weight: '100 900' });
      document.fonts.add(face);
      face.load().then(() => redraw()).catch(() => undefined);
    });
    const face = S.pick(p.fontFamily, `"${FACES[0][0]}", Inter`);
    const SERIF = `"${FACES[1][0]}", "Source Serif 4"`;
    const fps = view.fps;
    const REF_W = 810;
    const REF_H = 450;
    const stageScale = Math.min(view.width / REF_W, view.height / REF_H);
    const BOX = { x: 173, y: 197, w: 461, h: 86, r: 11 };
    const HEAD_Y = 145;
    const PAD = 20;
    const CHIP_ICONS = ['M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z', 'M22 10 12 5 2 10l10 5 10-5ZM6 12v5c3 3 9 3 12 0v-5', 'm8 6-6 6 6 6M16 6l6 6-6 6', 'M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z', 'M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4'];
    const accent = S.pick(p.accentColor, String(t.primary));
    const borderColor = S.mixOklch(String(t.input), String(t.foreground), 0.18);
    const text = String(p.text);
    const chips = String(p.chips).split(',').map((c) => c.trim()).filter(Boolean);
    const speed = Number(p.speed);

    const glyph = (d: string, size: number, color: string) => S.h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', style: { display: 'block', flexShrink: 0 } }, S.h('path', { d }));
    const starburst = S.h('svg', { viewBox: '0 0 24 24', width: 19, height: 19, style: { display: 'block', flexShrink: 0 } },
      [0, 30, 60, 90, 120, 150].map((a) => S.h('rect', { x: 10.9, y: 1.6, width: 2.2, height: 20.8, rx: 1.1, fill: accent, transform: `rotate(${a} 12 12)` })),
      S.h('circle', { cx: 12, cy: 12, r: 3.6, fill: accent }));

    const greeting = S.h('div', { style: { position: 'absolute', left: 0, right: 0, top: HEAD_Y - 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: SERIF, fontWeight: 400, fontSize: 30, lineHeight: 1.1, color: t.foreground, textRendering: 'geometricPrecision' } }, starburst, String(p.greeting));
    const label = document.createTextNode('');
    const caret = S.h('span', { style: { display: 'inline-block', width: 1.4, height: 15, marginLeft: 1, background: t.foreground } }) as HTMLElement;
    const promptLine = S.h('div', { style: { position: 'absolute', left: PAD, top: PAD - 4, right: PAD, display: 'flex', alignItems: 'center', fontFamily: face, fontWeight: 400, fontSize: 12, lineHeight: 1.4, whiteSpace: 'pre', textRendering: 'geometricPrecision' } }, label, caret) as HTMLElement;
    const footer = S.h('div', { style: { position: 'absolute', left: PAD, right: PAD, bottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: face, fontSize: 10, color: t.mutedForeground } },
      glyph('M12 5v14M5 12h14', 13, String(t.mutedForeground)),
      S.h('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } }, S.h('span', { style: { color: t.foreground, fontWeight: 500 } }, String(p.model)), S.h('span', null, String(p.effort))));
    const field = S.h('div', { style: { position: 'absolute', left: BOX.x, top: BOX.y, width: BOX.w, height: BOX.h, borderRadius: BOX.r, background: t.card, border: `1px solid ${borderColor}`, boxShadow: 'none', boxSizing: 'border-box' } }, promptLine, footer);
    const chipRow = chips.length === 0 ? null : S.h('div', { style: { position: 'absolute', left: BOX.x, top: 301, width: BOX.w, display: 'flex', justifyContent: 'center', gap: 9 } },
      chips.map((chip, i) => S.h('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, boxSizing: 'border-box', padding: '0 11px', borderRadius: 13, background: t.card, border: `1px solid ${borderColor}`, color: t.foreground, fontFamily: face, fontWeight: 500, fontSize: 11, lineHeight: 1, whiteSpace: 'nowrap', textRendering: 'geometricPrecision' } }, glyph(CHIP_ICONS[i % CHIP_ICONS.length], 12, String(t.mutedForeground)), chip)));
    const camera = S.h('div', { style: { position: 'absolute', inset: 0, transformOrigin: `${Number(p.focusX) * REF_W}px ${Number(p.focusY) * REF_H}px` } }, greeting, field, chipRow) as HTMLElement;
    const stage = S.h('div', { style: { position: 'absolute', left: '50%', top: '50%', width: REF_W, height: REF_H, transform: `translate(-50%, -50%) scale(${stageScale})` } }, camera);
    view.root.replaceChildren(S.fill({ background: 'transparent' }, stage));

    const render = (frame: number) => {
      redraw = () => render(frame);
      const fc = frame * speed;
      const startF = Number(p.typeStart) * fps;
      const perFrame = Number(p.charsPerSecond) / fps;
      const typedN = fc <= startF ? 0 : Math.min(text.length, Math.floor((fc - startF) * perFrame));
      const typing = typedN > 0 && typedN < text.length;
      const on = typing || Math.floor(fc / (0.53 * fps)) % 2 === 0;
      camera.style.transform = `scale(${fc >= Number(p.cutAt) * fps ? Number(p.zoom) : 1})`;
      label.data = typedN > 0 ? text.slice(0, typedN) : String(p.placeholder);
      promptLine.style.color = String(typedN > 0 ? t.foreground : t.mutedForeground);
      caret.style.opacity = on ? '1' : '0';
    };
    return render;
  }
};
