import { z } from 'zod';
import type { LayoutStore } from './editor-layout';

export const RECENT_MAX = 8;

const STORAGE_KEY = 'motion-recent-colours';
const TOKEN = /^brand\.(primary|secondary|accent|background|text)$/;
const LONG = /^#?([0-9a-f]{6})$/i;
const SHORT = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const TOKEN_PREFIX = 'brand.';

export function parseColour(text: string): string | null {
  const trimmed = text.trim();
  if (TOKEN.test(trimmed)) {
    return trimmed;
  }
  const long = LONG.exec(trimmed);
  if (long) {
    return `#${long[1].toLowerCase()}`;
  }
  const short = SHORT.exec(trimmed);
  return short ? `#${short.slice(1).map((c) => c + c).join('').toLowerCase()}` : null;
}

export function colourLabel(value: string): string {
  if (value.startsWith(TOKEN_PREFIX)) {
    return `Brand ${value.slice(TOKEN_PREFIX.length)}`;
  }
  return value.replace('#', '').toUpperCase();
}

const recentSchema = z.array(z.string().regex(LONG)).max(RECENT_MAX);

export function readRecent(store: LayoutStore | null): string[] {
  try {
    const parsed = recentSchema.safeParse(JSON.parse(store?.getItem(STORAGE_KEY) ?? '[]'));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function remember(recent: readonly string[], hex: string, store: LayoutStore | null): string[] {
  const next = [hex, ...recent.filter((c) => c !== hex)].slice(0, RECENT_MAX);
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
}
