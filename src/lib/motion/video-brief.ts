import { motionEditorPath } from '$lib/canvas/motion-node';
import { parseAttachments } from '$lib/chat-attachments';

export const BRIEF_PARAM = 'brief';
export const ATTACH_PARAM = 'attach';
export const FILES_ONLY_BRIEF = 'Make a video from the attached files';
export const BRIEF_MAX = 2000;
export const UNTITLED_VIDEO = 'Untitled video';

const NAME_WORDS = 6;

export type BriefTemplate = { id: string; name: string; brief: string };

export const BRIEF_TEMPLATES: readonly BriefTemplate[] = [
  { id: 'posters', name: 'a launch poster series', brief: 'A series of three launch posters in one style: a bold headline, the product, a date. Lay them side by side.' },
  { id: 'teaser', name: 'an animated product teaser', brief: 'A 10-second animated product teaser: the interface shown one element at a time, a title card, a clear call to action.' },
  { id: 'moodboard', name: 'moodboard to motion', brief: 'Start a moodboard of six images in one mood, then turn it into a short looping motion piece.' },
  { id: 'onboarding', name: 'an onboarding flow in motion', brief: 'Three onboarding screens for a mobile app, then a short animation moving from one to the next.' },
  { id: 'social', name: 'a set of social stills', brief: 'Four square social posts that share a grid, a type scale and one accent colour.' }
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

const ID_SEPARATOR = ',';

export function briefEditorPath(start: { projectId: string; canvasId: string; nodeId: string }, brief: string, attachmentIds: readonly string[] = []): string {
  const params = new URLSearchParams({ [BRIEF_PARAM]: brief });
  if (attachmentIds.length) {
    params.set(ATTACH_PARAM, attachmentIds.join(ID_SEPARATOR));
  }

  return `${motionEditorPath(start)}?${params}`;
}

export function briefAttachmentIds(url: URL): string[] {
  return parseAttachments(url.searchParams.get(ATTACH_PARAM)?.split(ID_SEPARATOR) ?? []);
}
