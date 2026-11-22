import { describe, expect, it } from 'vitest';
import { CloudError, CloudFailure } from '../cloud-api';
import { ShareState, ToView, type ViewMessage } from '../../messages';
import { Stored } from '../platform';
import type { ShareControl } from './share-host';
import type { ShareHooks, SharePort } from './share-port-factory';
import { shareSession } from './share-session';

type Shared = Extract<ViewMessage, { kind: ToView.Share }>;

function rig(over: { control?: Partial<ShareControl>; editorUrl?: string | null; withShare?: boolean } = {}) {
  const posted: Shared[] = [];
  const stored = new Map<string, unknown>();
  const requests: unknown[] = [];
  let hooks: ShareHooks | null = null;
  const control: ShareControl = {
    start: async (request) => (requests.push(request), { id: 'sess-1', url: 'https://abcdefghij.sessions.test', expiresAt: '2026-11-22T00:00:00Z' }),
    stop: async () => undefined,
    kick: () => undefined,
    setRole: async () => undefined,
    ...over.control
  };
  const share: SharePort = { editorUrl: async () => (over.editorUrl === undefined ? 'http://127.0.0.1:9/' : over.editorUrl), control: (h) => ((hooks = h), control) };
  const platform = { share: over.withShare === false ? undefined : share, stored: <T>(key: Stored) => stored.get(key) as T | undefined, store: async (key: Stored, value: unknown) => void stored.set(key, value) };
  const session = shareSession({ platform, workspace: '/work/My App', appUrl: () => 'http://127.0.0.1:5173/', post: (m) => void (m.kind === ToView.Share && posted.push(m)) });
  return { session, posted, stored, requests, hooks: () => hooks!, last: () => posted[posted.length - 1] };
}

describe('shareSession', () => {
  it('starts idle with the folder name and the first share notice', async () => {
    const { session, last } = rig();

    await session.show();

    expect(last()).toMatchObject({ state: ShareState.Idle, available: true, name: 'My App', canEdit: false, notice: true, visitors: [] });
  });

  it('reports that sharing is not available where there is no share port', async () => {
    const { session, last } = rig({ withShare: false });

    await session.show();

    expect(last().available).toBe(false);
  });

  it('shares through the port and goes live with the link', async () => {
    const { session, posted, requests, last } = rig();

    await session.start('Landing', true);

    expect(requests).toEqual([{ dir: '/work/My App', projectName: 'Landing', editorUrl: 'http://127.0.0.1:9/', appUrl: 'http://127.0.0.1:5173/', visitorsCanEdit: true }]);
    expect(posted[0]).toMatchObject({ state: ShareState.Starting, name: 'Landing' });
    expect(last()).toMatchObject({ state: ShareState.Live, url: 'https://abcdefghij.sessions.test', expiresAt: '2026-11-22T00:00:00Z', canEdit: true });
  });

  it('remembers that the notice was seen', async () => {
    const { session, stored, last } = rig();

    await session.start('x', false);
    await session.show();

    expect(stored.get(Stored.ShareNotice)).toBe(true);
    expect(last().notice).toBe(false);
  });

  it('shows who is here', async () => {
    const { session, hooks, last } = rig();
    await session.start('x', false);

    hooks().onPresence([{ userId: 'u', name: 'Ada', role: 'viewer' }]);

    expect(last().visitors).toEqual([{ userId: 'u', name: 'Ada', role: 'viewer' }]);
  });

  it('goes back to idle with the reason when the session ends', async () => {
    const { session, hooks, last } = rig();
    await session.start('x', false);

    hooks().onEnded('idle' as never);

    expect(last()).toMatchObject({ state: ShareState.Idle, error: 'The session closed after 30 minutes with nobody in it' });
  });

  it('says what to do when the plan is missing or the user is signed out', async () => {
    for (const [failure, text] of [[CloudFailure.PlanRequired, 'Feega Cloud needs a paid plan'], [CloudFailure.NotSignedIn, 'Sign in to Feega to share']] as const) {
      const { session, last } = rig({ control: { start: async () => Promise.reject(new CloudError(failure, 'x')) } });

      await session.start('x', false);

      expect(last()).toMatchObject({ state: ShareState.Idle, error: text });
    }
  });

  it('shows any other failure as it is', async () => {
    const { session, last } = rig({ control: { start: async () => Promise.reject(new Error('relay down')) } });

    await session.start('x', false);

    expect(last()).toMatchObject({ state: ShareState.Idle, error: 'relay down' });
  });

  it('needs an editor to share', async () => {
    const { session, last } = rig({ editorUrl: null });

    await session.start('x', false);

    expect(last().error).toBe('The editor is not running');
  });

  it('stops the session it started and clears the link', async () => {
    const stopped: string[] = [];
    const { session, last } = rig({ control: { stop: async (id) => void stopped.push(id) } });
    await session.start('x', false);

    await session.stop();

    expect(stopped).toEqual(['sess-1']);
    expect(last()).toMatchObject({ state: ShareState.Idle, url: undefined, visitors: [] });
  });

  it('kicks a visitor of the live session', async () => {
    const kicked: string[][] = [];
    const { session } = rig({ control: { kick: (id, userId) => void kicked.push([id, userId]) } });
    await session.start('x', false);

    session.kick('u-1');

    expect(kicked).toEqual([['sess-1', 'u-1']]);
  });

  it('promotes a visitor of the live session', async () => {
    const changed: string[][] = [];
    const { session } = rig({ control: { setRole: async (id, userId, role) => void changed.push([id, userId, role]) } });
    await session.start('x', false);

    await session.setRole('u-1', 'editor');

    expect(changed).toEqual([['sess-1', 'u-1', 'editor']]);
  });

  it('says why a promotion was refused', async () => {
    const { session, last } = rig({ control: { setRole: async () => Promise.reject(new CloudError(CloudFailure.SeatsExhausted, 'No editor seats left', 402)) } });
    await session.start('x', false);

    await session.setRole('u-1', 'editor');

    expect(last().error).toBe('All editor seats are in use. Add seats in your Feega plan.');
  });

  it('does not start twice', async () => {
    const { session, requests } = rig();

    await session.start('x', false);
    await session.start('x', false);

    expect(requests).toHaveLength(1);
  });
});
