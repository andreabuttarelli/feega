import type { HostMessage, ViewMessage } from '../messages';

declare function acquireVsCodeApi(): { postMessage: (message: HostMessage) => void };

const api = acquireVsCodeApi();

export const toHost = (message: HostMessage) => api.postMessage(message);

export function fromHost(handle: (message: ViewMessage) => void) {
  window.addEventListener('message', (event) => {
    if (event.data && typeof event.data.kind === 'string' && !event.data.type) {
      handle(event.data as ViewMessage);
    }
  });
}
