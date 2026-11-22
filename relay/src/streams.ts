import { SET_COOKIE_SEPARATOR, type ResHead } from '../../packages/share-protocol/src/frame';

const HTTP_BAD_GATEWAY = 502;
const HTTP_GATEWAY_TIMEOUT = 504;
const BODYLESS = new Set([101, 204, 205, 304]);

export const headersOf = (record: Record<string, string>): Headers => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(record)) {
    const values = name.toLowerCase() === 'set-cookie' ? value.split(SET_COOKIE_SEPARATOR) : [value];
    values.forEach((each) => headers.append(name, each));
  }
  return headers;
};

export const failure = (status: number, message: string) => new Response(message, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export type Pending = {
  head: (head: ResHead) => void;
  body: (bytes: Uint8Array) => void;
  end: () => void;
  fail: (message: string) => void;
  timeout: () => void;
};

export function pendingResponse(): { response: Promise<Response>; pending: Pending } {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  let started = false;
  let settle: (response: Response) => void = () => undefined;
  const response = new Promise<Response>((resolve) => (settle = resolve));

  const pending: Pending = {
    head: (head) => {
      started = true;
      const bodyless = BODYLESS.has(head.status);
      settle(new Response(bodyless ? null : readable, { status: head.status, headers: headersOf(head.headers) }));
      bodyless && writer.close().catch(() => undefined);
    },
    body: (bytes) => void writer.write(bytes).catch(() => undefined),
    end: () => void writer.close().catch(() => undefined),
    fail: (message) => {
      started ? writer.abort(message).catch(() => undefined) : settle(failure(HTTP_BAD_GATEWAY, message));
    },
    timeout: () => {
      started || settle(failure(HTTP_GATEWAY_TIMEOUT, 'the host did not answer'));
    }
  };
  return { response, pending };
}
