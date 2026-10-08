import type { MotionDoc } from './doc';
import type { AssetKind } from './components';

export const FRAMES_REQUEST = 'data-motion-frames';

export type AgentAsset = { id: string; kind: AssetKind; label: string; previewUrl: string; url: string | null };

export type FramesRequest = { callId: string; times: number[]; doc: MotionDoc; assets?: AgentAsset[] };

export const CHECK_REQUEST = 'data-motion-check';

export const ASSETS_ADDED = 'data-motion-assets';

export type CheckRequest = { callId: string; name: string; doc: MotionDoc; assets?: AgentAsset[] };

export function adoptAgentAssets<T extends AgentAsset>(known: T[], incoming: T[] | undefined): T[] {
  const fresh = (incoming ?? []).filter((a) => !known.some((k) => k.id === a.id));
  return fresh.length ? [...fresh, ...known] : known;
}

export function agentDraft(shown: MotionDoc | null, part: { type: string; data: unknown }): MotionDoc | null {
  return part.type === FRAMES_REQUEST ? (part.data as FramesRequest).doc : shown;
}
