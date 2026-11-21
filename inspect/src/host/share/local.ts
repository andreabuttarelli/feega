import { request as httpRequest, type ClientRequest, type IncomingHttpHeaders } from 'node:http';
import { SET_COOKIE_SEPARATOR, type Headers, type ReqHead } from '../../../../packages/share-protocol/src/frame';
import { VISITOR_HEADER } from '../../../../packages/share-protocol/src/visitor';
import { Target } from './routes';

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'host', 'content-length']);

export type LocalOrigins = { editor: URL; app: () => URL | null };

export const originOf = (url: URL) => url.origin;

export function localHeaders(headers: Headers, local: URL, visitorOrigin: string, target: Target): Headers {
  const out: Headers = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (HOP_BY_HOP.has(lower) || (target === Target.App && lower === VISITOR_HEADER)) {
      continue;
    }
    out[lower] = lower === 'origin' || lower === 'referer' ? value.split(visitorOrigin).join(originOf(local)) : value;
  }
  return { ...out, host: local.host };
}

export function replyHeaders(headers: IncomingHttpHeaders): Headers {
  const out: Headers = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || HOP_BY_HOP.has(name)) {
      continue;
    }
    out[name] = Array.isArray(value) ? value.join(name === 'set-cookie' ? SET_COOKIE_SEPARATOR : ', ') : value;
  }
  return out;
}

export type LocalReply = {
  head: (status: number, headers: Headers) => void;
  body: (bytes: Uint8Array) => void;
  end: () => void;
  fail: (message: string) => void;
};

export function localRequest(base: URL, head: ReqHead, headers: Headers, reply: LocalReply): ClientRequest {
  const upstream = httpRequest({ host: base.hostname, port: base.port, path: head.path, method: head.method, headers }, (response) => {
    reply.head(response.statusCode ?? 502, replyHeaders(response.headers));
    response.on('data', (chunk: Buffer) => reply.body(chunk));
    response.on('end', reply.end);
    response.on('error', (error) => reply.fail(error.message));
  });
  upstream.on('error', (error) => reply.fail(error.message));
  return upstream;
}
