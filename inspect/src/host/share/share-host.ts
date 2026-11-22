import { basename } from 'node:path';
import type { Present, VisitorRole as Role } from '../../../../packages/share-protocol/src/frame';
import { VisitorRole, type CloudApi } from '../cloud-api';
import type { ShareHost, ShareInfo, ShareRequest } from '../share-port';
import { shareClient, type Ended, type ShareClient } from './client';
import { snapshotOf } from './snapshot';

export type ShareApi = Pick<CloudApi, 'startSession' | 'closeSession' | 'setMember'>;

export type ShareHostDeps = {
  api: ShareApi;
  relayUrl: string;
  send: typeof fetch;
  onPresence?: (id: string, visitors: Present[]) => void;
  onEnded?: (id: string, why: Ended) => void;
};

export type ShareControl = ShareHost & { kick: (id: string, userId: string) => void; setRole: (id: string, userId: string, role: Role) => Promise<void> };

export const RELAY_URL = 'ws://127.0.0.1:8787/host';

const HTTP_PUT = 'PUT';
const ZIP_TYPE = 'application/zip';
const API_ROLES: Record<Role, VisitorRole> = { viewer: VisitorRole.Viewer, editor: VisitorRole.Editor };

export function shareHost({ api, relayUrl, send, onPresence, onEnded }: ShareHostDeps): ShareControl {
  const held = new Map<string, ShareClient>();

  async function start({ dir, projectName, editorUrl, appUrl, visitorsCanEdit }: ShareRequest): Promise<ShareInfo> {
    const role = visitorsCanEdit ? VisitorRole.Editor : VisitorRole.Viewer;
    const session = await api.startSession(projectName ?? basename(dir), role);
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

  async function setRole(id: string, userId: string, role: Role): Promise<void> {
    await api.setMember(id, userId, API_ROLES[role]);
    held.get(id)?.setRole(userId, role);
  }

  return { start, stop, kick: (id, userId) => held.get(id)?.kick(userId), setRole };
}
