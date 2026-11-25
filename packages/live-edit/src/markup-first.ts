const STYLE_BLOCKS = /<style(?:\s.*?)?>.*?<\/style>/gs;

export function markupFirst(from: string, to: string): string | null {
  const was = from.match(STYLE_BLOCKS) ?? [];
  const now = to.match(STYLE_BLOCKS) ?? [];
  if (!was.length || was.length !== now.length) {
    return null;
  }

  let next = 0;
  const staged = to.replace(STYLE_BLOCKS, () => was[next++]);
  return staged === to || staged === from ? null : staged;
}
