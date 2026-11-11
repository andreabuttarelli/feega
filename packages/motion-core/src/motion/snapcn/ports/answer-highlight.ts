import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'answer-highlight',
  title: 'Answer highlight',
  about: 'A question pill lands, the answer writes itself word by word, then a drag selects the key statement and picks out one word.',
  category: SnapcnCategory.Ai,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 190,
  background: '#faf9f6',
  fonts: ['Inter'],
  props: {
    question: { type: 'string', title: 'Question', default: 'How should we structure the demo video?', group: 'Content', maxLength: 160 },
    answer: { type: 'string', title: 'Answer', default: 'Build one composition per scene and keep the timeline declarative, so the same props always render the same frames. Anything that reads the clock at render time is a bug you will find in the export.', group: 'Content', maxLength: 1000 },
    statement: { type: 'string', title: 'Selected run (as in answer)', default: 'keep the timeline declarative', group: 'Content', maxLength: 300 },
    word: { type: 'string', title: 'Picked word', default: 'declarative', group: 'Content', maxLength: 60 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
    paperColor: { type: 'string', title: 'Page (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    pillColor: { type: 'string', title: 'Pill (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    questionColor: { type: 'string', title: 'Question ink (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    answerColor: { type: 'string', title: 'Answer ink (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    accentColor: { type: 'string', title: 'Selection (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    centerY: { type: 'number', title: 'Vertical centre (0-1)', default: 0.5, minimum: 0, maximum: 1, step: 0.01, group: 'Style' },
    questionHold: { type: 'number', title: 'Question hold (s)', default: 0.6, minimum: 0, maximum: 5, step: 0.05, group: 'Motion' },
    beforeDrag: { type: 'number', title: 'Before drag (s)', default: 0.45, minimum: 0, maximum: 5, step: 0.05, group: 'Motion' },
    beforeWord: { type: 'number', title: 'Before word pick (s)', default: 0.6, minimum: 0, maximum: 5, step: 0.05, group: 'Motion' },
    wordStep: { type: 'number', title: 'Word arrival step (s)', default: 0.055, minimum: 0, maximum: 1, step: 0.005, group: 'Motion' },
    dragStep: { type: 'number', title: 'Drag step per word (s)', default: 0.11, minimum: 0, maximum: 1, step: 0.01, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const { width, height, fps } = view;
    const speed = Number(p.speed);
    const face = S.pick(p.fontFamily, 'Inter');
    const paper = S.pick(p.paperColor, String(t.background));
    const pill = S.pick(p.pillColor, String(t.card));
    const askInk = S.pick(p.questionColor, String(t.mutedForeground));
    const ink = S.pick(p.answerColor, String(t.foreground));
    const accent = S.pick(p.accentColor, String(t.primary));
    const band = S.withAlpha(accent, 0.16);
    const out = S.Easing.out(S.Easing.cubic);
    const PILL_H = 0.0553 * height;
    const font = 0.0385 * height;
    const WORD_IN_S = 0.22;
    const INTRO_S = 0.375;
    const INTRO_BLUR_S = 0.2;
    const INTRO_SCALE = 1.31;
    const INTRO_BLUR = 0.0141;
    const WORD_RISE = 0.34;
    const WORD_BAND_S = 0.2;
    const CARET_W = 0.06;
    const BAND_R = 0.1 * font;

    const splitWords = (text: string) => text.split(/\s+/).filter(Boolean);
    const bare = (w: string) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    const findRun = (words: string[], phrase: string): [number, number] | null => {
      const target = splitWords(phrase).map(bare);
      if (target.length === 0) {
        return null;
      }
      const wanted = target.join(' ');
      const hay = words.map(bare);
      for (let i = 0; i + target.length <= words.length; i += 1) {
        if (hay.slice(i, i + target.length).join(' ') === wanted) {
          return [i, i + target.length];
        }
      }
      return null;
    };
    const paintBand = (across: number, fill: string, caret: string, cw: number) => {
      if (across <= 0) {
        return '';
      }
      if (across >= 1) {
        return fill;
      }
      const stop = `${(across * 100).toFixed(2)}%`;
      return `linear-gradient(to right, ${fill} 0 ${stop}, ${caret} ${stop}, ${caret} calc(${stop} + ${cw.toFixed(2)}px), transparent calc(${stop} + ${cw.toFixed(2)}px))`;
    };
    const ramp = (fc: number, at: number, dur: number) => (dur <= 0 ? (fc >= at ? 1 : 0) : Math.max(0, Math.min(1, (fc - at) / dur)));
    const dragEdge = (fc: number, at: number, stepF: number, count: number) => (stepF <= 0 ? (fc >= at ? count : 0) : Math.max(0, Math.min(count, (fc - at) / stepF)));

    const words = splitWords(String(p.answer));
    const run = findRun(words, String(p.statement));
    const wordRun = run ? findRun(words, String(p.word)) : null;
    const picked = wordRun && run && wordRun[0] >= run[0] && wordRun[1] <= run[1] ? wordRun : null;
    const answerAt = Number(p.questionHold) * fps;
    const stepF = Number(p.wordStep) * fps;
    const answerDone = answerAt + (words.length - 1) * stepF + WORD_IN_S * fps;
    const dragAt = answerDone + Number(p.beforeDrag) * fps;
    const dragStepF = Number(p.dragStep) * fps;
    const runLen = run ? run[1] - run[0] : 0;
    const wordAt = dragAt + runLen * dragStepF + Number(p.beforeWord) * fps;

    const spans = words.map((w, i) => {
      const first = run && i === run[0] ? BAND_R : 0;
      const last = run && i === run[1] - 1 ? BAND_R : 0;
      return S.h('span', { style: { display: 'inline-block', padding: `${0.18 * font}px 0.28em ${0.18 * font}px 0`, borderTopLeftRadius: first, borderBottomLeftRadius: first, borderTopRightRadius: last, borderBottomRightRadius: last } }, w) as HTMLElement;
    });
    const pillEl = S.h('div', { style: { fontFamily: face, fontSize: 0.0223 * height, fontWeight: 500, lineHeight: 1, color: askInk, background: pill, height: PILL_H, borderRadius: 0.28 * PILL_H, padding: `0 ${0.42 * PILL_H}px`, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' } }, String(p.question));
    const intro = S.h('div', { style: { transformOrigin: '0% 50%', marginBottom: 0.075 * height } }, pillEl) as HTMLElement;
    const answerEl = S.h('div', { style: { fontFamily: face, fontSize: font, fontWeight: 400, lineHeight: 1.64, color: ink } }, spans);
    const lockup = S.h('div', { style: { position: 'absolute', top: `${Number(p.centerY) * 100}%`, transform: 'translateY(-50%)', width: 0.6 * width, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' } }, intro, answerEl);
    view.root.replaceChildren(S.fill({ backgroundColor: paper, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontOpticalSizing: 'none' }, lockup));

    return (frame) => {
      const fc = frame * speed;
      const edge = run ? dragEdge(fc, dragAt, dragStepF, runLen) : 0;
      const wordIn = out(ramp(fc, wordAt, WORD_BAND_S * fps));
      const introP = out(ramp(fc, 0, INTRO_S * fps));
      const blur = INTRO_BLUR * height * (1 - out(ramp(fc, 0, INTRO_BLUR_S * fps)));
      intro.style.opacity = String(introP);
      intro.style.filter = blur > 0.01 ? `blur(${blur}px)` : '';
      intro.style.transform = `scale(${S.interpolate(introP, [0, 1], [INTRO_SCALE, 1])})`;

      spans.forEach((el, i) => {
        const arrive = out(ramp(fc, answerAt + i * stepF, WORD_IN_S * fps));
        const inRun = run ? i >= run[0] && i < run[1] : false;
        const isPicked = picked ? i >= picked[0] && i < picked[1] : false;
        const across = inRun && run ? Math.max(0, Math.min(1, edge - (i - run[0]))) : 0;
        const fill = isPicked ? S.withAlpha(accent, 0.16 + 0.14 * wordIn) : band;
        el.style.opacity = String(arrive);
        el.style.transform = `translateY(${(1 - arrive) * WORD_RISE * font}px)`;
        el.style.color = isPicked ? S.mixOklch(ink, accent, wordIn) : ink;
        el.style.background = paintBand(across, fill, accent, CARET_W * font);
      });
    };
  }
};
