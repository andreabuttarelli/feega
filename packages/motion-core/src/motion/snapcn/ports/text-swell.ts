import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'text-swell',
  title: 'Text swell',
  about: 'The lead word rises and floats forward, the next word bounces its letters in and shoves it left, then the line settles.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 110,
  background: '#faf9f6',
  fonts: [],
  props: {
    text: { type: 'string', title: 'Text', default: 'No extra charge', group: 'Content', maxLength: 120 },
    fontSize: { type: 'number', title: 'Font size (px)', default: 72, minimum: 12, maximum: 300, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 600, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    color: { type: 'string', title: 'Colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    letterSpacing: { type: 'string', title: 'Letter spacing', default: '-0.03em', group: 'Style', maxLength: 20 },
    introDuration: { type: 'number', title: 'Lead fade-in (frames)', default: 8, minimum: 0, maximum: 60, step: 1, group: 'Motion' },
    riseDistance: { type: 'number', title: 'Lead rise distance (em)', default: 0.7, minimum: 0, maximum: 3, step: 0.05, group: 'Motion' },
    riseDuration: { type: 'number', title: 'Lead rise (frames)', default: 10, minimum: 1, maximum: 60, step: 1, group: 'Motion' },
    startScale: { type: 'number', title: 'Start scale', default: 1, minimum: 0.1, maximum: 4, step: 0.05, group: 'Motion' },
    frontScale: { type: 'number', title: 'Front scale', default: 2.1, minimum: 1, maximum: 5, step: 0.05, group: 'Motion' },
    approachDelay: { type: 'number', title: 'Approach delay (frames)', default: 14, minimum: 0, maximum: 120, step: 1, group: 'Motion' },
    approachDuration: { type: 'number', title: 'Approach (frames)', default: 20, minimum: 1, maximum: 120, step: 1, group: 'Motion' },
    wordDelay: { type: 'number', title: 'Second word delay (frames)', default: 27, minimum: 0, maximum: 120, step: 1, group: 'Motion' },
    wordStagger: { type: 'number', title: 'Word stagger (frames)', default: 14, minimum: 0, maximum: 60, step: 1, group: 'Motion' },
    wordPush: { type: 'number', title: 'Word push distance (em)', default: 0.15, minimum: 0, maximum: 3, step: 0.05, group: 'Motion' },
    wordPushDuration: { type: 'number', title: 'Word push (frames)', default: 12, minimum: 1, maximum: 60, step: 1, group: 'Motion' },
    bounceWords: { type: 'number', title: 'Bouncing words', default: 1, minimum: 0, maximum: 20, step: 1, group: 'Motion' },
    letterSwell: { type: 'number', title: 'Letter swell', default: 0.23, minimum: 0, maximum: 2, step: 0.01, group: 'Motion' },
    letterStagger: { type: 'number', title: 'Letter stagger (frames)', default: 2, minimum: 0, maximum: 20, step: 1, group: 'Motion' },
    letterRise: { type: 'number', title: 'Letter rise (frames)', default: 3, minimum: 1, maximum: 30, step: 1, group: 'Motion' },
    letterHold: { type: 'number', title: 'Letter hold (frames)', default: 0, minimum: 0, maximum: 30, step: 1, group: 'Motion' },
    letterFall: { type: 'number', title: 'Letter fall (frames)', default: 6, minimum: 1, maximum: 30, step: 1, group: 'Motion' },
    holdDuration: { type: 'number', title: 'Hold (frames)', default: 6, minimum: 0, maximum: 120, step: 1, group: 'Motion' },
    recedeDuration: { type: 'number', title: 'Recede (frames)', default: 18, minimum: 1, maximum: 120, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const n = (k: string) => Number(p[k]);
    const t = S.themeOf(String(p.mode));
    const fontSize = n('fontSize');
    const width = view.width;
    const FIT = 0.97;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const RISE_EASE = S.Easing.bezier(0.2, 0.6, 0.35, 1);
    const APPROACH_EASE = S.Easing.bezier(0.4, 0, 0.15, 1);
    const ZOOM_EASE = S.Easing.bezier(0.5, 0, 0.05, 1);
    const WORD_EASE = S.Easing.bezier(0.22, 0.8, 0.36, 1);
    const LETTER_EASE = S.Easing.bezier(0.4, 0, 0.2, 1);
    const bounceWords = n('bounceWords');
    const wordStart = (i: number) => n('wordDelay') + (i - 1) * n('wordStagger');
    const letterStart = (i: number, j: number) => wordStart(i) + j * n('letterStagger');

    const words = String(p.text).split(' ').filter(Boolean);
    const letterEls: HTMLElement[][] = [];
    const wordEls = words.map((word, i) => {
      const bounces = i >= 1 && i <= bounceWords;
      const letters = bounces ? Array.from(word).map((c) => S.h('span', { style: { display: 'inline-block' } }, c) as HTMLElement) : [];
      letterEls.push(letters);
      return S.h('span', { style: { display: 'inline-block' } }, bounces ? letters : word) as HTMLElement;
    });
    const ruler = S.h('span', { style: { display: 'inline-block', width: 0, height: 0 } }) as HTMLElement;
    const line = S.h('span', { style: { position: 'relative', display: 'inline-block', fontSize, fontWeight: n('fontWeight'), color: S.pick(p.color, String(t.foreground)), letterSpacing: String(p.letterSpacing), lineHeight: 1.1, whiteSpace: 'nowrap', fontFamily: S.pick(p.fontFamily, '-apple-system, BlinkMacSystemFont, sans-serif'), textRendering: 'geometricPrecision' } }, wordEls.map((el, i) => (i === 0 ? [el] : [' ', el])), ruler) as HTMLElement;
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center', background: 'transparent' }, line));

    const lastEnd = Math.max(n('approachDelay') + n('approachDuration'), ...words.map((word, i) => (i === 0 ? 0 : Math.max(wordStart(i) + n('wordPushDuration'), i <= bounceWords ? letterStart(i, word.length - 1) + n('letterRise') + n('letterHold') + n('letterFall') : 0))));
    const recedeStart = lastEnd + n('holdDuration');

    const geometry = () => {
      const lineWidth = line.offsetWidth;
      const lead = wordEls[0];
      const leadCenter = lead ? lead.offsetLeft + lead.offsetWidth / 2 : 0;
      const ends = wordEls.map((el) => el.offsetLeft + el.offsetWidth);
      const added = ends.map((e, i) => (i === 0 ? 0 : e - ends[i - 1]));
      const total = added.reduce((a, b) => a + b, 0) || 1;
      const share = added.map((a) => a / total);
      const before: number[] = [];
      let run = 0;
      for (const s of share) {
        before.push(run);
        run += s;
      }
      const restLeft = (width - lineWidth) / 2;
      let front = Math.min(n('frontScale'), (width * FIT - restLeft) / lineWidth);
      for (let i = 1; i < words.length; i++) {
        const unspent = 1 - before[i];
        const room = width * FIT - restLeft - (lineWidth / 2) * unspent;
        const reach = ends[i] + n('wordPush') * fontSize - leadCenter * unspent;
        if (reach > 0) {
          front = Math.min(front, room / reach);
        }
      }
      return { lineWidth, leadCenter, share, baseline: ruler.offsetTop, front: Math.max(1, front) };
    };

    return (at) => {
      const frame = at * n('speed');
      const g = geometry();
      line.style.transformOrigin = `0% ${g.baseline}px`;
      const scale = S.interpolate(frame, [n('approachDelay'), n('approachDelay') + n('approachDuration')], [n('startScale'), g.front], { ...clamped, easing: APPROACH_EASE }) + S.interpolate(frame, [recedeStart, recedeStart + n('recedeDuration')], [0, 1 - g.front], { ...clamped, easing: ZOOM_EASE });
      let shoved = 0;
      for (let i = 1; i < words.length; i++) {
        shoved += g.share[i] * S.interpolate(frame, [wordStart(i), wordStart(i) + n('wordPushDuration')], [0, 1], { ...clamped, easing: WORD_EASE });
      }
      line.style.scale = String(scale);
      line.style.translate = `${(g.lineWidth / 2 - scale * g.leadCenter) * (1 - shoved)}px`;

      wordEls.forEach((el, i) => {
        if (i === 0) {
          el.style.opacity = String(S.interpolate(frame, [0, n('introDuration')], [0, 1], clamped));
          el.style.translate = `0px ${S.interpolate(frame, [0, n('riseDuration')], [n('riseDistance') * fontSize, 0], { ...clamped, easing: RISE_EASE })}px`;
          return;
        }
        const start = wordStart(i);
        el.style.opacity = String(S.interpolate(frame, [start, start + 3], [0, 1], clamped));
        el.style.translate = `${S.interpolate(frame, [start, start + n('wordPushDuration')], [n('wordPush') * fontSize, 0], { ...clamped, easing: WORD_EASE })}px`;
        letterEls[i].forEach((letter, j) => {
          const rise = letterStart(i, j);
          const fall = rise + n('letterRise') + n('letterHold');
          letter.style.transformOrigin = `50% ${g.baseline}px`;
          letter.style.scale = String(1 + n('letterSwell') * (S.interpolate(frame, [rise, rise + n('letterRise')], [0, 1], { ...clamped, easing: LETTER_EASE }) - S.interpolate(frame, [fall, fall + n('letterFall')], [0, 1], { ...clamped, easing: LETTER_EASE })));
        });
      });
    };
  }
};
