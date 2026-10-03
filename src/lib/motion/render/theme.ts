import { loadFont as loadSans } from '@remotion/google-fonts/DMSans';
import { loadFont as loadMono } from '@remotion/google-fonts/FragmentMono';

export const SANS = loadSans('normal', { weights: ['400', '500', '600'], subsets: ['latin'] }).fontFamily;
export const MONO = loadMono('normal', { weights: ['400'], subsets: ['latin'] }).fontFamily;

export const FONT_FAMILY: Record<'sans' | 'mono', string> = { sans: SANS, mono: MONO };

export const INK = { paper: '#ffffff', paper2: '#f5f5f3', line: '#e4e4e2', ink: '#111111', inkSoft: '#6b6b6b', select: '#a855f7' } as const;
