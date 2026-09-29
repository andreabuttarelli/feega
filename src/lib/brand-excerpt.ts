const HEADING_MARK = /^#{1,6}\s+/gm;
const EMPHASIS_MARK = /(\*\*|__|\*|_|`)/g;
const ELLIPSIS = '…';

export function brandExcerpt(markdown: string, maxChars: number): string {
  const plain = markdown.replace(HEADING_MARK, '').replace(EMPHASIS_MARK, '').trim();
  if (plain.length <= maxChars) {
    return plain;
  }

  const cut = plain.slice(0, maxChars - ELLIPSIS.length);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}${ELLIPSIS}`;
}
