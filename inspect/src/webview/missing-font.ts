import type { MissingFont } from '../messages';
import { GOOGLE_FONTS } from './fonts';

export enum FontAction {
  LoadFromGoogle = 'load-from-google',
  ReplaceOnly = 'replace-only'
}

const unquoted = (name: string) => name.trim().replace(/^["']|["']$/g, '').toLowerCase();

export function missingIn(stack: string, missing: MissingFont[]): MissingFont | null {
  const names = stack.split(',').map(unquoted);
  return missing.find((m) => names.includes(m.family.toLowerCase())) ?? null;
}

export const noticeText = (m: MissingFont) => `${m.family} isn't installed or loaded. Text falls back to ${m.fallback}.`;

export function offeredAction(m: MissingFont): FontAction {
  const onGoogle = GOOGLE_FONTS.some((f) => f.family.toLowerCase() === m.family.toLowerCase());
  return onGoogle && !m.declared ? FontAction.LoadFromGoogle : FontAction.ReplaceOnly;
}
