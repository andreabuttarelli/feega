export type SourcesHead = { tokens: unknown; signed?: Record<string, string> };

export type FrameMeta = { id: string; revision: number; assets: Record<string, string>; media?: Record<string, unknown> };

export type WiredFrame = { meta: FrameMeta; docText: string };

export const SOURCES_TYPE = 'application/x-ndjson';

const LINE = '\n';

const SOURCES_FORMAT = 'frame-lines/1';

type MarkedHead = SourcesHead & { format?: string };

export const writeSources = (head: SourcesHead, frames: WiredFrame[]): string => [JSON.stringify({ format: SOURCES_FORMAT, ...head }), ...frames.flatMap((f) => [JSON.stringify(f.meta), f.docText])].join(LINE);

export function readSources(text: string): { head: SourcesHead; frames: Map<string, WiredFrame> } | null {
  const [first, ...lines] = text.split(LINE);
  const { format, ...head } = JSON.parse(first) as MarkedHead;
  if (format !== SOURCES_FORMAT) {
    return null;
  }

  const frames = new Map<string, WiredFrame>();
  for (let at = 0; at + 1 < lines.length; at += 2) {
    const meta = JSON.parse(lines[at]) as FrameMeta;
    frames.set(meta.id, { meta, docText: lines[at + 1] });
  }
  return { head, frames };
}
