import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../email', () => ({ sendEmail: vi.fn() }));

import { sendEmail } from '../email';
import { OnceOutcome, sendOnce, type OnceStore } from './send-once';
import { EmailKind } from './templates';

const MAIL = { to: 'ada@example.com', subject: 's', html: '<p>h</p>', text: 'h' };

function memoryStore(): OnceStore {
  const seen = new Set<string>();
  return {
    claim: async (userId, kind, refId) => {
      const key = `${userId}|${kind}|${refId}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    },
    release: async (userId, kind, refId) => {
      seen.delete(`${userId}|${kind}|${refId}`);
    }
  };
}

describe('sendOnce', () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockReset();
  });

  it('sends the first time and not the second', async () => {
    const store = memoryStore();
    const build = vi.fn(async () => MAIL);

    const first = await sendOnce('u1', EmailKind.Welcome, 'u1', build, store);
    const second = await sendOnce('u1', EmailKind.Welcome, 'u1', build, store);

    expect(first).toBe(OnceOutcome.Sent);
    expect(second).toBe(OnceOutcome.Skipped);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('sends with the Feega sender and the support reply-to', async () => {
    await sendOnce('u1', EmailKind.Welcome, 'u1', async () => MAIL, memoryStore());

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ ...MAIL, from: 'Feega <hi@feega.app>', replyTo: 'support@feega.app' })
    );
  });

  it('a different ref is a different email', async () => {
    const store = memoryStore();

    await sendOnce('u1', EmailKind.PaymentFailed, 'inv_1', async () => MAIL, store);
    await sendOnce('u1', EmailKind.PaymentFailed, 'inv_2', async () => MAIL, store);

    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it('a failed send releases the claim so a retry can send', async () => {
    const store = memoryStore();
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('Resend 500'));

    await expect(sendOnce('u1', EmailKind.Welcome, 'u1', async () => MAIL, store)).rejects.toThrow('Resend 500');
    const retry = await sendOnce('u1', EmailKind.Welcome, 'u1', async () => MAIL, store);

    expect(retry).toBe(OnceOutcome.Sent);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it('a failed build releases the claim', async () => {
    const store = memoryStore();
    const broken = async () => {
      throw new Error('no profile');
    };

    await expect(sendOnce('u1', EmailKind.Welcome, 'u1', broken, store)).rejects.toThrow('no profile');
    const retry = await sendOnce('u1', EmailKind.Welcome, 'u1', async () => MAIL, store);

    expect(retry).toBe(OnceOutcome.Sent);
  });
});
