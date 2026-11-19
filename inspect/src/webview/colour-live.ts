import { hsvToRgb, rgbaCss, type Hsv } from './colour-math';
import { liveNumber, type LivePorts } from './scrub';

export const colourCss = (hsv: Hsv, alpha: number) => rgbaCss({ ...hsvToRgb(hsv), a: alpha });

export function liveColour(ports: LivePorts) {
  const live = liveNumber(ports);

  return {
    drag: (hsv: Hsv, alpha: number) => live.move(colourCss(hsv, alpha)),
    drop: (hsv: Hsv, alpha: number) => live.release(colourCss(hsv, alpha))
  };
}
