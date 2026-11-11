import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'character-jumping',
  title: 'Character jumping',
  about: 'A round-headed character hops with squash and stretch, sparkles at each peak and a shadow that shrinks in the air.',
  category: RendercompCategory.Loop,
  width: 1080,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#e0f2fe',
  fonts: [],
  props: {
    label: { type: 'string', title: 'Label', default: "Let's Go!", group: 'Content', maxLength: 40 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#e0f2fe', group: 'Style' },
    characterColor: { type: 'string', title: 'Character', format: PropFormat.Color, default: '#0ea5e9', group: 'Style' },
    shadowColor: { type: 'string', title: 'Shadow and pupils', format: PropFormat.Color, default: '#0369a1', group: 'Style' },
    accentColor: { type: 'string', title: 'Sparkles', format: PropFormat.Color, default: '#fbbf24', group: 'Style' },
    groundColor: { type: 'string', title: 'Ground', format: PropFormat.Color, default: '#bae6fd', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#0c4a6e', group: 'Style' },
    jumpCount: { type: 'number', title: 'Jumps', default: 3, minimum: 1, maximum: 12, step: 1, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const FPS = 30;
    const DURATION = 120;
    const FIRST_JUMP = 8;
    const SPARKLES = 6;
    const width = view.width;
    const height = view.height;
    const FONT = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const characterColor = String(p.characterColor);
    const shadowColor = String(p.shadowColor);
    const jumpCount = Math.max(1, Number(p.jumpCount));

    const scale = Math.min(width, height);
    const cx = width / 2;
    const groundY = height * 0.62;
    const headR = scale * 0.075;
    const bodyW = scale * 0.1;
    const bodyH = scale * 0.14;
    const legW = scale * 0.035;
    const legH = scale * 0.07;
    const maxJumpH = scale * 0.28;
    const jumpPeriod = Math.round((DURATION - FIRST_JUMP) / jumpCount);
    const legLeftX = cx - bodyW * 0.3 - legW;
    const legRightX = cx + bodyW * 0.3;

    const jumpHeight = (t: number) => Math.max(0, -4 * t * t + 4 * t);
    const svg = (tag: string, attrs: Record<string, unknown>) => S.h(tag, attrs) as unknown as SVGElement;
    const set = (el: SVGElement, attrs: Record<string, number | string>) => {
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    };

    const ground = S.h('div', { style: { position: 'absolute', bottom: height - groundY, left: 0, right: 0, top: groundY, backgroundColor: String(p.groundColor), borderRadius: '50% 50% 0 0 / 10% 10% 0 0' } });

    const sparkles = Array.from({ length: SPARKLES }, () => svg('circle', { r: scale * 0.015, fill: String(p.accentColor) }));
    const sparkleLayer = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', display: 'none' } }, sparkles) as unknown as HTMLElement;

    const shadow = svg('ellipse', { cx, cy: groundY + 8, ry: scale * 0.018, fill: shadowColor });
    const legLeft = svg('rect', { x: legLeftX, width: legW, rx: legW / 2, fill: characterColor });
    const legRight = svg('rect', { x: legRightX, width: legW, rx: legW / 2, fill: characterColor });
    const bodyRect = svg('rect', { x: cx - bodyW / 2, width: bodyW, height: bodyH, rx: bodyW * 0.28, fill: characterColor });
    const head = svg('circle', { cx, r: headR, fill: characterColor });
    const eyeLeft = svg('circle', { cx: cx - headR * 0.28, r: headR * 0.14, fill: '#fff' });
    const eyeRight = svg('circle', { cx: cx + headR * 0.28, r: headR * 0.14, fill: '#fff' });
    const pupilLeft = svg('circle', { cx: cx - headR * 0.28, r: headR * 0.07, fill: shadowColor });
    const pupilRight = svg('circle', { cx: cx + headR * 0.28, r: headR * 0.07, fill: shadowColor });
    const smile = svg('path', { stroke: '#fff', strokeWidth: headR * 0.12, strokeLinecap: 'round', fill: 'none' });
    const body = svg('g', {});
    [bodyRect, head, eyeLeft, eyeRight, pupilLeft, pupilRight, smile].forEach((el) => body.appendChild(el));

    const character = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } }, shadow, legLeft, legRight, body) as unknown as HTMLElement;

    const label = String(p.label);
    const labelEl = S.h('div', { style: { position: 'absolute', bottom: height * 0.05, fontFamily: FONT, fontSize: scale * 0.065, fontWeight: 800, color: String(p.textColor), letterSpacing: -0.5, textAlign: 'center' } }, label) as HTMLElement;

    view.root.replaceChildren(S.fill({ backgroundColor: String(p.backgroundColor), alignItems: 'center', justifyContent: 'flex-end', paddingBottom: height * 0.08 }, ground, sparkleLayer, character, label ? labelEl : null));

    return (frame) => {
      const frameInCycle = (frame - FIRST_JUMP) % jumpPeriod;
      const t = Math.max(0, Math.min(1, frameInCycle / (jumpPeriod * 0.85)));
      const rawJump = frame >= FIRST_JUMP ? jumpHeight(t) : 0;
      const jumpOffset = rawJump * maxJumpH;

      const isAscending = frameInCycle < jumpPeriod * 0.42;
      const stretchY = 1 + rawJump * 0.32;
      const stretchX = 1 - rawJump * 0.18;
      const landProgress = isAscending ? 0 : S.interpolate(rawJump, [0, 0.12], [1, 0], clamped);
      const scaleX = stretchX * (1 + landProgress * 0.22);
      const scaleY = stretchY * (1 - landProgress * 0.28);

      const bodyBottom = groundY - jumpOffset;
      const bodyTopY = bodyBottom - bodyH;
      const headCenterY = bodyTopY - headR * 0.9;
      const headY = headCenterY - jumpOffset;
      const legBend = rawJump * 0.5;
      const legHeight = legH * (1 + legBend);

      const shadowWidth = (bodyW * 1.4 + legW * 2.4) * (1 - rawJump * 0.55);
      set(shadow, { rx: shadowWidth / 2, opacity: 0.35 * (1 - rawJump * 0.65) });

      const legY = groundY - jumpOffset - legHeight;
      const legTransform = `scaleY(${scaleY}) scaleX(${scaleX})`;
      set(legLeft, { y: legY, height: legHeight });
      set(legRight, { y: legY, height: legHeight });
      (legLeft as unknown as HTMLElement).style.transform = legTransform;
      (legLeft as unknown as HTMLElement).style.transformOrigin = `${legLeftX + legW / 2}px ${groundY - jumpOffset}px`;
      (legRight as unknown as HTMLElement).style.transform = legTransform;
      (legRight as unknown as HTMLElement).style.transformOrigin = `${legRightX + legW / 2}px ${groundY - jumpOffset}px`;

      const pivotY = bodyBottom - jumpOffset;
      set(body, { transform: `translate(${cx} ${pivotY}) scale(${scaleX} ${scaleY}) translate(${-cx} ${-pivotY})` });
      set(bodyRect, { y: bodyTopY - jumpOffset });
      set(head, { cy: headY });
      set(eyeLeft, { cy: headY - headR * 0.08 });
      set(eyeRight, { cy: headY - headR * 0.08 });
      set(pupilLeft, { cy: headY - headR * 0.04 });
      set(pupilRight, { cy: headY - headR * 0.04 });
      set(smile, { d: `M ${cx - headR * 0.3} ${headY + headR * 0.22} Q ${cx} ${headY + headR * (0.42 + rawJump * 0.18)} ${cx + headR * 0.3} ${headY + headR * 0.22}` });

      const entry = S.spring({ frame, fps: FPS, config: { damping: 14, stiffness: 80, mass: 1 }, durationInFrames: 14 });
      character.style.transform = `translateY(${S.interpolate(entry, [0, 1], [scale * 0.2, 0])}px)`;
      character.style.opacity = String(entry);

      const labelIn = S.spring({ frame: frame - 4, fps: FPS, config: { damping: 14, stiffness: 70 }, durationInFrames: 18 });
      labelEl.style.opacity = String(labelIn);
      labelEl.style.transform = `translateY(${S.interpolate(labelIn, [0, 1], [16, 0])}px)`;

      const sparkleActive = rawJump > 0.88;
      sparkleLayer.style.display = sparkleActive ? 'block' : 'none';
      if (!sparkleActive) {
        return;
      }

      const sparkleT = frame * 0.2;
      sparkles.forEach((dot, i) => {
        const angle = (i / SPARKLES) * Math.PI * 2 + sparkleT;
        const dist = scale * 0.14;
        set(dot, { cx: cx + Math.cos(angle) * dist - jumpOffset * 0.05, cy: headY + Math.sin(angle) * dist * 0.6, opacity: 0.8 + Math.sin(sparkleT + i) * 0.2 });
      });
    };
  }
};
