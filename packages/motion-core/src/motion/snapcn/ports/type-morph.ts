import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'type-morph',
  title: 'Type morph',
  about: 'A line reveals, its bold word slides to centre, its letters morph into a new phrase, then it cuts to the last word.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#faf9f6',
  fonts: ['Inter'],
  props: {
    lead: { type: 'string', title: 'Lead', default: 'Not just ', group: 'Content', maxLength: 80 },
    emphasis: { type: 'string', title: 'Emphasis', default: 'communicator.', group: 'Content', maxLength: 80 },
    morphTo: { type: 'string', title: 'Morphs into', default: 'something more.', group: 'Content', maxLength: 80 },
    finally_: { type: 'string', title: 'Final word', default: 'more.', group: 'Content', maxLength: 80 },
    size: { type: 'number', title: 'Type size (share of height)', default: 0.1256, minimum: 0.02, maximum: 0.5, step: 0.001, group: 'Style' },
    ink: { type: 'string', title: 'Ink (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    paper: { type: 'string', title: 'Paper (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    floodA: { type: 'string', title: 'Flood first (transparent = off)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    floodB: { type: 'string', title: 'Flood second', format: PropFormat.Color, default: '#4931f2', group: 'Style' },
    wordOnFlood: { type: 'boolean', title: 'Keep word on flood', default: false, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const SLIDE_FROM = 39;
    const SLIDE_TO = 55;
    const CUT_AT = 44;
    const MORPH_FROM = 56;
    const MORPH_TO = 67;
    const EXIT_FROM = 72;
    const EXIT_RATIO = 1.76456;
    const EXIT_COEFF = 1.3194;
    const CUT2_AT = 81;
    const FLOOD_STAGE_FRAMES = 4;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const EASE = S.Easing.bezier(0.2, 0.6, 0.35, 1);
    const SLIDE_EASE = S.Easing.bezier(0.3438, 0.0294, 0.032, 0.9269);
    const CRISP = { textRendering: 'geometricPrecision', WebkitFontSmoothing: 'antialiased' };

    const lead = String(p.lead);
    const emphasis = String(p.emphasis);
    const morphTo = String(p.morphTo);
    const finally_ = String(p.finally_);
    const typed = lead + emphasis;
    const face = S.pick(p.fontFamily, 'Inter');
    const paper = S.pick(p.paper, String(t.background));
    const type = S.pick(p.ink, String(t.foreground));
    const flood = S.pick(p.floodA, '') ? [String(p.floodA), String(p.floodB)] : null;
    const fontSize = view.height * Number(p.size);
    const centre = view.width / 2;

    const probe = S.h('div', { 'aria-hidden': 'true', style: { position: 'absolute', visibility: 'hidden', pointerEvents: 'none', whiteSpace: 'pre', fontFamily: face, fontSize, letterSpacing: '-0.035em', ...CRISP } }, [typed, emphasis, morphTo, finally_].map((s) => S.h('div', { style: { whiteSpace: 'pre' } }, [...s].map((ch) => S.h('span', { style: { display: 'inline-block' } }, ch))))) as HTMLElement;

    const words = typed.split(' ').filter(Boolean);
    const wordEls = words.map((word, i) => S.h('span', { style: { display: 'inline-block', whiteSpace: 'pre' } }, word, i < words.length - 1 ? ' ' : '') as HTMLElement);
    const ruler = S.h('span', { style: { display: 'inline-block', width: 0, height: 0 } }) as HTMLElement;
    const line = S.h('span', { style: { position: 'relative', display: 'inline-block', fontSize, fontWeight: 600, color: type, letterSpacing: '-0.03em', lineHeight: 1.1, whiteSpace: 'nowrap', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', textRendering: 'geometricPrecision' } }, wordEls, ruler) as HTMLElement;
    const reveal = S.fill({ alignItems: 'center', justifyContent: 'center', background: 'transparent' }, line) as HTMLElement;
    const glyphs = S.h('div', { style: { position: 'absolute', top: '50%', left: 0, right: 0, height: 0, fontSize, lineHeight: 1, letterSpacing: '-0.035em' } }) as HTMLElement;
    const stage = S.fill({ background: paper, fontFamily: face, fontOpticalSizing: 'none', ...CRISP }, probe, reveal, glyphs) as HTMLElement;
    view.root.replaceChildren(stage);

    const renderReveal = (frame: number) => {
      const lineWidth = line.offsetWidth || view.width * 0.5;
      const lead0 = wordEls[0];
      const leadRatio = lead0 ? (lead0.offsetLeft + lead0.offsetWidth / 2) / lineWidth : 0.14;
      const baseline = ruler.offsetTop || fontSize * 0.88;
      const ZOOM = S.Easing.bezier(0.5, 0, 0.05, 1);
      line.style.transformOrigin = `${leadRatio * 100}% ${baseline}px`;
      line.style.scale = String(S.interpolate(frame, [0, 12], [2.3, 2.3 * 1.06], { ...clamped, easing: S.Easing.bezier(0.25, 1, 0.5, 1) }) + S.interpolate(frame, [12, 26], [0, 1 - 2.3 * 1.06], { ...clamped, easing: ZOOM }));
      line.style.translate = `${S.interpolate(frame, [12, 42], [lineWidth * (0.5 - leadRatio), 0], { ...clamped, easing: ZOOM })}px`;
      wordEls.forEach((el, i) => {
        if (i === 0) {
          el.style.opacity = String(S.interpolate(frame, [0, 6], [0, 1], clamped));
          return;
        }
        const start = 12 + 7 + (i - 1) * 4;
        el.style.opacity = String(S.interpolate(frame, [start, start + 2], [0, 1], clamped));
        el.style.translate = `${S.interpolate(frame, [start, start + 14], [0.5 * fontSize, 0], { ...clamped, easing: S.Easing.bezier(0.22, 0.8, 0.36, 1) })}px`;
      });
    };

    const pairGlyphs = (from: string, to: string) => {
      const used = new Set<number>();
      return [...to].map((ch, ti) => {
        let best: number | null = null;
        let bestDist = Infinity;
        for (let fi = 0; fi < from.length; fi += 1) {
          if (used.has(fi) || from[fi] !== ch) {
            continue;
          }
          const dist = Math.abs(fi - ti);
          if (dist < bestDist) {
            bestDist = dist;
            best = fi;
          }
        }
        if (best !== null) {
          used.add(best);
        }
        return best;
      });
    };

    const glyph = (ch: string, x: number, lineWidth: number, style: Record<string, string | number>) => S.h('span', { style: { position: 'absolute', left: centre - lineWidth / 2 + x, top: 0, whiteSpace: 'pre', ...style } }, ch);

    const content = (frame: number, phase: string, floodColor: string | null) => {
      const [typedX, emphX, morphX, finalX] = [...probe.children].map((l) => [...l.children].map((g) => (g as HTMLElement).offsetLeft));
      const widthOf = (xs: number[], str: string) => (xs[str.length - 1] ?? 0) + fontSize * 0.34;
      const wTyped = widthOf(typedX, typed);
      const wEmph = widthOf(emphX, emphasis);
      const wMorph = widthOf(morphX, morphTo);
      const emphInTyped = typedX[lead.length] - wTyped / 2 + wEmph / 2;
      const bold = { color: type, fontWeight: 700 };
      if (phase === 'type') {
        return [];
      }
      if (phase === 'slide') {
        const dx = -emphInTyped * (1 - S.interpolate(frame, [SLIDE_FROM, SLIDE_TO], [0, 1], { ...clamped, easing: SLIDE_EASE }));
        return [...emphasis].map((ch, i) => glyph(ch, emphX[i] + dx, wEmph, bold));
      }
      if (phase === 'morph') {
        const q = S.interpolate(frame, [MORPH_FROM, MORPH_TO], [0, 1], { ...clamped, easing: EASE });
        const w = S.interpolate(q, [0, 1], [wEmph, wMorph]);
        const pairs = pairGlyphs(emphasis, morphTo);
        const matched = new Set(pairs.filter((x): x is number => x !== null));
        const leaving = [...emphasis].map((ch, i) => (matched.has(i) ? null : glyph(ch, emphX[i] + (wEmph - w) / 2, w, { ...bold, opacity: S.interpolate(q, [0, 0.45], [1, 0], { extrapolateRight: 'clamp' }) })));
        const arriving = [...morphTo].map((ch, i) => {
          const src = pairs[i];
          const to = morphX[i] + (wMorph - w) / 2;
          if (src === null) {
            return glyph(ch, to, w, { ...bold, opacity: S.interpolate(q, [0.55, 1], [0, 1], clamped) });
          }
          return glyph(ch, S.interpolate(q, [0, 1], [emphX[src] + (wEmph - w) / 2, to]), w, bold);
        });
        return [...leaving, ...arriving].filter((e): e is Element => e !== null);
      }
      if (phase === 'flood' && !p.wordOnFlood) {
        return [];
      }
      const w = widthOf(finalX, finally_);
      return [...finally_].map((ch, i) => glyph(ch, finalX[i], w, { fontWeight: 700, color: floodColor ? S.mixOklch(floodColor, String(t.background), 0.92) : type, opacity: 1 }));
    };

    return (frame) => {
      const floodAt = CUT2_AT + 1;
      const flooded = flood !== null && frame >= floodAt;
      const phase = flooded ? 'flood' : frame >= CUT2_AT ? 'final' : frame >= MORPH_FROM ? 'morph' : frame >= CUT_AT ? 'slide' : 'type';
      const floodColor = flood && flooded ? (frame >= floodAt + FLOOD_STAGE_FRAMES ? flood[1] : flood[0]) : null;
      stage.style.background = floodColor ?? paper;
      reveal.style.display = frame < CUT_AT ? 'flex' : 'none';
      if (frame < CUT_AT) {
        renderReveal(frame);
      }
      const drift = frame <= EXIT_FROM || frame >= CUT2_AT ? 0 : (-EXIT_COEFF * (EXIT_RATIO ** (frame - EXIT_FROM) - 1) * view.width) / 1400;
      glyphs.style.transform = `translate(${drift.toFixed(2)}px, ${-fontSize * 0.36}px)`;
      glyphs.replaceChildren(...content(frame, phase, floodColor));
    };
  }
};
