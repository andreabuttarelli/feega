import { describe, expect, it } from 'vitest';
import { readSubscription, removeSubscription, saveSubscription } from './push-subscriptions';
import { fakeDb } from './testing/fake-db';

const VALID = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'BKey', auth: 'authkey' } };

describe('readSubscription', () => {
  it('accepts what PushSubscription.toJSON produces', () => {
    expect(readSubscription({ ...VALID, expirationTime: null })).toEqual(VALID);
  });

  it.each([
    [null],
    [{}],
    [{ endpoint: 'http://insecure.test/x', keys: VALID.keys }],
    [{ endpoint: 'not a url', keys: VALID.keys }],
    [{ endpoint: VALID.endpoint, keys: { p256dh: 'x' } }],
    [{ endpoint: VALID.endpoint }]
  ])('rejects %j', (input) => {
    expect(readSubscription(input)).toBeNull();
  });
});

describe('saveSubscription and removeSubscription', () => {
  const owner = { userId: 'ada', orgId: 'org-1' };

  it('stores one row per endpoint and refreshes its keys on re-subscribe', async () => {
    const db = fakeDb({}, { unique: { push_subscriptions: ['endpoint'] } });

    await saveSubscription(db, owner, VALID);
    await saveSubscription(db, owner, { ...VALID, keys: { p256dh: 'BNew', auth: 'authkey' } });

    expect(db.tables.push_subscriptions).toEqual([expect.objectContaining({ user_id: 'ada', org_id: 'org-1', endpoint: VALID.endpoint, keys: { p256dh: 'BNew', auth: 'authkey' } })]);
  });

  it('removes only the callers own subscription', async () => {
    const db = fakeDb({
      push_subscriptions: [
        { endpoint: 'https://push.test/a', user_id: 'ada', org_id: 'org-1', keys: {} },
        { endpoint: 'https://push.test/b', user_id: 'bob', org_id: 'org-1', keys: {} }
      ]
    });

    await removeSubscription(db, 'ada', 'https://push.test/b');
    expect(db.tables.push_subscriptions).toHaveLength(2);

    await removeSubscription(db, 'ada', 'https://push.test/a');
    expect(db.tables.push_subscriptions.map((row) => row.user_id)).toEqual(['bob']);
  });
});
