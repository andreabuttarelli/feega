import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('../email', () => ({ sendEmail: vi.fn() }));

import { sendEmail } from '../email';
import { OnceOutcome, sendOnce, type OnceStore } from '../cloud-emails/send-once';
import { EmailKind } from '../cloud-emails/templates';
import { DIGEST_WINDOW_MS, runDigest, windowEndingAt, type Mailer } from './digest';
import { PushOutcome } from './push';
import type { DigestCommentRow, NotifyStore, StoredSubscription } from './notify';

const KEYS = { publicKey: 'p', privateKey: 'k', subject: 'mailto:a@b.co' };
const NOW = new Date('2026-11-21T10:22:31Z');
const HOST = 'host-1';

function comment(over: Partial<DigestCommentRow> = {}): DigestCommentRow {
  return {
    sessionId: 'abcdefghij',
    projectName: 'Landing',
    hostId: HOST,
    authorId: 'visitor-1',
    authorName: 'Ada',
    body: 'Tighten this padding',
    selector: 'main > h1',
    sourceFile: 'src/Hero.tsx',
    sourceLine: 12,
    ...over
  };
}

function store(rows: DigestCommentRow[], subscriptions: StoredSubscription[] = []): NotifyStore & { commentsBetween: ReturnType<typeof vi.fn> } {
  return {
    memberIds: async () => [],
    subscriptionsOf: async (ids) => subscriptions.filter((sub) => ids.includes(sub.userId)),
    dropSubscriptions: async () => {},
    commentsBetween: vi.fn(async () => rows),
    contactOf: async (id) => (id === HOST ? { email: 'host@example.com', name: 'Host' } : null)
  };
}

function memoryStore(): OnceStore {
  const seen = new Set<string>();
  return {
    claim: async (userId, kind, refId) => {
      const key = `${userId}|${kind}|${refId}`;
      return seen.has(key) ? false : (seen.add(key), true);
    },
    release: async () => {}
  };
}

describe('windowEndingAt', () => {
  it('is the last whole 15-minute window', () => {
    const { from, to } = windowEndingAt(NOW);

    expect(to.toISOString()).toBe('2026-11-21T10:15:00.000Z');
    expect(to.getTime() - from.getTime()).toBe(DIGEST_WINDOW_MS);
  });
});

describe('runDigest', () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockReset();
  });

  const subscription: StoredSubscription = { endpoint: 'https://push.test/1', userId: HOST, keys: { p256dh: 'a', auth: 'b' } };

  it('asks for the comments of the window just closed', async () => {
    const notifyStore = store([]);

    await runDigest({ store: notifyStore, keys: KEYS, appUrl: 'https://oh.feega.app' }, NOW);

    expect(notifyStore.commentsBetween).toHaveBeenCalledWith(new Date('2026-11-21T10:00:00Z'), new Date('2026-11-21T10:15:00Z'));
  });

  it('pushes one message per session when the host has a subscription', async () => {
    const send = vi.fn().mockResolvedValue(PushOutcome.Delivered);
    const mail = vi.fn();

    const tally = await runDigest({ store: store([comment(), comment({ body: 'And the colour' })], [subscription]), keys: KEYS, send, mail, appUrl: 'https://oh.feega.app' }, NOW);

    expect(tally).toMatchObject({ pushed: 1, emailed: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1]).toMatchObject({ title: '2 new comments on Landing', url: 'https://oh.feega.app/s/abcdefghij' });
    expect(mail).not.toHaveBeenCalled();
  });

  it('falls back to email when the host has no subscription', async () => {
    const claims = memoryStore();
    const mail: Mailer = (userId, refId, build) => sendOnce(userId, EmailKind.CommentsDigest, refId, build, claims);

    const tally = await runDigest({ store: store([comment()]), keys: KEYS, mail, appUrl: 'https://oh.feega.app' }, NOW);

    expect(tally).toMatchObject({ pushed: 0, emailed: 1 });
    expect(vi.mocked(sendEmail).mock.calls[0][0]).toMatchObject({ to: 'host@example.com' });
  });

  it('falls back to email when every push is refused', async () => {
    const send = vi.fn().mockResolvedValue(PushOutcome.Failed);
    const mail = vi.fn().mockResolvedValue(OnceOutcome.Sent);

    const tally = await runDigest({ store: store([comment()], [subscription]), keys: KEYS, send, mail, appUrl: 'https://oh.feega.app' }, NOW);

    expect(tally.emailed).toBe(1);
  });

  it('sends the same window by email once, however often the cron fires', async () => {
    const claims = memoryStore();
    const mail: Mailer = (userId, refId, build) => sendOnce(userId, EmailKind.CommentsDigest, refId, build, claims);
    const deps = { store: store([comment()]), keys: KEYS, mail, appUrl: 'https://oh.feega.app' };

    await runDigest(deps, NOW);
    const second = await runDigest(deps, NOW);

    expect(second).toMatchObject({ emailed: 0, skipped: 1 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('ignores the host commenting on their own session', async () => {
    const mail = vi.fn();

    const tally = await runDigest({ store: store([comment({ authorId: HOST })]), keys: KEYS, mail, appUrl: 'https://oh.feega.app' }, NOW);

    expect(tally).toEqual({ pushed: 0, emailed: 0, skipped: 0 });
    expect(mail).not.toHaveBeenCalled();
  });
});
