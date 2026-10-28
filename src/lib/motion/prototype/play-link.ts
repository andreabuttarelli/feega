export type PlayTarget = { projectId: string; canvasId: string; nodeId: string };

export const playEndpoint = ({ projectId, canvasId, nodeId }: PlayTarget): string => `/p/${projectId}/c/${canvasId}/motion/${nodeId}/play`;

export async function requestPlayLink(fetcher: typeof fetch, endpoint: string): Promise<string | null> {
  try {
    const res = await fetcher(endpoint, { method: 'POST' });
    return res.ok ? ((await res.json()) as { url: string }).url : null;
  } catch {
    return null;
  }
}

export enum LinkState {
  Idle = 'idle',
  Working = 'working',
  Copied = 'copied',
  Failed = 'failed'
}

export const LINK_LABEL: Record<LinkState, string> = {
  [LinkState.Idle]: 'Copy play link',
  [LinkState.Working]: 'Making the link…',
  [LinkState.Copied]: 'Copied',
  [LinkState.Failed]: 'Could not make the link'
};
