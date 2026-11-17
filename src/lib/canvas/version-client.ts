import { VersionAction } from './version-frame';
import type { CommitStep, Versions } from './ref-choices';

export { VersionAction };
export type { CommitStep };

export type Timeline = { steps: CommitStep[]; at: number };

type Fetch = typeof fetch;

const JSON_HEADERS = { 'content-type': 'application/json' };

export function timelineOf(newestFirst: readonly CommitStep[], sha: string): Timeline {
  const steps = [...newestFirst].reverse();
  const found = steps.findIndex((s) => s.sha === sha);
  return { steps, at: found === -1 ? steps.length - 1 : found };
}

const github = (projectId: string, path: string) => `/api/v1/projects/${projectId}/github/${path}`;

async function post(fetchFn: Fetch, url: string, body: unknown): Promise<Record<string, unknown> | null> {
  const res = await fetchFn(url, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) }).catch(() => null);
  return (await res?.json().catch(() => null)) as Record<string, unknown> | null;
}

export async function versionsOf(projectId: string, nodeId: string, fetchFn: Fetch = fetch): Promise<Versions | null> {
  const body = await post(fetchFn, github(projectId, 'versions'), { nodeId });
  return body?.ok ? (body as unknown as Versions) : null;
}

export async function historyOf(projectId: string, nodeId: string, fetchFn: Fetch = fetch): Promise<CommitStep[]> {
  const body = await post(fetchFn, github(projectId, 'versions'), { nodeId });
  return body?.ok ? (body.commits as CommitStep[]) : [];
}

export async function moveVersion(projectId: string, versionId: string, ref: string, fetchFn: Fetch = fetch): Promise<string | null> {
  const body = await post(fetchFn, github(projectId, 'compare'), { versionId, ref });
  return body?.ok ? ((body.versions as { frameId: string }[])[0]?.frameId ?? null) : null;
}

export async function compareRefs(projectId: string, nodeId: string, refs: string[], fetchFn: Fetch = fetch): Promise<string[]> {
  const body = await post(fetchFn, github(projectId, 'compare'), { nodeId, refs });
  return body?.ok ? (body.versions as { frameId: string }[]).map((v) => v.frameId) : [];
}

export type FileDiff = { path: string; before: string | null; after: string | null };

export async function versionAction(projectId: string, versionId: string, action: VersionAction, fetchFn: Fetch = fetch): Promise<Record<string, unknown> | null> {
  const body = await post(fetchFn, github(projectId, 'version-actions'), { versionId, action });
  return body?.ok ? body : null;
}
