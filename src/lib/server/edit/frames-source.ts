import type { Answer } from './runners';

export enum FramesSource {
  Local = 'local',
  Remote = 'remote',
  Closed = 'closed'
}

export const DEFAULT_REMOTE_RENDER_URL = 'https://oh.feega.app';

const REMOTE_OFF = 'off';
const HTTP_BAD_GATEWAY = 502;

type Env = Record<string, string | undefined>;

export function remoteRenderUrl(env: Env): string | null {
  const url = env.REMOTE_RENDER_URL ?? DEFAULT_REMOTE_RENDER_URL;
  return url === REMOTE_OFF ? null : url.replace(/\/+$/, '');
}

export function framesSource(input: { open: boolean; remoteUrl: string | null; ownOrigin: string }): FramesSource {
  if (input.open) {
    return FramesSource.Local;
  }
  return input.remoteUrl && input.remoteUrl !== input.ownOrigin ? FramesSource.Remote : FramesSource.Closed;
}

export type RemoteFramesAsk = { nodeId: string; times: number[]; width?: number; bearer: string; org?: string };

export async function fetchRemoteFrames(baseUrl: string, ask: RemoteFramesAsk, fetcher: typeof fetch = fetch): Promise<Answer> {
  const query = ask.org ? `?${new URLSearchParams({ org: ask.org })}` : '';
  try {
    const res = await fetcher(`${baseUrl}/api/v1/motion/${encodeURIComponent(ask.nodeId)}/frames${query}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ask.bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ times: ask.times, ...(ask.width ? { width: ask.width } : {}) })
    });
    return { status: res.status, body: await res.json().catch(() => ({ error: 'remote_render_bad_answer' })) };
  } catch {
    return { status: HTTP_BAD_GATEWAY, body: { error: 'remote_render_unreachable', detail: `the remote renderer at ${baseUrl} did not answer` } };
  }
}
