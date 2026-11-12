export enum AcpEventKind {
  Update = 'update',
  Permission = 'permission',
  Done = 'done',
  Failed = 'failed'
}

export type AcpOption = { optionId: string; name: string; kind: string };

export type AcpUpdate = { sessionUpdate: string; content?: { type: string; text?: string }; title?: string };

export type AcpEvent =
  | { kind: AcpEventKind.Update; update: AcpUpdate }
  | { kind: AcpEventKind.Permission; id: string; title: string; options: AcpOption[] }
  | { kind: AcpEventKind.Done; stopReason: string }
  | { kind: AcpEventKind.Failed; message: string };

const EVENT_END = '\n\n';
const DATA_PREFIX = 'data: ';

export const encodeAcpEvent = (event: AcpEvent) => `${DATA_PREFIX}${JSON.stringify(event)}${EVENT_END}`;

export async function* readAcpEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<AcpEvent> {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let end = buffer.indexOf(EVENT_END);

    while (end !== -1) {
      const frame = buffer.slice(0, end);
      buffer = buffer.slice(end + EVENT_END.length);
      end = buffer.indexOf(EVENT_END);

      if (!frame.startsWith(DATA_PREFIX)) {
        continue;
      }

      yield JSON.parse(frame.slice(DATA_PREFIX.length)) as AcpEvent;
    }
  }
}
