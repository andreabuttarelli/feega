import { pixelKit, type PixelKit } from '../pixel';
import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'pixel-typewriter-quote',
  title: 'Pixel typewriter quote',
  about: 'A quote types out one bitmap glyph at a time, each strike flaring to the accent before settling to ink, with a blinking block cursor and the attribution typing in last.',
  category: RendercompCategory.Text,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 180,
  background: '#0c0e1a',
  fonts: [],
  extend: pixelKit,
  props: {
    quote: { type: 'string', title: 'Quote', default: 'Make it work, make it right, make it fast.', group: 'Content', maxLength: 200 },
    attribution: { type: 'string', title: 'Attribution', default: '- Kent Beck', group: 'Content', maxLength: 40 },
    inkColor: { type: 'string', title: 'Ink colour', format: PropFormat.Color, default: '#dfe7ff', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#39e0c8', group: 'Style' },
    cps: { type: 'number', title: 'Characters per frame', default: 0.55, minimum: 0.1, maximum: 2, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const K = S as PixelKit;
    const p = view.props;
    const IW = 480;
    const IH = 270;
    const cell = 3;
    const charW = (K.GLYPH_W + 1) * cell;
    const charH = K.GLYPH_H * cell;
    const lineGap = charH + 6 * cell;
    const aCell = 2;
    const aCharW = (K.GLYPH_W + 1) * aCell;
    const aCharH = K.GLYPH_H * aCell;
    const qCell = 4;
    const bandCount = 9;
    const attrPause = 8;
    const quote = String(p.quote);
    const attribution = String(p.attribution);
    const cps = Number(p.cps);
    const bg = K.hexToRgb(String(p.background));
    const ink = K.hexToRgb(String(p.inkColor));
    const accent = K.hexToRgb(String(p.accentColor));
    const px = K.pixelStage(view, { iw: IW, ih: IH, background: String(p.background), scanlines: 0.4, vignette: 0.7, dither: 0.06 });

    const wrapWords = (text: string, maxChars: number) => {
      const lines: string[] = [];
      let cur = '';

      for (const w of text.split(' ')) {
        const candidate = cur.length === 0 ? w : `${cur} ${w}`;

        if (candidate.length > maxChars && cur.length > 0) {
          lines.push(cur);
          cur = w;
          continue;
        }

        cur = candidate;
      }

      if (cur.length > 0) {
        lines.push(cur);
      }

      return lines;
    };

    const drawChar = (ch: string, x: number, y: number, size: number, color: string) => {
      for (const c of K.layoutText(ch).cells) {
        px.rect(K.snap(x + c.x * size), K.snap(y + c.y * size), size, size, color);
      }
    };

    const lines = wrapWords(quote, Math.max(8, Math.floor((IW - 96) / charW)));
    const blockH = lines.length * charH + (lines.length - 1) * (lineGap - charH);
    const startY = K.snap((IH - blockH) / 2) - 6;
    const slots: { ch: string; x: number; y: number; idx: number }[] = [];

    lines.forEach((ln, li) => {
      const sx = K.snap((IW - (ln.length * charW - cell)) / 2);
      const ly = K.snap(startY + li * lineGap);

      for (let ci = 0; ci < ln.length; ci++) {
        slots.push({ ch: ln[ci], x: K.snap(sx + ci * charW), y: ly, idx: slots.length });
      }
    });

    const totalBody = slots.length;
    const attrW = attribution.length * aCharW - aCell;
    const attrX = K.snap(IW - 64 - attrW);
    const attrY = K.snap(startY + lines.length * lineGap + 10);
    const ruleY = K.snap(startY + lines.length * lineGap + 4);
    const ruleFullW = IW - 128;
    const qmTop = K.snap(startY - K.GLYPH_H * qCell - 4);
    const leftX = K.snap((IW - (lines[0]?.length ?? 8) * charW) / 2) - K.GLYPH_W * qCell - 6;
    const lastLine = lines[lines.length - 1] ?? '';
    const lastW = lastLine.length * charW - cell;
    const rightX = K.snap((IW - lastW) / 2 + lastW + 6);
    const qmBot = K.snap(startY + (lines.length - 1) * lineGap + charH - K.GLYPH_H * qCell + 6);
    const quoteMark = K.layoutText('"').cells;
    const bandColors = Array.from({ length: bandCount }, (_, i) => K.rgb(K.lerpRGB(bg, K.lerpRGB(bg, accent, 0.06), i / (bandCount - 1))));

    return (frame) => {
      px.begin();

      for (let i = 0; i < bandCount; i++) {
        px.rect(0, K.snap((IH * i) / bandCount), IW, Math.ceil(IH / bandCount) + 1, bandColors[i]);
      }

      const revealed = Math.floor(frame * cps);
      const attrRevealed = Math.max(0, revealed - (totalBody + attrPause));

      for (const s of slots) {
        if (s.idx > revealed) {
          continue;
        }

        const settle = Math.min(1, (revealed - s.idx) / 4);
        drawChar(s.ch, s.x, s.y, cell, K.rgb(K.lerpRGB(accent, ink, settle)));
      }

      const headSlot = slots.find((s) => s.idx === Math.min(revealed + 1, totalBody - 1));
      const bodyDone = revealed >= totalBody - 1;

      if (!bodyDone && headSlot) {
        px.rect(headSlot.x, headSlot.y, K.GLYPH_W * cell, charH, K.rgb(accent), Math.floor(frame / 8) % 2 === 0 ? 0.9 : 0.25);
      }

      for (let ci = 0; ci < Math.min(attribution.length, attrRevealed); ci++) {
        const x = K.snap(attrX + ci * aCharW);

        for (const c of K.layoutText(attribution[ci]).cells) {
          px.rect(K.snap(x + c.x * aCell), K.snap(attrY + c.y * aCell), aCell, aCell, K.rgb(accent), 0.85);
        }
      }

      if (bodyDone && attrRevealed < attribution.length) {
        const cx = K.snap(attrX + Math.min(attrRevealed, attribution.length) * aCharW);
        px.rect(cx, attrY, K.GLYPH_W * aCell, aCharH, K.rgb(accent), Math.floor(frame / 7) % 2 === 0 ? 0.8 : 0.2);
      }

      for (const c of quoteMark) {
        px.rect(K.snap(Math.max(8, leftX) + c.x * qCell), K.snap(qmTop + c.y * qCell), qCell, qCell, K.rgb(accent), 0.5);
      }

      if (bodyDone) {
        for (const c of quoteMark) {
          px.rect(K.snap(Math.min(IW - K.GLYPH_W * qCell - 8, rightX) + c.x * qCell), K.snap(qmBot + c.y * qCell), qCell, qCell, K.rgb(accent), 0.5);
        }
      }

      const ruleProgress = Math.min(1, revealed / Math.max(1, totalBody));
      px.rect(K.snap((IW - ruleFullW) / 2), ruleY, K.snap(ruleFullW * ruleProgress), 1, K.rgb(accent), 0.55);
    };
  }
};
