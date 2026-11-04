export function nextFrame(win: { document: { hidden: boolean }; requestAnimationFrame: (fn: () => void) => number }): Promise<void> {
  return new Promise((r) => (win.document.hidden ? r() : win.requestAnimationFrame(() => r())));
}
