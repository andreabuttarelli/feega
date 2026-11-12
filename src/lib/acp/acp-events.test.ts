import { describe, expect, it } from 'vitest';
import { AcpEventKind, encodeAcpEvent, readAcpEvents, type AcpEvent } from './acp-events';

const streamOf = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      chunks.forEach((s) => c.enqueue(new TextEncoder().encode(s)));
      c.close();
    }
  });

describe('acp events', () => {
  it('reads back events split across arbitrary chunks', async () => {
    const wire = encodeAcpEvent({ kind: AcpEventKind.Done, stopReason: 'end_turn' }) + encodeAcpEvent({ kind: AcpEventKind.Failed, message: 'x' });
    const out: AcpEvent[] = [];
    for await (const e of readAcpEvents(streamOf([wire.slice(0, 7), wire.slice(7, 30), wire.slice(30)]))) {
      out.push(e);
    }

    expect(out).toEqual([{ kind: AcpEventKind.Done, stopReason: 'end_turn' }, { kind: AcpEventKind.Failed, message: 'x' }]);
  });
});
