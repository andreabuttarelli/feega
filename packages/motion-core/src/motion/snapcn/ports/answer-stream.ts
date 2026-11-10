import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'answer-stream',
  title: 'Answer stream',
  about: 'A macro shot of a prompt being sent cuts to the AI answer streaming in word by word, a headline and a row of plan cards, then pulls back.',
  category: SnapcnCategory.Ai,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#faf9f6',
  fonts: ['Inter', 'Source Serif 4'],
  props: {
    question: { type: 'string', title: 'Question', default: 'How do I rank higher in AI answers?', group: 'Content', maxLength: 200 },
    answer: { type: 'string', title: 'Answer (newline = new line)', default: "Analysing your prompt gaps…\nFound 27 prompts you should rank for and don't yet, so your name shows up everywhere AI looks.", group: 'Content', maxLength: 600 },
    headline: { type: 'string', title: 'Headline', default: "Your AI visibility score: 34% — here's how I'd fix it:", group: 'Content', maxLength: 200 },
    cards: { type: 'string', title: 'Cards: title: body | title: body', default: 'Content: Build pages around the exact questions buyers ask, so there is something accurate to cite. | Citations: Run outreach to the sources that already get quoted for those questions. | Authority: Earn links from the publishers the models already trust. | Coverage: Place press so the name turns up wherever people go looking.', group: 'Content', maxLength: 1200 },
    model: { type: 'string', title: 'Model label', default: 'Auto', group: 'Content', maxLength: 40 },
    accentColor: { type: 'string', title: 'Accent (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    commitAt: { type: 'number', title: 'Send press (s)', default: 1, minimum: 0, maximum: 4, step: 0.01, group: 'Motion' },
    cutAt: { type: 'number', title: 'Cut to answer (s)', default: 1.284, minimum: 0, maximum: 4, step: 0.01, group: 'Motion' },
    pullbackAt: { type: 'number', title: 'Pull back (s)', default: 1.933, minimum: 0, maximum: 5, step: 0.01, group: 'Motion' },
    pullbackDuration: { type: 'number', title: 'Pull back duration (s)', default: 1.1, minimum: 0.1, maximum: 4, step: 0.01, group: 'Motion' },
    wordsPerSecond: { type: 'number', title: 'Words per second', default: 25, minimum: 1, maximum: 100, step: 1, group: 'Motion' },
    coolSeconds: { type: 'number', title: 'Word colour cool (s)', default: 0.23, minimum: 0, maximum: 2, step: 0.01, group: 'Motion' },
    macroZoom: { type: 'number', title: 'Macro zoom', default: 2.36, minimum: 1, maximum: 6, step: 0.01, group: 'Motion' },
    pullbackFrom: { type: 'number', title: 'Pull back from scale', default: 1.364, minimum: 1, maximum: 4, step: 0.01, group: 'Motion' },
    pullbackUndershoot: { type: 'number', title: 'Pull back undershoot', default: 0.028, minimum: 0, maximum: 0.3, step: 0.001, group: 'Motion' },
    focusX: { type: 'number', title: 'Focus X', default: 0.5, minimum: -1, maximum: 2, step: 0.01, group: 'Motion' },
    focusY: { type: 'number', title: 'Focus Y', default: -0.548, minimum: -2, maximum: 2, step: 0.01, group: 'Motion' },
    blur: { type: 'number', title: 'Max motion blur (px)', default: 3, minimum: 0, maximum: 20, step: 0.1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const n = (k: string) => Number(p[k]);
    const FACES = [
      ['Answer Stream Inter', 'https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2'],
      ['Answer Stream Serif', 'https://fonts.gstatic.com/s/sourceserif4/v15/vEFF2_tTDB4M7-auWDN0ahZJW3IX2ih5nk3AucvUHf6kDXr4.woff2']
    ];
    FACES.forEach(([family, url]) => {
      if (typeof FontFace === 'undefined' || [...document.fonts].some((f) => f.family === family)) {
        return;
      }
      const loaded = new FontFace(family, `url(${url}) format("woff2")`, { weight: '100 900' });
      document.fonts.add(loaded);
      loaded.load().catch(() => undefined);
    });
    const face = S.pick(p.fontFamily, '"Answer Stream Inter", Inter');
    const SERIF = '"Answer Stream Serif", "Source Serif 4"';
    const REF_W = 886;
    const REF_H = 498;
    const PILL = { right: 706, top: 22, h: 28, padX: 15, size: 11 };
    const ANSWER = { x: 171, top: 82, w: 400, size: 13, line: 17 };
    const HEAD = { x: 171, top: 152, size: 16 };
    const ROW = { x: 171, top: 190, w: 128, h: 140, gap: 5, r: 6 };
    const BOX = { x: 163, y: 362, w: 549, h: 128, r: 20 };
    const SEND = { size: 28, r: 9, right: 19, bottom: 28 };
    const MACRO_X = 0.571;
    const MACRO_Y = 0.591;
    const CARD_ICONS = ['M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z', 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19', 'M12 2 4 6v6c0 5 3.4 8.9 8 10 4.6-1.1 8-5 8-10V6l-8-4Z', 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z'];
    const fps = view.fps;
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    const out = (v: number) => 1 - (1 - v) ** 3;
    const inOut = (v: number) => (v < 0.5 ? 4 * v * v * v : 1 - (-2 * v + 2) ** 3 / 2);

    const question = String(p.question);
    const cards = String(p.cards).split('|').map((c) => c.trim()).filter(Boolean).map((c) => {
      const cut = c.indexOf(':');
      return cut < 0 ? { title: c, body: '' } : { title: c.slice(0, cut).trim(), body: c.slice(cut + 1).trim() };
    });
    const fg = String(t.foreground);
    const muted = String(t.mutedForeground);
    const accent = S.pick(p.accentColor, String(t.primary));
    const stageScale = Math.min(view.width / REF_W, view.height / REF_H);
    const border = `1px solid ${S.mixOklch(String(t.input), fg, 0.18)}`;
    const ramp = Array.from({ length: 9 }, (_, i) => S.mixOklch(accent, fg, i / 8));
    const mutedRamp = Array.from({ length: 9 }, (_, i) => S.mixOklch(muted, fg, i / 8));
    const commitF = n('commitAt') * fps;
    const cutF = n('cutAt') * fps;
    const pullF = n('pullbackAt') * fps;
    const pullDurF = n('pullbackDuration') * fps;
    const wpf = n('wordsPerSecond') / fps;
    const coolF = n('coolSeconds') * fps;
    const from = n('pullbackFrom');
    const undershoot = n('pullbackUndershoot');
    const focusX = n('focusX');
    const focusY = n('focusY');
    const maxBlur = n('blur');
    const macroZoom = n('macroZoom');
    const speed = n('speed');
    const btnX = BOX.x + BOX.w - SEND.right - SEND.size / 2;
    const btnY = BOX.y + BOX.h - SEND.bottom - SEND.size / 2;
    const streamStart = cutF + 0.075 * fps;
    const headStart = streamStart + (2.717 - 1.359) * fps;
    const composerAt = cutF + (2.442 - 1.284) * fps;
    const cardsAt = cutF + (2.642 - 1.284) * fps;
    const abs = (style: Record<string, string | number>) => ({ position: 'absolute', ...style });

    const glyph = (d: string, size: number, color: string) => S.h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', style: { display: 'block', flexShrink: 0 } }, S.h('path', { d }));

    const streams: { spans: { el: HTMLElement; born: number }[]; ramp: string[] }[] = [];
    const stream = (text: string, startF: number, perFrame: number, tones: string[], style: Record<string, string | number>) => {
      let k = 0;
      const spans: { el: HTMLElement; born: number }[] = [];
      const rows = text.split('\n').map((line) => S.h('div', null, line.split(' ').map((w, wi) => {
        const el = S.h('span', null, wi > 0 ? ' ' : '', w) as HTMLElement;
        spans.push({ el, born: perFrame <= 0 ? startF : startF + k++ / perFrame });
        return el;
      })));
      streams.push({ spans, ramp: tones });
      return S.h('div', { style: { ...style, textRendering: 'geometricPrecision' } }, rows);
    };

    const composer = () => {
      const send = S.h('div', { style: { width: SEND.size, height: SEND.size, borderRadius: SEND.r, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, glyph('M12 19V5M5 12l7-7 7 7', 15, String(t.primaryForeground))) as HTMLElement;
      const el = S.h('div', { style: abs({ left: BOX.x, top: BOX.y, width: BOX.w, height: BOX.h, borderRadius: BOX.r, background: String(t.card), border, boxShadow: 'none', boxSizing: 'border-box' }) },
        S.h('div', { style: abs({ left: 28, top: 26, right: 28, fontFamily: face, fontSize: 14, lineHeight: 1.4, color: fg, textRendering: 'geometricPrecision' }) }, question),
        S.h('div', { style: abs({ left: 28, right: SEND.right, bottom: SEND.bottom - SEND.size / 2, height: SEND.size, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: face, fontSize: 9, color: muted }) },
          glyph('M12 5v14M5 12h14', 16, muted),
          S.h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } }, S.h('span', null, String(p.model)), send)));
      return { el, send };
    };

    const macroComposer = composer();
    const macroInner = S.h('div', { style: abs({ inset: 0, transformOrigin: `${btnX}px ${btnY}px` }) }, macroComposer.el) as HTMLElement;
    const macro = S.h('div', { style: abs({ inset: 0 }) }, macroInner) as HTMLElement;

    const pill = S.h('div', { style: abs({ right: REF_W - PILL.right, top: PILL.top, height: PILL.h, padding: `0 ${PILL.padX}px`, borderRadius: PILL.h / 2, background: String(t.muted), display: 'flex', alignItems: 'center' }) }, stream(question, cutF, 16 / fps, mutedRamp, { fontFamily: face, fontSize: PILL.size, lineHeight: 1, whiteSpace: 'nowrap' }));
    const answer = stream(String(p.answer), streamStart, wpf, ramp, abs({ left: ANSWER.x, top: ANSWER.top, width: ANSWER.w, fontFamily: SERIF, fontWeight: 600, fontSize: ANSWER.size, lineHeight: `${ANSWER.line}px` }));
    const head = stream(String(p.headline), headStart, 16 / fps, ramp, abs({ left: HEAD.x, top: HEAD.top, width: ROW.w * cards.length + ROW.gap * (cards.length - 1), fontFamily: SERIF, fontWeight: 400, fontSize: HEAD.size, lineHeight: 1.25 }));
    const cardEls = cards.map((c, i) => {
      const boxF = cardsAt + i * 3.5;
      const fill = boxF + 4;
      const el = S.h('div', { style: abs({ left: ROW.x + i * (ROW.w + ROW.gap), top: ROW.top, width: ROW.w, height: ROW.h, borderRadius: ROW.r, background: String(t.card), border, boxSizing: 'border-box' }) },
        S.h('div', { style: abs({ left: 12, top: 12 }) }, glyph(CARD_ICONS[i % CARD_ICONS.length], 11, muted)),
        stream(c.title, fill, wpf, ramp, abs({ left: 12, top: 32, right: 12, fontFamily: SERIF, fontWeight: 600, fontSize: 8, lineHeight: 1.2 })),
        stream(c.body, fill + 2, wpf, ramp, abs({ left: 12, top: 46, right: 12, fontFamily: face, fontSize: 7, lineHeight: '10px' }))) as HTMLElement;
      return { el, boxF };
    });
    const shotComposer = composer();
    const slide = S.h('div', null, shotComposer.el) as HTMLElement;
    const scaler = S.h('div', { style: abs({ inset: 0, transformOrigin: `${focusX * REF_W}px ${focusY * REF_H}px` }) }, pill, answer, head, cardEls.map((c) => c.el), slide) as HTMLElement;
    const shot = S.h('div', { style: abs({ inset: 0 }) }, scaler) as HTMLElement;
    const stage = S.h('div', { style: abs({ left: '50%', top: '50%', width: REF_W, height: REF_H, overflow: 'hidden', transform: `translate(-50%, -50%) scale(${stageScale})` }) }, macro, shot) as HTMLElement;
    view.root.replaceChildren(S.fill({ background: 'transparent', overflow: 'hidden' }, stage));

    const cam = (f: number) => {
      if (f <= pullF) {
        return from;
      }
      const bottom = 1 - undershoot;
      const u = clamp01((f - pullF) / pullDurF);
      if (u < 1) {
        return from + (bottom - from) * inOut(u);
      }
      return bottom + undershoot * clamp01((f - pullF - pullDurF - 3) / 26);
    };

    return (frame) => {
      const fc = frame * speed;
      const cut = fc >= cutF;
      macro.style.display = cut ? 'none' : 'block';
      shot.style.display = cut ? 'block' : 'none';
      const press = fc < commitF ? 0 : fc < commitF + 3 ? (fc - commitF) / 3 : 1 - clamp01((fc - commitF - 3) / 5);
      macroComposer.send.style.transform = `scale(${1 - 0.07 * press})`;
      shotComposer.send.style.transform = `scale(${1 - 0.07 * press})`;
      if (!cut) {
        const settle = out(clamp01(fc / 15));
        const commit = clamp01((fc - commitF) / Math.max(1, cutF - commitF)) ** 3;
        macro.style.transform = `translate(${(1 - settle) * 158}px, ${(1 - settle) * 14 + commit * 82}px)`;
        macroInner.style.transform = `translate(${MACRO_X * REF_W - btnX}px, ${MACRO_Y * REF_H - btnY}px) scale(${macroZoom * (1 + 0.12 * commit)})`;
        return;
      }
      const sB = cam(fc);
      const camBlur = Math.min(maxBlur, (Math.abs(sB - cam(fc - 1)) * (REF_H / 2 - focusY * REF_H)) / 4);
      shot.style.transform = `translateY(${(1 - out(clamp01((fc - cutF) / 15))) * -27}px)`;
      shot.style.filter = camBlur > 0.15 ? `blur(${camBlur.toFixed(2)}px)` : '';
      scaler.style.transform = `scale(${sB})`;
      slide.style.transform = `translateY(${(1 - out(clamp01((fc - composerAt) / 12))) * (REF_H - BOX.y)}px)`;
      cardEls.forEach((c) => {
        c.el.style.display = fc < c.boxF ? 'none' : 'block';
        c.el.style.opacity = String(clamp01((fc - c.boxF) / 3));
      });
      streams.forEach((s) => s.spans.forEach(({ el, born }) => {
        const h = coolF <= 0 ? 1 : clamp01((fc - born) / coolF);
        el.style.color = s.ramp[Math.min(s.ramp.length - 1, Math.round(h * (s.ramp.length - 1)))];
        el.style.opacity = fc >= born ? '1' : '0';
      }));
    };
  }
};
