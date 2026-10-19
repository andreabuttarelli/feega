import type { PathItem } from '$lib/motion/gpu-full/display-list';
import { dashes } from '$lib/motion/gpu-full/stroke';
import type { Box, Curve } from '$lib/canvas/gpu/geometry';
import type { SnapGuide } from '$lib/canvas/snap';
import type { Glyphs } from './chrome';
import { circle, cubic, line, rect, reverse, roundRect, solid } from './shapes';

export enum OverlayPart {
  Wire = 'wire',
  Badge = 'badge',
  Marquee = 'marquee',
  Guide = 'guide',
  PeerCursor = 'peer-cursor',
  PeerTag = 'peer-tag',
  Rotate = 'rotate',
  Ghost = 'ghost',
  Hover = 'hover',
  Running = 'running'
}

export enum EdgeLook {
  Plain = 'plain',
  Linked = 'linked',
  Iterate = 'iterate'
}

export type CoreTheme = { paper: string; panel: string; line: string; ink: string; inkSoft: string; accent: string; wire: string; iterate: string };

export type CorePeer = { id: string; name: string; color: string; at: { x: number; y: number } };

const WIRE_WIDTH = 1;
const ITERATE_DASH = 6;
const ITERATE_GAP = 4;
const BADGE_RADIUS = 11;
const BADGE_STROKE = 1.5;
const MARQUEE_FILL = 0.08;
const OVERLAY_LINE = 1;
const PEER_ARROW = [0, 0, 0, 16, 4.5, 12, 11, 12];
const PEER_TAG = { x: 10, y: 16, h: 18, pad: 5, size: 11, line: 14 };
const PEER_TEXT = '#ffffff';
const REFUSED = '#c0392b';
const HOVER_ALPHA = 0.5;
const RUNNING_LINE = 1.5;
const ROTATE = { size: 12, lift: 28, border: 2 };

const WIRE_COLOUR: Record<EdgeLook, (t: CoreTheme) => string> = {
  [EdgeLook.Plain]: (t) => t.wire,
  [EdgeLook.Linked]: (t) => t.inkSoft,
  [EdgeLook.Iterate]: (t) => t.iterate
};

function badge(id: string, c: Curve, theme: CoreTheme): PathItem[] {
  const clip = `${id}:${OverlayPart.Badge}`;
  const ring = [...circle(c.mid.x, c.mid.y, BADGE_RADIUS + BADGE_STROKE / 2), ...circle(c.mid.x, c.mid.y, BADGE_RADIUS - BADGE_STROKE / 2).map(reverse)];
  return [solid(clip, circle(c.mid.x, c.mid.y, BADGE_RADIUS), theme.panel), solid(clip, ring, theme.iterate)];
}

export function edgeItems(id: string, c: Curve, look: EdgeLook, theme: CoreTheme): PathItem[] {
  const clip = `${id}:${OverlayPart.Wire}`;
  const colour = WIRE_COLOUR[look](theme);
  const path = cubic(c);
  if (look !== EdgeLook.Iterate) {
    return [solid(clip, line(path, WIRE_WIDTH), colour)];
  }
  return [...dashes(path, false, ITERATE_DASH, ITERATE_GAP).map((d) => solid(clip, line(d, WIRE_WIDTH), colour)), ...badge(id, c, theme)];
}

export function marqueeItems(m: Box, zoom: number, theme: CoreTheme): PathItem[] {
  const clip = `marquee:${OverlayPart.Marquee}`;
  const box = rect(m.x, m.y, m.w, m.h);
  return [solid(clip, [box], theme.accent, MARQUEE_FILL), solid(clip, line(box, OVERLAY_LINE / zoom, true), theme.accent)];
}

export function guideItems(guides: readonly SnapGuide[], zoom: number, theme: CoreTheme): PathItem[] {
  const w = OVERLAY_LINE / zoom;
  return guides.map((g, i) => solid(`guide-${i}:${OverlayPart.Guide}`, [g.axis === 'x' ? rect(g.at, g.from, w, g.to - g.from) : rect(g.from, g.at, g.to - g.from, w)], theme.accent));
}

export function peerItems(p: CorePeer, zoom: number, glyphs: Glyphs): PathItem[] {
  const at = (xs: number[]) => xs.map((v, i) => (i % 2 === 0 ? p.at.x + v / zoom : p.at.y + v / zoom));
  const name = glyphs(p.name, PEER_TAG.size, { leading: PEER_TAG.line / PEER_TAG.size });
  const pill = roundRect(PEER_TAG.x, PEER_TAG.y, name.width + 2 * PEER_TAG.pad, PEER_TAG.h, PEER_TAG.h / 2).map(at);
  const top = PEER_TAG.y + (PEER_TAG.h - PEER_TAG.line) / 2;
  const text = name.contours.map((c) => at(c.map((v, i) => (i % 2 === 0 ? v + PEER_TAG.x + PEER_TAG.pad : v + top))));
  return [solid(`${p.id}:${OverlayPart.PeerCursor}`, [at(PEER_ARROW)], p.color), solid(`${p.id}:${OverlayPart.PeerTag}`, pill, p.color), solid(`${p.id}:${OverlayPart.PeerTag}`, text, PEER_TEXT)];
}

export function rotateItems(id: string, b: Box, theme: CoreTheme): PathItem[] {
  const clip = `${id}:${OverlayPart.Rotate}`;
  const r = ROTATE.size / 2;
  const cx = b.x + b.w / 2;
  const cy = b.y - ROTATE.lift + r;
  return [solid(clip, circle(cx, cy, r), theme.accent), solid(clip, circle(cx, cy, r - ROTATE.border), theme.panel)];
}

export function ghostItems(c: Curve, ok: boolean, zoom: number, theme: CoreTheme): PathItem[] {
  return [solid(`ghost:${OverlayPart.Ghost}`, line(cubic(c), OVERLAY_LINE / zoom), ok ? theme.accent : REFUSED)];
}

export function hoverItems(b: Box, zoom: number, theme: CoreTheme): PathItem[] {
  return [solid(`hover:${OverlayPart.Hover}`, line(rect(b.x, b.y, b.w, b.h), OVERLAY_LINE / zoom, true), theme.accent, HOVER_ALPHA)];
}

export function runningItems(b: Box & { id: string }, zoom: number, theme: CoreTheme): PathItem[] {
  return [solid(`${b.id}:${OverlayPart.Running}`, line(rect(b.x, b.y, b.w, b.h), RUNNING_LINE / zoom, true), theme.accent)];
}
