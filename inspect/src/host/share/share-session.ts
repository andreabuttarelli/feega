import { basename } from 'node:path';
import { HOST_PEER, type Point, type Present, type VisitorRole } from '../../../../packages/share-protocol/src/frame';
import { ShareState, ToView, type Source, type ViewMessage } from '../../messages';
import { CloudError, CloudFailure } from '../cloud-api';
import { Stored, type Platform } from '../platform';
import { Ended } from './client';

type ShareView = Extract<ViewMessage, { kind: ToView.Share }>;

export type ShareSessionDeps = {
  platform: Pick<Platform, 'share' | 'stored' | 'store'>;
  workspace: string;
  appUrl: () => string | null;
  post: (message: ViewMessage) => unknown;
};

const ENDED_TEXT: Record<Ended, string> = {
  [Ended.Idle]: 'The session closed after 30 minutes with nobody in it',
  [Ended.Expired]: 'The session reached its time limit',
  [Ended.Replaced]: 'Another Feega took over this session',
  [Ended.Closed]: 'The connection to the relay was lost'
};

const FAILURE_TEXT: Record<CloudFailure, string | null> = {
  [CloudFailure.PlanRequired]: 'Feega Cloud needs a paid plan',
  [CloudFailure.SeatsExhausted]: 'All editor seats are in use. Add seats in your Feega plan.',
  [CloudFailure.NotSignedIn]: 'Sign in to Feega to share',
  [CloudFailure.Http]: null
};

const NO_EDITOR = 'The editor is not running';

const reasonOf = (failure: unknown): string => {
  const known = failure instanceof CloudError ? FAILURE_TEXT[failure.failure] : null;
  return known ?? (failure as Error).message;
};

export function shareSession({ platform, workspace, appUrl, post }: ShareSessionDeps) {
  const port = platform.share;
  let state = ShareState.Idle;
  let name = basename(workspace);
  let canEdit = false;
  let live: { id: string; url: string; expiresAt: string } | null = null;
  let visitors: Present[] = [];
  let error: string | undefined;
  let hostSignal: { selection?: string; cursor?: Point } = {};
  const control = port?.control({
    onPresence: (present) => ((visitors = present), show(), showPeers()),
    onEnded: (why) => ((state = ShareState.Idle), (live = null), (visitors = []), (error = ENDED_TEXT[why]), show())
  });

  const view = (): ShareView => ({
    kind: ToView.Share,
    state,
    available: Boolean(port),
    name,
    canEdit,
    url: live?.url,
    expiresAt: live?.expiresAt,
    visitors,
    notice: !platform.stored<boolean>(Stored.ShareNotice),
    error
  });

  const hostPeer = (): Present[] => (hostSignal.selection || hostSignal.cursor ? [{ userId: HOST_PEER, name: 'Host', role: 'editor', ...hostSignal }] : []);

  const showPeers = async () => void (state === ShareState.Live && (await post({ kind: ToView.Peers, peers: [...visitors, ...hostPeer()] })));

  const hostSelected = (at: Source | null) => ((hostSignal = { ...hostSignal, selection: at ? `${at.file}:${at.line}:${at.col}` : undefined }), showPeers());

  const hostPointed = (at: Point | null) => ((hostSignal = { ...hostSignal, cursor: at ?? undefined }), showPeers());

  const show = async () => void (await post(view()));

  async function start(projectName: string, visitorsCanEdit: boolean) {
    if (!port || !control || state !== ShareState.Idle) {
      return;
    }
    name = projectName;
    canEdit = visitorsCanEdit;
    error = undefined;
    state = ShareState.Starting;
    await show();
    const editorUrl = await port.editorUrl();
    try {
      if (!editorUrl) {
        throw new Error(NO_EDITOR);
      }
      live = await control.start({ dir: workspace, projectName, editorUrl, appUrl: appUrl() ?? undefined, visitorsCanEdit });
      state = ShareState.Live;
      await platform.store(Stored.ShareNotice, true);
    } catch (failure) {
      state = ShareState.Idle;
      error = reasonOf(failure);
    }
    await show();
  }

  async function stop() {
    if (!control || !live) {
      return;
    }
    const { id } = live;
    live = null;
    visitors = [];
    state = ShareState.Idle;
    await show();
    await control.stop(id).catch((failure: Error) => ((error = failure.message), show()));
  }

  async function setRole(userId: string, role: VisitorRole) {
    if (!control || !live) {
      return;
    }
    error = undefined;
    await control.setRole(live.id, userId, role).catch((failure: unknown) => (error = reasonOf(failure)));
    await show();
  }

  return { show, start, stop, setRole, hostSelected, hostPointed, kick: (userId: string) => live && control?.kick(live.id, userId) };
}
