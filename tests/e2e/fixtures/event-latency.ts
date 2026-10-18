export type TraceEvent = { name: string; ph: string; ts: number; id2?: { local?: string } };

export const EVENT_LATENCY_CATEGORIES = ['input', 'latencyInfo', 'benchmark'];

const EVENT_LATENCY = 'EventLatency';
const US_PER_MS = 1000;

export function presentedLatencies(events: TraceEvent[]): number[] {
  const open = new Map<string, number>();
  const out: number[] = [];
  const ordered = events.filter((e) => e.name === EVENT_LATENCY && e.id2?.local).sort((a, b) => a.ts - b.ts);

  for (const e of ordered) {
    const id = e.id2!.local!;
    if (e.ph === 'b') {
      open.set(id, e.ts);
      continue;
    }
    const began = open.get(id);
    if (e.ph !== 'e' || began === undefined) {
      continue;
    }
    open.delete(id);
    out.push((e.ts - began) / US_PER_MS);
  }

  return out;
}
