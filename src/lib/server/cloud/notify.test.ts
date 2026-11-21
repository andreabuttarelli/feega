import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { notifySessionShared, pushToUsers, type NotifyStore, type StoredSubscription } from './notify';
import { PushOutcome } from './push';
import type { SessionRow } from './sessions';

const KEYS = { publicKey: 'p', privateKey: 'k', subject: 'mailto:a@b.co' };

const SESSION: SessionRow = {
  id: 'abcdefghij',
  org_id: 'org-1',
  project_id: 'proj-1',
  host_user_id: 'host-1',
  project_name: 'Landing',
  visitor_role: 'editor',
  status: 'live',
  started_at: '2026-11-21T10:00:00Z',
  closed_at: null,
  expires_at: '2026-11-21T22:00:00Z',
  snapshot_path: null
};

function sub(userId: string, n = 1): StoredSubscription {
  return { endpoint: `https://push.test/${userId}/${n}`, userId, keys: { p256dh: 'a', auth: 'b' } };
}

function store(members: string[], subscriptions: StoredSubscription[]) {
  const dropped: string[] = [];
  const notifyStore: NotifyStore = {
    memberIds: async () => members,
    subscriptionsOf: async (ids) => subscriptions.filter((s) => ids.includes(s.userId)),
    dropSubscriptions: async (endpoints) => void dropped.push(...endpoints),
    commentsBetween: async () => [],
    contactOf: async () => null
  };

  return { notifyStore, dropped };
}

describe('notifySessionShared', () => {
  it('pushes to subscribed teammates and never to the host', async () => {
    const { notifyStore } = store(['host-1', 'ada', 'bob'], [sub('host-1'), sub('ada')]);
    const send = vi.fn().mockResolvedValue(PushOutcome.Delivered);

    const reached = await notifySessionShared({ store: notifyStore, keys: KEYS, send }, SESSION, 'Grace', 'https://oh.feega.app');

    expect(reached).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].endpoint).toBe('https://push.test/ada/1');
    expect(send.mock.calls[0][1]).toEqual({ title: 'Grace shared Landing', body: 'Open the live session.', url: 'https://oh.feega.app/s/abcdefghij' });
  });

  it('sends nothing when push is not configured', async () => {
    const { notifyStore } = store(['ada'], [sub('ada')]);
    const send = vi.fn();

    const reached = await notifySessionShared({ store: notifyStore, keys: null, send }, SESSION, 'Grace', 'https://oh.feega.app');

    expect(reached).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('pushToUsers', () => {
  it('drops subscriptions the push service reports gone and survives a thrown send', async () => {
    const { notifyStore, dropped } = store([], [sub('ada', 1), sub('ada', 2), sub('ada', 3)]);
    const send = vi
      .fn()
      .mockResolvedValueOnce(PushOutcome.Gone)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(PushOutcome.Delivered);

    const delivered = await pushToUsers({ store: notifyStore, keys: KEYS, send }, ['ada'], { title: 't', body: 'b', url: 'u' });

    expect(dropped).toEqual(['https://push.test/ada/1']);
    expect(delivered.get('ada')).toBe(1);
  });
});
