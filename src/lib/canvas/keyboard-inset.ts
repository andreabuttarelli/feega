const KEYBOARD_MIN_SHARE = 0.25;

export type ViewportHeights = { layoutHeight: number; visibleHeight: number };

export function keyboardOpen({ layoutHeight, visibleHeight }: ViewportHeights): boolean {
  return layoutHeight - visibleHeight > layoutHeight * KEYBOARD_MIN_SHARE;
}

export function watchKeyboard(onchange: (open: boolean) => void): () => void {
  const viewport = window.visualViewport;
  if (!viewport) {
    return () => {};
  }

  const update = () => onchange(keyboardOpen({ layoutHeight: window.innerHeight, visibleHeight: viewport.height }));
  viewport.addEventListener('resize', update);
  update();

  return () => viewport.removeEventListener('resize', update);
}
