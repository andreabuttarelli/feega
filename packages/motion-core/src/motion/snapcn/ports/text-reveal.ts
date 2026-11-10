import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'text-reveal',
  title: 'Text reveal',
  about: 'The lead word lands huge and centred, drifts closer, falls back into the line, and the rest of the sentence pushes in from the right word by word.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 90,
  background: '#faf9f6',
  fonts: [],
  props: {
    text: { type: 'string', title: 'Text', default: 'Meet Acme Billing', group: 'Content', maxLength: 120 },
    fontSize: { type: 'number', title: 'Font size (px)', default: 72, minimum: 12, maximum: 300, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 600, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    color: { type: 'string', title: 'Colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    letterSpacing: { type: 'string', title: 'Letter spacing', default: '-0.03em', group: 'Style', maxLength: 20 },
    initialScale: { type: 'number', title: 'Lead word start scale', default: 2.3, minimum: 1, maximum: 6, step: 0.05, group: 'Motion' },
    introDuration: { type: 'number', title: 'Lead fade-in (frames)', default: 6, minimum: 0, maximum: 60, step: 1, group: 'Motion' },
    holdDuration: { type: 'number', title: 'Hold (frames)', default: 12, minimum: 0, maximum: 120, step: 1, group: 'Motion' },
    pushScale: { type: 'number', title: 'Push toward viewer', default: 1.06, minimum: 1, maximum: 1.5, step: 0.01, group: 'Motion' },
    recedeDuration: { type: 'number', title: 'Recede (frames)', default: 14, minimum: 1, maximum: 120, step: 1, group: 'Motion' },
    assembleDuration: { type: 'number', title: 'Slide left (frames)', default: 30, minimum: 1, maximum: 120, step: 1, group: 'Motion' },
    wordDelay: { type: 'number', title: 'Second word delay (frames)', default: 7, minimum: 0, maximum: 60, step: 1, group: 'Motion' },
    wordStagger: { type: 'number', title: 'Word stagger (frames)', default: 4, minimum: 0, maximum: 30, step: 1, group: 'Motion' },
    wordDuration: { type: 'number', title: 'Word push (frames)', default: 14, minimum: 1, maximum: 60, step: 1, group: 'Motion' },
    wordPush: { type: 'number', title: 'Word push distance (em)', default: 0.5, minimum: 0, maximum: 3, step: 0.05, group: 'Motion' },
    wordFade: { type: 'number', title: 'Word fade (frames)', default: 2, minimum: 0, maximum: 30, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const fontSize = Number(p.fontSize);
    const initialScale = Number(p.initialScale);
    const pushScale = Number(p.pushScale);
    const holdDuration = Number(p.holdDuration);
    const recedeDuration = Number(p.recedeDuration);
    const assembleDuration = Number(p.assembleDuration);
    const wordDelay = Number(p.wordDelay);
    const wordStagger = Number(p.wordStagger);
    const wordDuration = Number(p.wordDuration);
    const wordPush = Number(p.wordPush);
    const wordFade = Number(p.wordFade);
    const introDuration = Number(p.introDuration);
    const speed = Number(p.speed);
    const face = S.pick(p.fontFamily, '-apple-system, BlinkMacSystemFont, sans-serif');
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const PUSH_EASE = S.Easing.bezier(0.25, 1, 0.5, 1);
    const ZOOM_EASE = S.Easing.bezier(0.5, 0, 0.05, 1);
    const WORD_EASE = S.Easing.bezier(0.22, 0.8, 0.36, 1);

    const words = String(p.text).split(' ').filter(Boolean);
    const wordEls = words.map((word, i) => S.h('span', { style: { display: 'inline-block', whiteSpace: 'pre' } }, word, i < words.length - 1 ? ' ' : ''));
    const ruler = S.h('span', { style: { display: 'inline-block', width: 0, height: 0 } });
    const line = S.h('span', { style: { position: 'relative', display: 'inline-block', fontSize, fontWeight: Number(p.fontWeight), color: S.pick(p.color, String(t.foreground)), letterSpacing: String(p.letterSpacing), lineHeight: 1.1, whiteSpace: 'nowrap', fontFamily: face, textRendering: 'geometricPrecision' } }, wordEls, ruler) as HTMLElement;
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center', background: 'transparent' }, line));

    const lead = wordEls[0] as HTMLElement | undefined;
    const measure = () => {
      const lineWidth = line.offsetWidth || view.width * 0.5;
      const leadRatio = lead ? (lead.offsetLeft + lead.offsetWidth / 2) / lineWidth : 0.14;
      const baseline = (ruler as HTMLElement).offsetTop || fontSize * 0.88;
      return { leadRatio, baseline, slideDistance: lineWidth * (0.5 - leadRatio) };
    };

    return (at) => {
      const frame = at * speed;
      const { leadRatio, baseline, slideDistance } = measure();
      line.style.transformOrigin = `${leadRatio * 100}% ${baseline}px`;
      const scale = S.interpolate(frame, [0, holdDuration], [initialScale, initialScale * pushScale], { ...clamped, easing: PUSH_EASE }) + S.interpolate(frame, [holdDuration, holdDuration + recedeDuration], [0, 1 - initialScale * pushScale], { ...clamped, easing: ZOOM_EASE });
      line.style.scale = String(scale);
      line.style.translate = `${S.interpolate(frame, [holdDuration, holdDuration + assembleDuration], [slideDistance, 0], { ...clamped, easing: ZOOM_EASE })}px`;

      wordEls.forEach((node, i) => {
        const el = node as HTMLElement;
        if (i === 0) {
          el.style.opacity = String(S.interpolate(frame, [0, introDuration], [0, 1], clamped));
          return;
        }
        const pushStart = holdDuration + wordDelay + (i - 1) * wordStagger;
        el.style.opacity = String(S.interpolate(frame, [pushStart, pushStart + wordFade], [0, 1], clamped));
        el.style.translate = `${S.interpolate(frame, [pushStart, pushStart + wordDuration], [wordPush * fontSize, 0], { ...clamped, easing: WORD_EASE })}px`;
      });
    };
  }
};
