import { env } from '$env/dynamic/private';
import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { sendEmail } from '../email';
import { senderEmailDomain } from '../support-config';
import type { EmailKind, RenderedEmail } from './templates';

export enum OnceOutcome {
  Sent = 'sent',
  Skipped = 'skipped'
}

export type OnceStore = {
  claim(userId: string, kind: EmailKind, refId: string): Promise<boolean>;
  release(userId: string, kind: EmailKind, refId: string): Promise<void>;
};

export type OutgoingEmail = RenderedEmail & { to: string };

const UNIQUE_VIOLATION = '23505';
const TABLE = 'user_emails';

const USER_EMAILS_USE = SERVICE_ROLE_USES.find((use) => use.path.startsWith('src/lib/server/cloud-emails/send-once.ts'));

type UserEmailsTable = {
  insert(row: { user_id: string; kind: string; ref_id: string }): PromiseLike<{ error: { code?: string; message: string } | null }>;
  delete(): {
    eq(column: string, value: string): { eq(column: string, value: string): { eq(column: string, value: string): PromiseLike<unknown> } };
  };
};

function userEmailsTable(): UserEmailsTable {
  if (!USER_EMAILS_USE) {
    throw new Error('user_emails service role use not declared');
  }

  const db = createServiceRoleDb(USER_EMAILS_USE) as unknown as { from(table: string): UserEmailsTable };

  return db.from(TABLE);
}

export const dbStore: OnceStore = {
  async claim(userId, kind, refId) {
    const { error } = await userEmailsTable().insert({ user_id: userId, kind, ref_id: refId });

    if (!error) {
      return true;
    }
    if (error.code === UNIQUE_VIOLATION) {
      return false;
    }

    throw new Error(`user_emails: ${error.message}`);
  },

  async release(userId, kind, refId) {
    await userEmailsTable().delete().eq('user_id', userId).eq('kind', kind).eq('ref_id', refId);
  }
};

function sender(): { from: string; replyTo: string } {
  const domain = env.EMAIL_DOMAIN || senderEmailDomain();

  return { from: `Feega <hi@${domain}>`, replyTo: `support@${domain}` };
}

export async function sendOnce(
  userId: string,
  kind: EmailKind,
  refId: string,
  build: () => Promise<OutgoingEmail>,
  store: OnceStore = dbStore
): Promise<OnceOutcome> {
  const claimed = await store.claim(userId, kind, refId);

  if (!claimed) {
    return OnceOutcome.Skipped;
  }

  try {
    await sendEmail({ ...(await build()), ...sender() });
  } catch (error) {
    await store.release(userId, kind, refId);
    throw error;
  }

  return OnceOutcome.Sent;
}
