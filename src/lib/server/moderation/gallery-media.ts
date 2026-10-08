import type { ScreenOutcome } from './screen';
import type { Reference } from './people';

export enum MediaVerdict {
  Allowed = 'allowed',
  Refused = 'refused',
  Unknown = 'unknown'
}

export type MediaJudge = (reference: Reference) => Promise<MediaVerdict>;

export const GALLERY_MEDIA_REFUSAL = 'Refused: a picture or video in this video is not suitable for the public gallery.';
const JUDGE_DOWN = 'moderation_unavailable: the media check for the gallery could not run';

export const GALLERY_MEDIA_SYSTEM = [
  'You check one image or video that will be shown to anyone in a public gallery of short motion videos.',
  'Refuse nudity or sexual content, anything involving minors in a suggestive way, graphic violence or gore, self-harm, hate symbols or slurs, weapons used against people, illegal drugs, and private data such as documents, IDs or faces of private people shown as the subject.',
  'Logos, products, interfaces, abstract shapes, landscapes, illustrations and ordinary stock-like pictures are allowed.',
  'Answer with JSON only: {"allowed": boolean, "why": string}.'
].join('\n');

const OUTCOME_OF: Readonly<Record<MediaVerdict, ScreenOutcome>> = {
  [MediaVerdict.Allowed]: { ok: true },
  [MediaVerdict.Refused]: { ok: false, error: GALLERY_MEDIA_REFUSAL },
  [MediaVerdict.Unknown]: { ok: false, error: GALLERY_MEDIA_REFUSAL }
};

export function parseMediaVerdict(raw: string): MediaVerdict {
  try {
    const allowed = (JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as { allowed?: unknown }).allowed;
    if (typeof allowed !== 'boolean') {
      return MediaVerdict.Unknown;
    }
    return allowed ? MediaVerdict.Allowed : MediaVerdict.Refused;
  } catch {
    return MediaVerdict.Unknown;
  }
}

export async function screenGalleryMedia(judge: MediaJudge, references: readonly Reference[]): Promise<ScreenOutcome> {
  if (!references.length) {
    return { ok: true };
  }

  let verdicts: MediaVerdict[];
  try {
    verdicts = await Promise.all(references.map(judge));
  } catch {
    return { ok: false, error: JUDGE_DOWN, unavailable: true };
  }

  return verdicts.map((verdict) => OUTCOME_OF[verdict]).find((outcome) => !outcome.ok) ?? { ok: true };
}
