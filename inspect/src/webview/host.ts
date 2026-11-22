import { SOCKET_PATH, type HostMessage, type ViewMessage } from '../messages';
import { plain } from './plain';

declare const acquireVsCodeApi: undefined | (() => { postMessage: (message: HostMessage) => void });

type Link = { send: (message: HostMessage) => void; listen: (handle: (message: ViewMessage) => void) => void };

function postMessageLink(post: (message: HostMessage) => void): Link {
  return {
    send: post,
    listen: (handle) =>
      window.addEventListener('message', (event) => {
        if (event.data && typeof event.data.kind === 'string' && !event.data.type) {
          handle(event.data as ViewMessage);
        }
      })
  };
}

function socketLink(): Link {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  const socket = new WebSocket(`${scheme}://${location.host}${SOCKET_PATH}`);
  const queued: string[] = [];
  socket.addEventListener('open', () => queued.splice(0).forEach((text) => socket.send(text)));
  socket.addEventListener('close', () => document.body.setAttribute('data-host', 'closed'));
  return {
    send: (message) => {
      const text = JSON.stringify(message);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(text);
        return;
      }
      queued.push(text);
    },
    listen: (handle) => socket.addEventListener('message', (event) => handle(JSON.parse(String(event.data)) as ViewMessage))
  };
}

export const inVscode = typeof acquireVsCodeApi === 'function';

function linkOf(): Link {
  if (!inVscode) {
    return socketLink();
  }
  const api = acquireVsCodeApi();
  return postMessageLink((message) => api.postMessage(plain(message)));
}

const link = linkOf();

export const toHost = (message: HostMessage) => link.send(message);

export const fromHost = (handle: (message: ViewMessage) => void) => link.listen(handle);
