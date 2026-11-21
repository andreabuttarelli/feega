import { basename } from 'node:path';
import type { Present } from '../../../../packages/share-protocol/src/frame';
import { VisitorRole, type CloudApi } from '../cloud-api';
import type { ShareHost, ShareInfo, ShareRequest } from '../share-port';
import { shareClient, type Ended, type ShareClient } from './client';
import { snapshotOf } from './snapshot';

export type ShareApi = Pick<CloudApi, 'startSession' | 'closeSession'>;

export type ShareHostDeps = {
  api: ShareApi;
  relayUrl: string;
  send: typeof fetch;
  onPresence?: (id: string, visitors: Present[]) => void;
  onEnded?: (id: string, why: Ended) => void;
};

export type ShareControl = ShareHost & { kick: (id: string, userId: string) => void };

export const RELAY_URL = 'wss://relay.s.feega.app/host';

const HTTP_PUT = 'PUT';
const ZIP_TYPE = 'application/zip';

export function shareHost({ api, relayUrl, send, onPresence, onEnded }: ShareHostDeps): ShareControl {
  const held = new Map<string, ShareClient>();

  async function start({ dir, editorUrl, appUrl, visitorsCanEdit }: ShareRequest): Promise<ShareInfo> {
    const role = visitorsCanEdit ? VisitorRole.Editor : VisitorRole.Viewer;
    const session = await api.startSession(basename(dir), role);
    const client = shareClient({
      relayUrl,
      hostToken: session.hostToken,
      editorUrl,
      appUrl,
      visitorOrigin: new URL(session.url).origin,
      onPresence: (visitors) => onPresence?.(session.id, visitors),
      onEnded: (why) => (held.delete(session.id), onEnded?.(session.id, why))
    });
    try {
      await client.ready;
    } catch (failure) {
      await api.closeSession(session.id).catch(() => undefined);
      throw failure;
    }
    held.set(session.id, client);
    return { id: session.id, url: session.url, expiresAt: session.expiresAt };
  }

  async function stop(id: string): Promise<void> {
    const client = held.get(id);
    if (!client) {
      throw new Error(`not sharing session ${id}`);
    }
    const snapshot = await snapshotOf(client.appUrl(), send);
    client.close();
    held.delete(id);
    const { snapshotUploadUrl } = await api.closeSession(id);
    if (snapshot && snapshotUploadUrl) {
      await send(snapshotUploadUrl, { method: HTTP_PUT, headers: { 'content-type': ZIP_TYPE }, body: snapshot as BodyInit }).catch(() => undefined);
    }
  }

  return { start, stop, kick: (id, userId) => held.get(id)?.kick(userId) };
}
