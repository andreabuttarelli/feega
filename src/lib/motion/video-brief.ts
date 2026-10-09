import { motionEditorPath } from '$lib/canvas/motion-node';

export const BRIEF_PARAM = 'brief';
export const BRIEF_MAX = 2000;
export const UNTITLED_VIDEO = 'Untitled video';

const NAME_WORDS = 6;

export type BriefTemplate = { id: string; name: string; brief: string };

export const BRIEF_TEMPLATES: readonly BriefTemplate[] = [
  { id: 'launch', name: 'Product launch', brief: 'A 15-second product launch teaser: bold titles, fast cuts, a clear call to action at the end.' },
  { id: 'app', name: 'App walkthrough', brief: 'A 20-second app walkthrough: the screens in a device, a cursor showing the three key steps, calm music.' },
  { id: 'logo', name: 'Logo reveal', brief: 'A 6-second logo reveal on a clean background, with a short tagline after it.' },
  { id: 'promo', name: 'Offer promo', brief: 'A vertical 10-second promo for a limited offer: price, deadline and a button-style call to action.' }
];

function hostOf(text: string): string | null {
  try {
    const url = new URL(text);
    return url.protocol.startsWith('http') ? url.hostname.replace(/^www\./, '') : null;
  } catch {
    return null;
  }
}

export function briefName(brief: string): string {
  const text = brief.trim();
  if (!text) {
    return UNTITLED_VIDEO;
  }

  return hostOf(text) ?? text.split(/\s+/).slice(0, NAME_WORDS).join(' ');
}

export enum BriefKind {
  Site = 'site',
  Text = 'text'
}

const BARE_URL = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i;

function siteUrl(text: string): string {
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

export function briefKind(brief: string): BriefKind {
  return BARE_URL.test(brief.trim()) ? BriefKind.Site : BriefKind.Text;
}

const MESSAGE_OF: Record<BriefKind, (text: string) => string> = {
  [BriefKind.Site]: (text) => `Make a launch film of ${siteUrl(text)}`,
  [BriefKind.Text]: (text) => text
};

export function briefMessage(brief: string): string {
  const text = brief.trim();
  return MESSAGE_OF[briefKind(text)](text);
}

export function briefEditorPath(start: { projectId: string; canvasId: string; nodeId: string }, brief: string): string {
  return `${motionEditorPath(start)}?${new URLSearchParams({ [BRIEF_PARAM]: brief })}`;
}
