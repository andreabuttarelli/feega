export const SPLIT_LINE = String.raw`
const SAFE = 0.88;
const AUTO_ROW_MIN = 0.7;
const LINE_GAP = 0.12;

function splitWords(text, at) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return { left: words, right: [] };
  }
  const auto = Math.round(words.length / 2);
  const cut = Math.min(words.length - 1, Math.max(1, Math.round(at) || auto));
  return { left: words.slice(0, cut), right: words.slice(cut) };
}

function chooseAxis(p, rowFit, m) {
  if (p.stack === 'row' || p.stack === 'column') {
    return p.stack;
  }
  return rowFit >= AUTO_ROW_MIN && m.frameW >= m.frameH ? 'row' : 'column';
}
`;
