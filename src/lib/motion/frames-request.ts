import type { MotionDoc } from './doc';
import type { AssetKind } from './components';

export const FRAMES_REQUEST = 'data-motion-frames';

export type AgentAsset = { id: string; kind: AssetKind; label: string; previewUrl: string; url: string | null };

export type FramesRequest = { callId: string; times: number[]; doc: MotionDoc; assets?: AgentAsset[] };

export const CHECK_REQUEST = 'data-motion-check';

export const ASSETS_ADDED = 'data-motion-assets';

export const DOC_EDITED = 'data-motion-doc';

export type DocEdited = { edit: number; doc: MotionDoc };

export type CheckRequest = { callId: string; name: string; doc: MotionDoc; assets?: AgentAsset[] };

export function adoptAgentAssets<T extends AgentAsset>(known: T[], incoming: T[] | undefined): T[] {
  const fresh = (incoming ?? []).filter((a) => !known.some((k) => k.id === a.id));
  return fresh.length ? [...fresh, ...known] : known;
}

export type AgentDraft = DocEdited | null;

type Part = { type: string; data: unknown };

const DRAFT_OF: Record<string, (shown: AgentDraft, data: unknown) => AgentDraft> = {
  [DOC_EDITED]: (shown, data) => {
    const edited = data as DocEdited;
    return shown && shown.edit >= edited.edit ? shown : edited;
  },
  [FRAMES_REQUEST]: (shown, data) => ({ edit: shown?.edit ?? 0, doc: (data as FramesRequest).doc })
};

export function agentDraft(shown: AgentDraft, part: Part): AgentDraft {
  const next = DRAFT_OF[part.type];
  return next ? next(shown, part.data) : shown;
}

export enum Head {
  Newer = 'newer',
  Same = 'same'
}

export enum Landing {
  Head = 'head',
  KeepDraft = 'keep-draft',
  Nothing = 'nothing'
}

export function landTurn(draft: AgentDraft, head: Head): Landing {
  if (head === Head.Newer) {
    return Landing.Head;
  }
  return draft ? Landing.KeepDraft : Landing.Nothing;
}
