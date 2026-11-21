import type { ShareHost } from '../../../inspect/src/host/share-port';

const MESSAGE = 'Sharing is not available in this version of Feega yet.';

export const shareUnavailable: ShareHost = {
  start: () => Promise.reject(new Error(MESSAGE)),
  stop: () => Promise.reject(new Error(MESSAGE))
};
