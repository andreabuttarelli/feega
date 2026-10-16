import type { DocEdited } from '$lib/motion/frames-request';
import type { FrameBucket, FrameScope } from './frame-store';

export type WorkingScope = FrameScope & { bucket: FrameBucket };

export const workingDocPath = (scope: FrameScope) => `${scope.orgId}/${scope.projectId}/motion-drafts/${scope.nodeId}.json`;

export async function keepWorkingDoc(scope: WorkingScope, work: DocEdited): Promise<void> {
  const path = workingDocPath(scope);
  try {
    await scope.bucket.remove([path]);
    const { error } = await scope.bucket.upload(path, Buffer.from(JSON.stringify(work)), { contentType: 'application/json', upsert: false });
    if (error) {
      console.error('[motion-agent] working doc not kept', error.message);
    }
  } catch (e) {
    console.error('[motion-agent] working doc not kept', e);
  }
}

export async function dropWorkingDoc(scope: WorkingScope): Promise<void> {
  try {
    await scope.bucket.remove([workingDocPath(scope)]);
  } catch (e) {
    console.warn('[motion-agent] working doc not dropped', e);
  }
}

export async function readWorkingDoc(scope: WorkingScope): Promise<DocEdited | null> {
  try {
    const { data } = await scope.bucket.download(workingDocPath(scope));
    return data ? (JSON.parse(await data.text()) as DocEdited) : null;
  } catch {
    return null;
  }
}
