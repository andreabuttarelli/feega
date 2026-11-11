import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'thinking-bubble',
  title: 'Thinking bubble',
  about: 'A character tilts its head back as small bubbles chain up into a big thought bubble where three dots blink in turn and a caption fades in.',
  category: RendercompCategory.Loop,
  width: 1080,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#fafaf9',
  fonts: [],
  props: {
    thoughtText: { type: 'string', title: 'Thought text', default: 'Hmm...', group: 'Content', maxLength: 60 },
    showText: { type: 'boolean', title: 'Show text', default: true, group: 'Content' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#fafaf9', group: 'Style' },
    characterColor: { type: 'string', title: 'Character', format: PropFormat.Color, default: '#78716c', group: 'Style' },
    bubbleColor: { type: 'string', title: 'Bubble', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    bubbleBorder: { type: 'string', title: 'Bubble border', format: PropFormat.Color, default: '#d6d3d1', group: 'Style' },
    dotColor: { type: 'string', title: 'Dots', format: PropFormat.Color, default: '#a8a29e', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#44403c', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const FPS = 30;
    const width = view.width;
    const height = view.height;
    const FONT = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const CUBIC_OUT = S.Easing.out(S.Easing.cubic);
    const backgroundColor = String(p.backgroundColor);
    const characterColor = String(p.characterColor);
    const bubbleColor = String(p.bubbleColor);
    const bubbleBorder = String(p.bubbleBorder);
    const dotColor = String(p.dotColor);
    const thoughtText = String(p.thoughtText);
    const DEFAULT_BACKGROUND = '#fafaf9';
    const DOT_PERIOD = 24;
    const DOTS_START = 44;
    const GROUND_FILL_ALPHA = 0x18 / 255;
    const GROUND_LINE_ALPHA = 0x28 / 255;

    const scale = Math.min(width, height);
    const cx = width * 0.42;
    const groundY = height * 0.68;
    const headR = scale * 0.07;
    const bodyW = scale * 0.09;
    const bodyH = scale * 0.12;
    const bodyBottom = groundY;
    const bodyTop = bodyBottom - bodyH;
    const headCY = bodyTop - headR * 0.9;

    const trailBubbles = [
      { r: scale * 0.018, delay: 14, dx: scale * 0.09, dy: -scale * 0.09 },
      { r: scale * 0.028, delay: 20, dx: scale * 0.16, dy: -scale * 0.18 },
      { r: scale * 0.04, delay: 26, dx: scale * 0.22, dy: -scale * 0.3 }
    ];

    const bubbleW = scale * 0.42;
    const bubbleH = scale * 0.28;
    const bubbleX = cx + scale * 0.05;
    const bubbleY = groundY - bodyH - headR * 2 - bubbleH * 0.5 - scale * 0.38;

    const dotSpacing = bubbleW * 0.16;
    const dotR = scale * 0.022;
    const dotXs = [bubbleX + bubbleW / 2 - dotSpacing, bubbleX + bubbleW / 2, bubbleX + bubbleW / 2 + dotSpacing];
    const pupilColor = backgroundColor === DEFAULT_BACKGROUND ? '#292524' : '#fff';

    const svg = (tag: string, attrs: Record<string, unknown>) => S.h(tag, attrs) as unknown as SVGElement;
    const set = (el: SVGElement, attrs: Record<string, number | string>) => {
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    };
    const rect = (x: number, y: number, w: number, h: number, rx: number, extra: Record<string, unknown> = {}) => svg('rect', { x, y, width: w, height: h, rx, fill: characterColor, ...extra });

    const ground = S.h('div', { style: { position: 'absolute', top: groundY, left: 0, right: 0, bottom: 0, backgroundColor: S.withAlpha(characterColor, GROUND_FILL_ALPHA), borderTop: `2px solid ${S.withAlpha(characterColor, GROUND_LINE_ALPHA)}` } });

    const head = svg('circle', { cx, cy: headCY, r: headR, fill: characterColor });
    const trails = trailBubbles.map((b) => svg('circle', { cx: cx + b.dx, cy: headCY - headR + b.dy, fill: bubbleColor, stroke: bubbleBorder, strokeWidth: 1.5 }));
    const bubbleShape = svg('ellipse', { cx: bubbleX + bubbleW / 2, cy: bubbleY, rx: bubbleW / 2, ry: bubbleH / 2, fill: bubbleColor, stroke: bubbleBorder, strokeWidth: scale * 0.006 });
    const bubble = svg('g', {});
    bubble.appendChild(bubbleShape);
    const dots = dotXs.map((x) => svg('circle', { cx: x, cy: bubbleY, fill: dotColor }));

    const character = S.h(
      'svg',
      { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } },
      svg('ellipse', { cx, cy: groundY + 6, rx: bodyW * 0.7, ry: scale * 0.014, fill: characterColor, opacity: 0.2 }),
      rect(cx - bodyW * 0.32, bodyBottom - scale * 0.065, scale * 0.032, scale * 0.065, scale * 0.016),
      rect(cx + bodyW * 0.06, bodyBottom - scale * 0.065, scale * 0.032, scale * 0.065, scale * 0.016),
      rect(cx - bodyW / 2, bodyTop, bodyW, bodyH, bodyW * 0.28),
      rect(cx - bodyW / 2 - scale * 0.04, bodyTop + bodyH * 0.1, scale * 0.04, scale * 0.07, scale * 0.02, { transform: `rotate(-20 ${cx - bodyW / 2} ${bodyTop + bodyH * 0.2})` }),
      rect(cx + bodyW / 2, bodyTop + bodyH * 0.05, scale * 0.04, scale * 0.07, scale * 0.02, { transform: `rotate(50 ${cx + bodyW / 2} ${bodyTop + bodyH * 0.2})` }),
      head,
      svg('circle', { cx: cx - headR * 0.28, cy: headCY - headR * 0.18, r: headR * 0.12, fill: '#fff' }),
      svg('circle', { cx: cx + headR * 0.28, cy: headCY - headR * 0.18, r: headR * 0.12, fill: '#fff' }),
      svg('circle', { cx: cx - headR * 0.28, cy: headCY - headR * 0.24, r: headR * 0.07, fill: pupilColor }),
      svg('circle', { cx: cx + headR * 0.28, cy: headCY - headR * 0.24, r: headR * 0.07, fill: pupilColor }),
      svg('path', { d: `M ${cx - headR * 0.22} ${headCY + headR * 0.32} Q ${cx} ${headCY + headR * 0.28} ${cx + headR * 0.22} ${headCY + headR * 0.32}`, stroke: '#fff', strokeWidth: headR * 0.1, strokeLinecap: 'round', fill: 'none' }),
      trails,
      bubble,
      dots
    ) as unknown as HTMLElement;

    const textEl = S.h('div', { style: { position: 'absolute', top: bubbleY + bubbleH * 0.5 + scale * 0.04, left: bubbleX, width: bubbleW, textAlign: 'center', fontFamily: FONT, fontSize: scale * 0.04, fontWeight: 600, color: String(p.textColor), fontStyle: 'italic' } }, thoughtText) as HTMLElement;
    const showText = Boolean(p.showText) && thoughtText.length > 0;

    view.root.replaceChildren(S.fill({ backgroundColor }, ground, character, showText ? textEl : null));

    return (frame) => {
      const headTilt = S.interpolate(frame, [6, 24], [0, -12], { ...clamped, easing: CUBIC_OUT });
      set(head, { transform: `rotate(${headTilt} ${cx} ${headCY})` });

      const charEntry = S.spring({ frame, fps: FPS, config: { damping: 14, stiffness: 80 }, durationInFrames: 18 });
      character.style.transform = `translateY(${S.interpolate(charEntry, [0, 1], [scale * 0.1, 0])}px)`;
      character.style.opacity = String(charEntry);

      trailBubbles.forEach((b, i) => {
        const trailP = S.spring({ frame: frame - b.delay, fps: FPS, config: { damping: 10, stiffness: 140 }, durationInFrames: 12 });
        set(trails[i], { r: b.r * trailP, opacity: trailP });
      });

      const bubbleScale = S.spring({ frame: frame - 30, fps: FPS, config: { damping: 9, stiffness: 120, mass: 0.8 }, durationInFrames: 20 });
      const breathe = 1 + Math.sin(frame * 0.08) * 0.015;
      const grown = bubbleScale * breathe;
      bubble.style.display = bubbleScale > 0.01 ? '' : 'none';
      set(bubble, { transform: `scale(${grown}) translate(${bubbleX + (bubbleW / 2) * (1 - grown)} ${bubbleY + (bubbleH / 2) * (1 - grown)})` });

      const dotsOn = frame >= DOTS_START && bubbleScale > 0.5;
      dots.forEach((dot, i) => {
        dot.style.display = dotsOn ? '' : 'none';
        if (!dotsOn) {
          return;
        }

        const t = (frame - DOTS_START + i * DOT_PERIOD * 0.33) % DOT_PERIOD;
        const progress = S.interpolate(t, [0, DOT_PERIOD * 0.3, DOT_PERIOD * 0.6, DOT_PERIOD], [0.3, 1, 1, 0.3], clamped);
        set(dot, { r: dotR * progress, opacity: progress });
      });

      const textIn = S.spring({ frame: frame - 55, fps: FPS, config: { damping: 14, stiffness: 80 }, durationInFrames: 18 });
      textEl.style.opacity = String(textIn);
      textEl.style.transform = `translateY(${S.interpolate(textIn, [0, 1], [10, 0])}px)`;
    };
  }
};
