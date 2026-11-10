import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'agent-steps',
  title: 'Agent steps',
  about: 'A prompt pill lands, an agent works through its steps row by row, then the list clears and a single result chip glints in.',
  category: SnapcnCategory.Ai,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 160,
  background: '#faf9f6',
  fonts: ['Inter'],
  props: {
    query: { type: 'string', title: 'Prompt', default: 'A 30-second launch video for a Next.js analytics dashboard', group: 'Content', maxLength: 200 },
    steps: { type: 'string', title: 'Steps (running > done @globe; ...)', default: 'Searching the registry… > Searched the registry @globe; Looking up components matching “dashboard”… > Looked up 6 matching components; Reading the docs… > Read 4 component docs @globe; Checking available props… > Checked available props; Building the timeline… > Set 9 scene timings; Rendering frames… > Rendered frames', group: 'Content', maxLength: 1200 },
    stepHolds: { type: 'string', title: 'Step holds in s (comma separated)', default: '0.67, 0.52, 0.4, 0.27, 0.35', group: 'Motion', maxLength: 200 },
    result: { type: 'string', title: 'Result', default: 'Rendered 900 frames', group: 'Content', maxLength: 120 },
    queryHold: { type: 'number', title: 'Prompt hold (s)', default: 0.683, minimum: 0, maximum: 10, step: 0.01, group: 'Motion' },
    stepHold: { type: 'number', title: 'Default step hold (s)', default: 0.45, minimum: 0, maximum: 10, step: 0.01, group: 'Motion' },
    finalHold: { type: 'number', title: 'Last step hold (s)', default: 0.283, minimum: 0, maximum: 10, step: 0.01, group: 'Motion' },
    paperColor: { type: 'string', title: 'Paper (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    glowColor: { type: 'string', title: 'Glow (transparent = mixed accent)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    glowX: { type: 'number', title: 'Glow x (0-1)', default: 0.858, minimum: 0, maximum: 1, step: 0.01, group: 'Style' },
    glowY: { type: 'number', title: 'Glow y (0-1)', default: 0.854, minimum: 0, maximum: 1, step: 0.01, group: 'Style' },
    glowRadius: { type: 'number', title: 'Glow radius (of height)', default: 0.465, minimum: 0, maximum: 3, step: 0.01, group: 'Style' },
    pillColor: { type: 'string', title: 'Pill (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    inkColor: { type: 'string', title: 'Ink (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    stepColor: { type: 'string', title: 'Step text (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    centerY: { type: 'number', title: 'Centre y (0-1)', default: 0.5, minimum: 0, maximum: 1, step: 0.01, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const FACE = 'Agent Steps Inter';
    const FACE_URL = 'https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2';
    if (typeof FontFace !== 'undefined' && ![...document.fonts].some((f) => f.family === FACE || f.family === `"${FACE}"`)) {
      const loaded = new FontFace(FACE, `url(${FACE_URL}) format("woff2")`, { weight: '100 900' });
      document.fonts.add(loaded);
      loaded.load().catch(() => undefined);
    }
    const face = S.pick(p.fontFamily, `"${FACE}"`);

    const ROW_PITCH = 0.0738;
    const PILL_H = 0.0553;
    const RESULT_PILL_H = 0.0691;
    const PILL_R = 0.28;
    const PILL_PAD = 0.42;
    const RESULT_PAD = 0.271;
    const ICON = 0.0314;
    const ICON_GAP = 0.0136;
    const FONT = 0.0254;
    const QUERY_FONT_SCALE = 0.878;
    const RESULT_FONT_SCALE = 1.196;
    const SHIFT_S = 0.308;
    const SHIFT_EASE = S.Easing.bezier(0.3, 0.7, 0.3, 1);
    const ROW_FADE_S = 0.242;
    const INTRO_S = 0.375;
    const INTRO_BLUR_S = 0.2;
    const INTRO_SCALE = 1.31;
    const INTRO_BLUR = 0.0141;
    const OUTRO_EASE = S.Easing.bezier(0.3, 0, 0.3, 1);
    const OUTRO_SCALE_S = 0.5;
    const OUTRO_POS_S = 0.6;
    const OUTRO_SCALE = 1.4;
    const OUTRO_FADE_EASE = S.Easing.bezier(0.35, 0, 0.25, 0.9);
    const OUTRO_FADE_S = 0.467;
    const HANDOFF_AT = 0.667;
    const HANDOFF_S = 0.167;
    const RESULT_AT = 0.75;
    const RESULT_S = 0.033;
    const GLINT_AT = 0.95;
    const GLINT_S = 0.42;
    const GLINT_R = 0.06;
    const RUNNING_ICON = 0.17;
    const GLOBE_W = 1.35;
    const CHECK_W = 2.2;
    const SPIN_S = 2;
    const outCubic = S.Easing.out(S.Easing.cubic);

    const holdList = String(p.stepHolds).split(',').map((s) => s.trim()).filter(Boolean).map(Number);
    const steps = String(p.steps).split(';').map((s) => s.trim()).filter(Boolean).map((entry, i) => {
      const icon = /@globe$/.test(entry) ? 'globe' : 'check';
      const body = entry.replace(/@globe$/, '').trim();
      const split = body.indexOf('>');
      const running = (split < 0 ? body : body.slice(0, split)).trim();
      const done = (split < 0 ? body : body.slice(split + 1)).trim();
      const hold = Number.isFinite(holdList[i]) ? holdList[i] : Number(p.stepHold);
      return { running, done, icon, hold };
    });

    const { fps, width, height } = view;
    const paper = S.pick(p.paperColor, String(t.background));
    const pill = S.pick(p.pillColor, String(t.card));
    const ink = S.pick(p.inkColor, String(t.foreground));
    const muted = S.pick(p.stepColor, String(t.mutedForeground));
    const accent = S.pick(p.accentColor, String(t.primary));
    const glow = S.pick(p.glowColor, S.mixOklch(paper, accent, 0.17));
    const glowRadius = Number(p.glowRadius);
    const centerY = Number(p.centerY);
    const speed = Number(p.speed);

    const pitch = ROW_PITCH * height;
    const font = FONT * height;
    const iconSize = ICON * height;
    const shiftF = SHIFT_S * fps;

    const sched: { enter: number; done: number }[] = [];
    let cursor = Number(p.queryHold) * fps;
    steps.forEach((s, i) => {
      const last = i === steps.length - 1;
      const done = cursor + (last ? Number(p.finalHold) * fps : s.hold * fps);
      sched.push({ enter: cursor, done: last ? Number.POSITIVE_INFINITY : done });
      cursor = done + 1;
    });
    const outro = cursor - 1;
    const lastIndex = steps.length - 1;

    const ramp = (fc: number, at: number, dur: number) => (dur <= 0 ? (fc >= at ? 1 : 0) : Math.max(0, Math.min(1, (fc - at) / dur)));
    const columnOffset = (fc: number) => sched.reduce((sum, s) => (fc <= s.enter ? sum : sum + SHIFT_EASE(Math.min(1, (fc - s.enter) / shiftF))), 0);

    const icon = (size: number, color: string, strokeWidth: number, ...kids: Element[]) => S.h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', style: { display: 'block', flexShrink: 0 } }, ...kids);
    const check = (size: number) => icon(size, accent, CHECK_W, S.h('path', { d: 'M20 6 9 17l-5-5' }));
    const globe = (turn: number) => {
      const k = Math.cos(turn * Math.PI * 2);
      return icon(iconSize, muted, GLOBE_W, S.h('circle', { cx: 12, cy: 12, r: 10 }), S.h('path', { d: 'M2 12h20' }), S.h('path', { d: 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20', transform: `translate(12 0) scale(${k} 1) translate(-12 0)` }));
    };

    const rowStyle = { height: pitch, display: 'flex', alignItems: 'center', gap: ICON_GAP * height, whiteSpace: 'nowrap', flexShrink: 0 };
    const label = { fontFamily: face, fontSize: font, fontWeight: 400, lineHeight: 1, letterSpacing: '0em' };

    const stage = S.fill({ backgroundColor: paper, overflow: 'hidden' }) as HTMLElement;
    view.root.replaceChildren(stage);

    const stepRow = (fc: number, i: number, settledOpacity: number, handoff: number, centred: number) => {
      const s = sched[i];
      const step = steps[i];
      if (fc <= s.enter) {
        return null;
      }
      const isDone = fc >= s.done;
      const isLast = i === lastIndex;
      const opacity = outCubic(ramp(fc, s.enter, ROW_FADE_S * fps)) * (isLast ? 1 - handoff : settledOpacity);
      const mark = isDone && step.icon === 'check' ? check(iconSize) : S.h('div', { style: { opacity: isDone ? 1 : RUNNING_ICON } }, globe(isDone ? 0 : (fc / (SPIN_S * fps)) % 1));
      const inner = S.h('div', { style: { ...rowStyle, height: pitch, transform: isLast ? `translateX(${-50 * centred}%)` : undefined } }, mark, S.h('span', { style: { ...label, color: muted } }, isDone ? step.done : step.running));
      return S.h('div', { style: { ...rowStyle, width: '100%', opacity, transform: isLast ? `translateX(${50 * centred}%)` : undefined } }, inner);
    };

    const resultChip = (fc: number) => {
      const resultIn = ramp(fc, outro + RESULT_AT * fps, RESULT_S * fps);
      if (resultIn <= 0) {
        return null;
      }
      const glint = ramp(fc, outro + GLINT_AT * fps, GLINT_S * fps);
      const shine = glint > 0 && glint < 1 ? S.h('div', { style: { position: 'absolute', inset: 0, background: `radial-gradient(circle ${GLINT_R * height}px at ${glint * 130 - 15}% 50%, ${accent} 0%, transparent 100%)`, opacity: 0.22 * S.interpolate(glint, [0, 0.08, 0.85, 1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) } }) : null;
      const chip = S.h('div', { style: { position: 'absolute', top: centerY * height - (RESULT_PILL_H * height) / 2, display: 'flex', alignItems: 'center', gap: ICON_GAP * RESULT_FONT_SCALE * height, height: RESULT_PILL_H * height, padding: `0 ${RESULT_PAD * PILL_H * height}px`, borderRadius: PILL_R * RESULT_PILL_H * height, background: pill, opacity: resultIn, overflow: 'hidden', whiteSpace: 'nowrap' } }, shine, check(iconSize * RESULT_FONT_SCALE), S.h('span', { style: { ...label, fontSize: font * RESULT_FONT_SCALE, fontWeight: 500, color: ink, position: 'relative' } }, String(p.result)));
      return S.fill({ alignItems: 'center', justifyContent: 'center' }, chip);
    };

    return (frame) => {
      const fc = frame * speed;
      const offset = columnOffset(fc);
      const scale = S.interpolate(OUTRO_EASE(ramp(fc, outro, OUTRO_SCALE_S * fps)), [0, 1], [1, OUTRO_SCALE]);
      const centred = OUTRO_EASE(ramp(fc, outro, OUTRO_POS_S * fps));
      const settledOpacity = 1 - OUTRO_FADE_EASE(ramp(fc, outro, OUTRO_FADE_S * fps));
      const introE = outCubic(ramp(fc, 0, INTRO_S * fps));
      const introBlur = INTRO_BLUR * height * (1 - outCubic(ramp(fc, 0, INTRO_BLUR_S * fps)));
      const handoff = ramp(fc, outro + HANDOFF_AT * fps, HANDOFF_S * fps);

      const glowLayer = glowRadius > 0 ? S.fill({ background: `radial-gradient(circle ${glowRadius * height}px at ${Number(p.glowX) * width}px ${Number(p.glowY) * height}px, ${glow} 0%, ${paper} 100%)`, opacity: introE }) : null;
      const queryRow = S.h('div', { style: { ...rowStyle, opacity: introE * settledOpacity, filter: introBlur > 0.01 ? `blur(${introBlur}px)` : undefined, transform: `scale(${S.interpolate(introE, [0, 1], [INTRO_SCALE, 1])})` } },
        S.h('div', { style: { ...label, fontSize: font * QUERY_FONT_SCALE, fontWeight: 500, color: ink, background: pill, height: PILL_H * height, borderRadius: PILL_R * PILL_H * height, padding: `0 ${PILL_PAD * PILL_H * height}px`, display: 'flex', alignItems: 'center' } }, String(p.query)));
      const column = S.h('div', { style: { position: 'absolute', top: centerY * height - pitch / 2, display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', transform: `translateY(${-offset * pitch}px) scale(${scale})`, transformOrigin: `50% ${(offset + 0.5) * pitch}px` } }, queryRow, steps.map((_, i) => stepRow(fc, i, settledOpacity, handoff, centred)));
      stage.replaceChildren(...[glowLayer, S.fill({ alignItems: 'center', justifyContent: 'flex-start' }, column), resultChip(fc)].filter((n): n is Element => Boolean(n)));
    };
  }
};
