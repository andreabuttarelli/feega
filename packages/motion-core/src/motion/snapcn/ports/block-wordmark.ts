import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'block-wordmark',
  title: 'Block wordmark',
  about: 'A deck of rounded cards spins, splits into one block per letter, grows ascenders and flashes into the wordmark.',
  category: SnapcnCategory.Logo,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#faf9f6',
  fonts: ['Ultra'],
  props: {
    text: { type: 'string', title: 'Text', default: 'base', group: 'Content', maxLength: 40 },
    fontSize: { type: 'number', title: 'Font size (px)', default: 160, minimum: 20, maximum: 500, step: 1, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Ultra', group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 400, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    color: { type: 'string', title: 'Ink (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    colors: { type: 'string', title: 'Card colours (comma list, empty = theme)', default: '', group: 'Style', maxLength: 300 },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    blockGap: { type: 'number', title: 'Block gap (x-height)', default: 0.093, minimum: 0, maximum: 1, step: 0.001, group: 'Layout' },
    cornerRadius: { type: 'number', title: 'Corner radius (side)', default: 0.18, minimum: 0, maximum: 0.5, step: 0.01, group: 'Layout' },
    blockSizing: { type: 'string', title: 'Block sizing', enum: ['square', 'glyph'], default: 'square', group: 'Layout' },
    maxWidth: { type: 'number', title: 'Max width (frame share)', default: 0.92, minimum: 0.1, maximum: 1, step: 0.01, group: 'Layout' },
    cards: { type: 'number', title: 'Cards', default: 6, minimum: 1, maximum: 20, step: 1, group: 'Motion' },
    cardStagger: { type: 'number', title: 'Card stagger (frames)', default: 2, minimum: 0, maximum: 20, step: 1, group: 'Motion' },
    spinTurns: { type: 'number', title: 'Spin turns', default: 1, minimum: 0, maximum: 5, step: 0.25, group: 'Motion' },
    liftRatio: { type: 'number', title: 'Lift (side)', default: 0.665, minimum: 0, maximum: 3, step: 0.005, group: 'Motion' },
    growDuration: { type: 'number', title: 'Grow (frames)', default: 9, minimum: 1, maximum: 60, step: 1, group: 'Motion' },
    spinDuration: { type: 'number', title: 'Spin (frames)', default: 33, minimum: 1, maximum: 120, step: 1, group: 'Motion' },
    splitDuration: { type: 'number', title: 'Split (frames)', default: 5, minimum: 1, maximum: 60, step: 1, group: 'Motion' },
    splitStagger: { type: 'number', title: 'Split stagger (frames)', default: 1, minimum: 0, maximum: 20, step: 1, group: 'Motion' },
    ascenderDuration: { type: 'number', title: 'Ascender grow (frames)', default: 12, minimum: 1, maximum: 60, step: 1, group: 'Motion' },
    holdDuration: { type: 'number', title: 'Hold (frames)', default: 54, minimum: 0, maximum: 200, step: 1, group: 'Motion' },
    flashStagger: { type: 'number', title: 'Flash stagger (frames)', default: 4, minimum: 0, maximum: 30, step: 1, group: 'Motion' },
    flashDuration: { type: 'number', title: 'Flash (frames)', default: 3, minimum: 0, maximum: 30, step: 1, group: 'Motion' },
    flashToSwap: { type: 'number', title: 'Flash to letter (frames)', default: 5, minimum: 0, maximum: 30, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const num = (k: string) => Number(p[k]);
    const face = S.pick(p.fontFamily, 'Ultra');
    const fontSize = num('fontSize');
    const fontWeight = num('fontWeight');
    const ink = S.pick(p.color, String(t.foreground));
    const primary = String(t.primary);
    const theme = [primary, S.mixOklch(primary, '#000000', 0.3), S.mixOklch(primary, '#ffffff', 0.28), S.mixOklch(primary, '#000000', 0.55), S.mixOklch(primary, '#ffffff', 0.52)];
    const listed = String(p.colors ?? '').split(',').map((c) => c.trim()).filter(Boolean);
    const deck = listed.length ? listed : theme;
    const text = String(p.text);
    const chars = Array.from(text);
    const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const SPIN_EASE = S.Easing.bezier(0.76, 0, 0.24, 1);
    const OUT_EASE = S.Easing.out(S.Easing.cubic);
    const IN_EASE = S.Easing.in(S.Easing.cubic);
    const { width, height, fps } = view;
    type Tab = { height: number; x: number; width: number };
    type Glyph = { ch: string; blank: boolean; advance: number; tab: Tab | null };

    const measureInk = (glyphs: string[]) => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(fontSize * 3);
      canvas.height = Math.ceil(fontSize * 3);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        return null;
      }
      ctx.font = `${fontWeight} ${fontSize}px ${face}`;
      ctx.textBaseline = 'alphabetic';
      const xHeight = ctx.measureText('x').actualBoundingBoxAscent;
      const capHeight = ctx.measureText('H').actualBoundingBoxAscent;
      if (!(xHeight > 0) || !(capHeight > xHeight)) {
        return null;
      }
      const cut = (capHeight - xHeight) * 0.15;
      const origin = fontSize * 0.5;
      const baseline = Math.round(fontSize * 2);
      const tabs = new Map<string, Tab>();
      for (const ch of glyphs) {
        const m = ctx.measureText(ch);
        const h = m.actualBoundingBoxAscent - xHeight;
        if (!(h > cut)) {
          continue;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000';
        ctx.fillText(ch, origin, baseline);
        const top = Math.max(0, Math.floor(baseline - m.actualBoundingBoxAscent));
        const bottom = Math.min(canvas.height, top + Math.max(1, h * 0.6));
        const data = ctx.getImageData(0, top, canvas.width, Math.ceil(bottom - top)).data;
        let lo = Number.POSITIVE_INFINITY;
        let hi = Number.NEGATIVE_INFINITY;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] <= 8) {
            continue;
          }
          const x = (i >> 2) % canvas.width;
          lo = Math.min(lo, x);
          hi = Math.max(hi, x);
        }
        const inkLeft = origin - m.actualBoundingBoxLeft;
        const inkWidth = m.actualBoundingBoxRight + m.actualBoundingBoxLeft;
        if (lo === Number.POSITIVE_INFINITY || !(inkWidth > 0)) {
          continue;
        }
        tabs.set(ch, { height: h, x: Math.max(0, (lo - inkLeft) / inkWidth), width: Math.min(1, (hi - lo + 1) / inkWidth) });
      }
      return { xHeight, tabs };
    };

    const charEls = chars.map((ch) => S.h('span', { style: { display: 'inline-block', whiteSpace: 'pre' } }, ch) as HTMLElement);
    const ruler = S.h('span', { style: { display: 'inline-block', width: 0, height: 0 } }) as HTMLElement;
    const probe = S.h('div', { style: { position: 'absolute', left: 0, top: 0, visibility: 'hidden', pointerEvents: 'none', whiteSpace: 'pre', lineHeight: 1, fontSize } }, charEls, ruler) as HTMLElement;
    const stage = S.fill({ transform: 'none' }) as HTMLElement;
    view.root.replaceChildren(S.fill({ backgroundColor: String(t.background), overflow: 'hidden', fontFamily: face, fontWeight, textRendering: 'geometricPrecision' }, probe, stage));

    let cached: { glyphs: Glyph[]; xHeight: number; baselineOffset: number } | null = null;
    const metrics = () => {
      if (cached) {
        return cached;
      }
      const measured = measureInk(Array.from(new Set(chars.filter((c) => c.trim() !== ''))));
      const out = {
        xHeight: measured?.xHeight ?? fontSize * 0.52,
        baselineOffset: ruler.offsetTop || fontSize * 0.86,
        glyphs: chars.map((ch, i) => ({ ch, blank: ch.trim() === '', advance: charEls[i].getBoundingClientRect().width, tab: measured?.tabs.get(ch) ?? null }))
      };
      if (document.fonts.status === 'loaded') {
        cached = out;
      }
      return out;
    };

    return (at) => {
      const frame = at * num('speed');
      const { glyphs, xHeight, baselineOffset } = metrics();
      const letterEnds: number[] = [];
      let letterTotal = 0;
      glyphs.forEach((g) => {
        letterEnds.push(letterTotal);
        letterTotal += g.advance;
      });
      const gapPx = num('blockGap') * xHeight;
      const blockGlyph: number[] = [];
      const blockStarts: number[] = [];
      const blockWidths: number[] = [];
      const blockOf: number[] = [];
      let blockRun = 0;
      let prevWasBlock = false;
      glyphs.forEach((g, i) => {
        if (g.blank) {
          blockRun += g.advance;
          prevWasBlock = false;
          blockOf.push(-1);
          return;
        }
        if (prevWasBlock) {
          blockRun += gapPx;
        }
        blockOf.push(blockGlyph.length);
        blockGlyph.push(i);
        blockStarts.push(blockRun);
        blockWidths.push(p.blockSizing === 'glyph' ? g.advance : xHeight);
        blockRun += blockWidths[blockWidths.length - 1];
        prevWasBlock = true;
      });
      const fit = Math.min(1, (width * num('maxWidth')) / Math.max(1, letterTotal, blockRun));
      const side = xHeight * fit;
      const radius = num('cornerRadius') * side;
      const tabHeightOf = (g: Glyph) => (g.tab === null ? 0 : g.tab.height * fit);
      const rowTop = side + Math.max(0, ...blockGlyph.map((i) => tabHeightOf(glyphs[i])));
      const baselineY = height / 2 + rowTop / 2;
      const letterLeft = (width - letterTotal * fit) / 2;
      const blockLeft = (width - blockRun * fit) / 2;
      const nCards = Math.max(1, Math.round(num('cards')));
      const cardStagger = num('cardStagger');
      const spinDuration = num('spinDuration');
      const collapseAt = Math.round(spinDuration + (cardStagger * (nCards - 1)) / 2);
      const splitStart = collapseAt + 2;
      const ascenderStart = splitStart + 2;
      const resolveStart = splitStart + num('holdDuration');
      const grow = S.interpolate(frame, [0, Math.max(1, num('growDuration'))], [0, 1], { ...CLAMP, easing: OUT_EASE });
      const turn = (card: number) => {
        const start = card * cardStagger;
        const span = Math.max(1, Math.min(spinDuration, collapseAt - start));
        return S.interpolate(frame - start, [0, span], [0, 360 * num('spinTurns')], { ...CLAMP, easing: SPIN_EASE });
      };
      const lift = num('liftRatio') * side * (S.spring({ frame: Math.max(0, frame - 2), fps, config: { damping: 60, stiffness: 330, mass: 1 } }) - S.interpolate(frame, [collapseAt - 9, collapseAt], [0, 1], { ...CLAMP, easing: IN_EASE }));
      const dip = S.interpolate(frame, [collapseAt, collapseAt + 1, collapseAt + 3], [0, 1, 0], CLAMP);
      const mid = (blockWidths.length - 1) / 2;
      const splitProgress = (b: number) => S.interpolate(frame - splitStart - Math.round(mid - Math.abs(b - mid)) * num('splitStagger'), [0, Math.max(1, num('splitDuration'))], [0, 1], { ...CLAMP, easing: OUT_EASE });
      const tabGrow = S.interpolate(frame, [ascenderStart, ascenderStart + Math.max(1, num('ascenderDuration'))], [0, 1], { ...CLAMP, easing: OUT_EASE });
      const order: number[] = [];
      for (let b = 1; b < blockWidths.length; b++) {
        order.push(b);
      }
      if (blockWidths.length > 0) {
        order.push(0);
      }
      const flashStagger = num('flashStagger');
      const cue = new Map<number, number>();
      const flashOf = new Map<number, string>();
      order.forEach((b, k) => {
        cue.set(b, k === 0 ? 0 : flashStagger * k - flashStagger / 2);
        flashOf.set(b, deck[k % deck.length]);
      });
      const squareLeft = width / 2 - side / 2;
      const swapOf = (b: number) => resolveStart + (cue.get(b) ?? 0) + num('flashToSwap');

      stage.style.transformOrigin = `50% ${baselineY}px`;
      stage.style.transform = `translateY(${-lift - dip * side * 0.03}px) scaleY(${1 - dip * 0.013})`;

      const cardEls = frame < collapseAt + 1 ? Array.from({ length: nCards - 1 }, (_, i) => nCards - 1 - i).map((k) => S.h('div', { style: { position: 'absolute', left: squareLeft, top: baselineY - side, width: side, height: side, borderRadius: radius, backgroundColor: deck[(k - 1) % deck.length], transformOrigin: '50% 100%', transform: `rotate(${turn(k)}deg) scale(${grow})` } })) : [];

      const blockEls = blockWidths.map((w, b) => {
        if (frame >= swapOf(b)) {
          return null;
        }
        const pr = splitProgress(b);
        const g = glyphs[blockGlyph[b]];
        const flashOn = resolveStart + (cue.get(b) ?? 0);
        const lit = frame >= flashOn && frame < flashOn + num('flashDuration');
        const fill = lit ? (flashOf.get(b) ?? ink) : ink;
        const left = squareLeft + (blockLeft + blockStarts[b] * fit - squareLeft) * pr;
        const bw = side + (w * fit - side) * pr;
        const tab = g.tab;
        const tabH = tab ? tabGrow * tabHeightOf(g) : 0;
        const tabW = tab ? bw * tab.width : 0;
        const tabX = tab ? Math.min(Math.max(0, tab.x * bw), Math.max(0, bw - tabW)) : 0;
        const notched = tabH > radius;
        const stem = tabH > 0 ? S.h('div', { style: { position: 'absolute', bottom: '100%', left: tabX, width: tabW, height: tabH, backgroundColor: fill, borderTopLeftRadius: radius, borderTopRightRadius: radius } }) : null;
        return S.h('div', { style: { position: 'absolute', left, top: baselineY - side, width: bw, height: side, borderRadius: radius, borderTopLeftRadius: notched && tabX < 1 ? 0 : radius, borderTopRightRadius: notched && tabX + tabW > bw - 1 ? 0 : radius, backgroundColor: fill, transformOrigin: '50% 100%', transform: `rotate(${turn(0)}deg) scale(${grow})` } }, stem);
      });

      const letterEls = glyphs.map((g, i) => {
        const b = blockOf[i];
        if (b < 0 || frame < swapOf(b)) {
          return null;
        }
        return S.h('span', { style: { position: 'absolute', left: letterLeft + letterEnds[i] * fit, top: baselineY - baselineOffset * fit, fontSize: fontSize * fit, lineHeight: 1, whiteSpace: 'pre', color: ink } }, g.ch);
      });

      stage.replaceChildren(...cardEls, ...(blockEls.filter(Boolean) as Element[]), ...(letterEls.filter(Boolean) as Element[]));
    };
  }
};
