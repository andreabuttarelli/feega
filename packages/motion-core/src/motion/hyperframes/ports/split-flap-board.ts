import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'split-flap-board',
  title: 'Split-flap board',
  about: 'A row of mechanical flap cells that spin through the alphabet one after another until the board text appears.',
  category: HfCategory.Text,
  origin: HfOrigin.Block,
  source: 'split-flap-board',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 105,
  background: '#0a0a0c',
  fonts: [],
  props: {
    boardText: { type: 'string', title: 'Board text', default: 'NOW BOARDING', group: 'Content', maxLength: 24 },
    flapAlphabet: { type: 'string', title: 'Flap alphabet', default: " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,'", group: 'Content', maxLength: 64 },
    flipDuration: { type: 'number', title: 'Seconds per flap', default: 0.09, minimum: 0.03, maximum: 1.2, step: 0.01, group: 'Motion' },
    cellStagger: { type: 'number', title: 'Cell stagger', default: 0.05, minimum: 0, maximum: 0.5, step: 0.01, group: 'Motion' },
    cellCount: { type: 'number', title: 'Cells', default: 12, minimum: 1, maximum: 24, step: 1, group: 'Layout' }
  },
  draw: (S, view) => {
    const p = view.props;
    const DEG = Math.PI / 180;
    const GAP = 10;
    const num = (value: unknown, min: number, max: number, fallback: number) => {
      const n = typeof value === 'number' ? value : parseFloat(String(value));
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    };
    const fallbackAlphabet = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,'";
    const given = String(p.flapAlphabet || fallbackAlphabet);
    const alphabet = given.length < 2 ? fallbackAlphabet : given;
    const N = alphabet.length;
    const flipDur = num(p.flipDuration, 0.03, 1.2, 0.09);
    const stagger = num(p.cellStagger, 0, 0.5, 0.05);
    const cellCount = Math.round(num(p.cellCount, 1, 24, 12));
    const text = String(p.boardText ?? 'NOW BOARDING').toUpperCase().slice(0, cellCount);
    const lead = Math.floor((cellCount - text.length) / 2);
    const targets = Array.from({ length: cellCount }, (_, i) => {
      const ch = i >= lead && i < lead + text.length ? text.charAt(i - lead) : alphabet.charAt(0);
      return Math.max(0, alphabet.indexOf(ch));
    });
    const cw = Math.min(130, Math.floor((view.width - 240 - (cellCount - 1) * GAP) / cellCount));
    const chh = Math.round(cw * 1.45);

    const face = (kind: string, glyphTop: number, style: Record<string, unknown>) => {
      const glyph = S.h('span', { style: { position: 'absolute', left: 0, width: '100%', display: 'block', textAlign: 'center', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#f4efe2', whiteSpace: 'pre', height: chh, lineHeight: `${chh}px`, fontSize: Math.round(cw * 0.78), top: glyphTop } }) as HTMLElement;
      const el = S.h('div', { style: { position: 'absolute', left: 0, width: '100%', height: '50%', overflow: 'hidden', ...style } }, glyph) as HTMLElement;
      return { el, glyph, kind };
    };
    const topStyle = { top: 0, borderRadius: '9px 9px 0 0', background: 'linear-gradient(180deg, #26272c 0%, #1a1b1f 100%)' };
    const botStyle = { top: '50%', borderRadius: '0 0 9px 9px', background: 'linear-gradient(180deg, #191a1e 0%, #232429 100%)' };

    const cells = targets.map((steps) => {
      const top = face('top', 0, topStyle);
      const bot = face('bot', -Math.round(chh / 2), botStyle);
      const leafA = face('a', 0, { ...topStyle, transformOrigin: '50% 100%', zIndex: 3, backfaceVisibility: 'hidden' });
      const leafB = face('b', -Math.round(chh / 2), { ...botStyle, transformOrigin: '50% 0%', zIndex: 3, backfaceVisibility: 'hidden' });
      const seam = S.h('div', { style: { position: 'absolute', left: 0, top: '50%', width: '100%', height: 3, marginTop: -1.5, background: '#050506', zIndex: 4 } });
      const el = S.h('div', { style: { position: 'relative', flex: '0 0 auto', perspective: 900, borderRadius: 9, background: '#0c0c0e', boxShadow: '0 18px 34px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05)', width: cw, height: chh } }, top.el, bot.el, leafA.el, leafB.el, seam);
      return { el, steps, top, bot, leafA, leafB };
    });

    const bg = S.fill({ background: 'radial-gradient(120% 90% at 50% 42%, #23242a 0%, #121317 62%, #0a0a0c 100%), #0a0a0c' });
    const board = S.fill({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GAP }, ...cells.map((c) => c.el));
    view.root.replaceChildren(bg, board);

    type Face = ReturnType<typeof face>;
    const clear = (leaf: Face) => {
      leaf.el.style.opacity = '0';
      leaf.el.style.transform = 'none';
      leaf.el.style.filter = 'none';
      leaf.glyph.textContent = '';
    };
    const show = (leaf: Face, char: string, angle: number, shade: string) => {
      leaf.glyph.textContent = char;
      leaf.el.style.opacity = '1';
      leaf.el.style.transform = `rotateX(${angle.toFixed(2)}deg)`;
      leaf.el.style.filter = `brightness(${shade})`;
    };

    return (frame) => {
      const t = frame / view.fps;
      cells.forEach((cell, i) => {
        const local = t - i * stagger;
        const raw = local <= 0 ? 0 : local / flipDur;
        let count = Math.floor(raw);
        let prog = raw - count;
        if (count >= cell.steps) {
          count = cell.steps;
          prog = 0;
        }
        const outgoing = alphabet.charAt(count % N);
        const incoming = alphabet.charAt((count + 1) % N);
        if (count >= cell.steps || prog <= 0) {
          cell.top.glyph.textContent = outgoing;
          cell.bot.glyph.textContent = outgoing;
          clear(cell.leafA);
          clear(cell.leafB);
          return;
        }
        cell.top.glyph.textContent = incoming;
        cell.bot.glyph.textContent = outgoing;
        const theta = 180 * prog * prog;
        const shade = (1 - 0.5 * Math.sin(theta * DEG)).toFixed(3);
        if (theta < 90) {
          show(cell.leafA, outgoing, -theta, shade);
          clear(cell.leafB);
          return;
        }
        clear(cell.leafA);
        show(cell.leafB, incoming, 180 - theta, shade);
      });
    };
  }
};
