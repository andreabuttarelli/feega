export const CONTROLS_STRIP_PX = 48;

const OWNS_PRESS = 'input, textarea, select, button, a, [contenteditable="true"], .nodrag, audio, iframe';

export function ownsPress(target: Element, clientY: number): boolean {
  if (target.closest(OWNS_PRESS)) {
    return true;
  }

  const video = target.closest('video');
  if (!video) {
    return false;
  }

  return clientY >= video.getBoundingClientRect().bottom - CONTROLS_STRIP_PX;
}
