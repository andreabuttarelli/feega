export const LABEL_SCREEN_PX = 12;
export const LABEL_ZOOM_EXPONENT = 0.3;
export const LABEL_MIN_FACTOR = 0.8;
export const LABEL_HIDE_FRAME_PX = 24;
const LABEL_STEPS_PER_OCTAVE = 8;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const labelScreenPx = (zoom: number): number => LABEL_SCREEN_PX * clamp(zoom ** LABEL_ZOOM_EXPONENT, LABEL_MIN_FACTOR, 1);

export const labelZoomStep = (zoom: number): number => Math.min(1, 2 ** (Math.round(Math.log2(zoom) * LABEL_STEPS_PER_OCTAVE) / LABEL_STEPS_PER_OCTAVE));

export const labelScale = (zoomStep: number): number => labelScreenPx(zoomStep) / (LABEL_SCREEN_PX * zoomStep);

export const labelShown = (zoomStep: number, frameWidth: number): boolean => frameWidth * zoomStep >= LABEL_HIDE_FRAME_PX;

export const HOVER_SCREEN_PX = 1.5;
export const SELECT_SCREEN_PX = 2;
export const HANDLE_SCREEN_PX = 8;
export const FAR_ZOOM = 0.25;
export const FAR_BOOST = 1.5;
const FAR_BOOST_FULL_ZOOM = 0.05;
const STROKE_STEPS_PER_OCTAVE = 16;

const farBoost = (zoom: number): number => {
  const reached = Math.log(FAR_ZOOM / zoom) / Math.log(FAR_ZOOM / FAR_BOOST_FULL_ZOOM);
  return 1 + (FAR_BOOST - 1) * clamp(reached, 0, 1);
};

export const strokeWorld = (screenPx: number, zoom: number): number => (screenPx * farBoost(zoom)) / zoom;

export const strokeZoomStep = (zoom: number): number => 2 ** (Math.round(Math.log2(zoom) * STROKE_STEPS_PER_OCTAVE) / STROKE_STEPS_PER_OCTAVE);
