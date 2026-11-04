import { OverlayPosition, type Overlay } from '@feega/motion-core/motion/prototype/model';

export type Size = { width: number; height: number };
export type OverlayBox = { left: number; top: number; width: number; height: number };

type Corner = { x: number; y: number };

const PLACE: Record<OverlayPosition, (frame: Size, shown: Size, overlay: Overlay) => Corner> = {
  [OverlayPosition.Center]: (frame, shown) => ({ x: (frame.width - shown.width) / 2, y: (frame.height - shown.height) / 2 }),
  [OverlayPosition.Top]: (frame, shown) => ({ x: (frame.width - shown.width) / 2, y: 0 }),
  [OverlayPosition.Bottom]: (frame, shown) => ({ x: (frame.width - shown.width) / 2, y: frame.height - shown.height }),
  [OverlayPosition.Manual]: (_frame, _shown, overlay) => ({ x: overlay.x, y: overlay.y })
};

export function overlayBox(frame: Size, sheet: Size, overlay: Overlay): OverlayBox {
  const fit = Math.min(1, frame.width / sheet.width, frame.height / sheet.height);
  const shown = { width: sheet.width * fit, height: sheet.height * fit };
  const at = PLACE[overlay.position](frame, shown, overlay);
  return { left: at.x / frame.width, top: at.y / frame.height, width: shown.width / frame.width, height: shown.height / frame.height };
}
