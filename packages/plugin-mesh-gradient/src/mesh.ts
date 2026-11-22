import { Control, type Css, type Handle, type UiNode } from '@feega/plugin-api/protocol';

export type MeshPoint = { id: string; x: number; y: number; color: string };

export type Mesh = { base: string; softness: number; points: MeshPoint[] };

export const POINTS_LIST = 'points';
export const COLOUR = 'color';
export const SOFTNESS = 'softness';
export const BASE = 'base';
export const ADD = 'add';
export const REMOVE = 'remove';
export const RANDOMIZE = 'randomize';

const MIN_STOP = 30;
const STOP_RANGE = 70;
const PERCENT = 100;
const SOFTNESS_MAX = 100;
const HEX_ALPHA_OFF = '00';
const FALLBACK_BASE = '#0b0b12';
const SATURATION = 0.7;
const LIGHTNESS = 0.55;
const HUE_DEGREES = 360;
const SHORT_HEX = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const LONG_HEX = /^#[0-9a-f]{6}$/i;
const COLOUR_TOKEN = String.raw`(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))`;
const LAYER = new RegExp(String.raw`radial-gradient\(circle at ([\d.]+)% ([\d.]+)%, ${COLOUR_TOKEN} 0%, ${COLOUR_TOKEN} ([\d.]+)%\)`, 'g');
const RGB = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/;
const TRANSPARENT = /^rgba\(\s*\d+[\s,]+\d+[\s,]+\d+[\s,]+0\s*\)$/;

export const DEFAULT_MESH: Mesh = {
  base: FALLBACK_BASE,
  softness: 60,
  points: [
    { id: 'p1', x: 0.15, y: 0.2, color: '#ff5a1f' },
    { id: 'p2', x: 0.85, y: 0.15, color: '#7c3aed' },
    { id: 'p3', x: 0.7, y: 0.85, color: '#06b6d4' },
    { id: 'p4', x: 0.2, y: 0.8, color: '#f472b6' }
  ]
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const percent = (fraction: number) => Math.round(fraction * PERCENT);

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

function hexOf(color: string): string | null {
  const text = color.trim();
  if (SHORT_HEX.test(text)) {
    return text.replace(SHORT_HEX, '#$1$1$2$2$3$3').toLowerCase();
  }
  if (text.startsWith('#') && text.length >= 7) {
    return text.slice(0, 7).toLowerCase();
  }
  const rgb = text.match(RGB);
  return rgb ? `#${hex2(Number(rgb[1]))}${hex2(Number(rgb[2]))}${hex2(Number(rgb[3]))}` : null;
}

const stopOf = (softness: number) => Math.round(MIN_STOP + (softness / SOFTNESS_MAX) * STOP_RANGE);

const softnessOf = (stop: number) => clamp(Math.round(((stop - MIN_STOP) / STOP_RANGE) * SOFTNESS_MAX), 0, SOFTNESS_MAX);

export function cssOf(mesh: Mesh): Css {
  const stop = stopOf(mesh.softness);
  const layers = mesh.points.map((p) => `radial-gradient(circle at ${percent(p.x)}% ${percent(p.y)}%, ${p.color} 0%, ${p.color}${HEX_ALPHA_OFF} ${stop}%)`);
  return { 'background-color': mesh.base, 'background-image': layers.join(', ') };
}

export function parseMesh(styles: Css): Mesh | null {
  const image = styles['background-image'] ?? '';
  const layers = [...image.matchAll(LAYER)];
  const rest = image.replace(LAYER, '').replace(/[,\s]/g, '');
  if (!layers.length || rest) {
    return null;
  }
  const points = layers.map((m, i) => ({ id: `p${i + 1}`, x: Number(m[1]) / PERCENT, y: Number(m[2]) / PERCENT, color: hexOf(m[3]) ?? FALLBACK_BASE }));
  const back = styles['background-color'] ?? '';
  const base = TRANSPARENT.test(back) ? FALLBACK_BASE : (hexOf(back) ?? FALLBACK_BASE);
  return { base, softness: softnessOf(Number(layers[0][5])), points };
}

const withPoint = (mesh: Mesh, id: string, change: Partial<MeshPoint>): Mesh => ({ ...mesh, points: mesh.points.map((p) => (p.id === id ? { ...p, ...change } : p)) });

export const movePoint = (mesh: Mesh, id: string, x: number, y: number): Mesh => withPoint(mesh, id, { x: clamp(x, 0, 1), y: clamp(y, 0, 1) });

export function setColor(mesh: Mesh, id: string, color: string): Mesh {
  const hex = hexOf(color);
  return hex && LONG_HEX.test(hex) ? withPoint(mesh, id, { color: hex }) : mesh;
}

export const setSoftness = (mesh: Mesh, softness: number): Mesh => ({ ...mesh, softness: clamp(Math.round(softness), 0, SOFTNESS_MAX) });

export function setBase(mesh: Mesh, color: string): Mesh {
  const hex = hexOf(color);
  return hex ? { ...mesh, base: hex } : mesh;
}

function hueColor(hue: number): string {
  const channel = (n: number) => {
    const k = (n + hue * 12) % 12;
    const a = SATURATION * Math.min(LIGHTNESS, 1 - LIGHTNESS);
    return LIGHTNESS - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return `#${[0, 8, 4].map((n) => hex2(Math.round(channel(n) * 255))).join('')}`;
}

const nextId = (mesh: Mesh) => `p${Math.max(0, ...mesh.points.map((p) => Number(p.id.slice(1)))) + 1}`;

export const addPoint = (mesh: Mesh, rng: () => number): Mesh => ({ ...mesh, points: [...mesh.points, { id: nextId(mesh), x: rng(), y: rng(), color: hueColor(rng()) }] });

export const removePoint = (mesh: Mesh, id: string): Mesh => (mesh.points.length > 1 ? { ...mesh, points: mesh.points.filter((p) => p.id !== id) } : mesh);

export const randomize = (mesh: Mesh, rng: () => number): Mesh => ({ ...mesh, points: mesh.points.map((p) => ({ ...p, x: rng(), y: rng(), color: hueColor(rng()) })) });

export function treeOf(mesh: Mesh, selected: string): UiNode[] {
  const point = mesh.points.find((p) => p.id === selected) ?? mesh.points[0];
  return [
    { type: Control.List, id: POINTS_LIST, label: 'Points', selected: point.id, items: mesh.points.map((p, i) => ({ id: p.id, label: `Point ${i + 1}`, swatch: p.color })) },
    { type: Control.Colour, id: COLOUR, label: 'Colour', value: point.color },
    { type: Control.Slider, id: SOFTNESS, label: 'Softness', min: 0, max: SOFTNESS_MAX, step: 1, value: mesh.softness },
    { type: Control.Colour, id: BASE, label: 'Base', value: mesh.base },
    { type: Control.Button, id: ADD, label: 'Add point' },
    { type: Control.Button, id: REMOVE, label: 'Remove point' },
    { type: Control.Button, id: RANDOMIZE, label: 'Randomize' }
  ];
}

export const handlesOf = (mesh: Mesh, selected: string): Handle[] => mesh.points.map((p) => ({ id: p.id, x: p.x, y: p.y, color: p.color, selected: p.id === selected }));
