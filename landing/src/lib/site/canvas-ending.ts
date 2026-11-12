export enum EndingDrive {
  Still = 'still',
  Timeline = 'timeline',
  Script = 'script'
}

export enum ChromeKind {
  Full = 'full',
  Compact = 'compact'
}

export type Size = { w: number; h: number };
export type Reserve = { top: number; right: number; bottom: number; left: number };
export type Panels = { left: number; right: number };
export type Chrome = { kind: ChromeKind; panels: Panels; reserve: Reserve };
export type Pose = { x: number; y: number; scale: number; zoom: number };

export const SCALE_LIMITS = { min: 0.4, max: 0.6 };

const PERCENT = 100;
const EDGE = 12;
const RAIL = 56;
const BREATH = 20;
const TOP_BAR = 48;
const FRAME_LABEL = 28;
const BOTTOM_BAR = 46;

const TIERS: { minWidth: number; kind: ChromeKind; panels: Panels }[] = [
  { minWidth: 1200, kind: ChromeKind.Full, panels: { left: 280, right: 280 } },
  { minWidth: 760, kind: ChromeKind.Full, panels: { left: 220, right: 240 } },
  { minWidth: 0, kind: ChromeKind.Compact, panels: { left: 0, right: 0 } }
];

function reserveFor(kind: ChromeKind, panels: Panels): Reserve {
  const top = TOP_BAR + FRAME_LABEL;
  const bottom = EDGE + BOTTOM_BAR + BREATH;

  if (kind === ChromeKind.Compact) {
    return { top, right: BREATH, bottom, left: BREATH };
  }

  return { top, right: EDGE + panels.right + BREATH, bottom, left: RAIL + EDGE + panels.left + BREATH };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function driveFor(env: { reducedMotion: boolean; scrollTimeline: boolean }): EndingDrive {
  if (env.reducedMotion) {
    return EndingDrive.Still;
  }

  return env.scrollTimeline ? EndingDrive.Timeline : EndingDrive.Script;
}

export function chromeFor(width: number): Chrome {
  const tier = TIERS.find((t) => width >= t.minWidth) ?? TIERS[TIERS.length - 1];
  return { kind: tier.kind, panels: tier.panels, reserve: reserveFor(tier.kind, tier.panels) };
}

export function progressOf(runwayTop: number, runwayHeight: number, viewport: number): number {
  return clamp((viewport - runwayTop) / runwayHeight, 0, 1);
}

export function endPose(frame: Size, view: Size, chrome: Chrome): Pose {
  const { top, right, bottom, left } = chrome.reserve;
  const room = { w: view.w - left - right, h: view.h - top - bottom };
  const fit = Math.min(room.w / frame.w, room.h / frame.h);
  const zoom = Math.floor(clamp(fit, SCALE_LIMITS.min, SCALE_LIMITS.max) * PERCENT);
  const scale = zoom / PERCENT;

  return {
    x: left + (room.w - frame.w * scale) / 2,
    y: top + Math.max(0, (room.h - frame.h * scale) / 2),
    scale,
    zoom
  };
}

export function zoomLabel(scale: number): string {
  return `${Math.round(scale * PERCENT)}%`;
}
