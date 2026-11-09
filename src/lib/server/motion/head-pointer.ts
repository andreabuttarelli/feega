import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import type { HeadPointer } from '$lib/server/repos/motion-revisions';

export const headPointer = (record: CanvasNodeRecord): HeadPointer => ({ nodeId: record.id, version: Number(record.data.docHeadRevision) || null });
