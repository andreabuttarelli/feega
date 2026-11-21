import { env } from '$env/dynamic/private';
import { sendPush, PushOutcome, type PushSubscription, type VapidKeys } from './push';
import type { SessionRow } from './sessions';

export type StoredSubscription = PushSubscription & { userId: string };

export type DigestCommentRow = {
  sessionId: string;
  projectName: string;
  hostId: string;
  authorId: string;
  authorName: string;
  body: string;
  selector: string;
  sourceFile: string;
  sourceLine: number;
};

export type Contact = { email: string; name: string };

export type NotifyStore = {
  memberIds(orgId: string): Promise<string[]>;
  subscriptionsOf(userIds: string[]): Promise<StoredSubscription[]>;
  dropSubscriptions(endpoints: string[]): Promise<void>;
  commentsBetween(from: Date, to: Date): Promise<DigestCommentRow[]>;
  contactOf(userId: string): Promise<Contact | null>;
};

export type PushMessage = { title: string; body: string; url: string };

export type PushDeps = { store: NotifyStore; keys: VapidKeys | null; send?: typeof sendPush };

const DEFAULT_SUBJECT = 'mailto:support@feega.app';

export function vapidFromEnv(): VapidKeys | null {
  const publicKey = env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return null;
  }

  return { publicKey, privateKey, subject: env.VAPID_SUBJECT || DEFAULT_SUBJECT };
}

export async function pushToUsers(deps: PushDeps, userIds: string[], message: PushMessage): Promise<Map<string, number>> {
  const delivered = new Map<string, number>();
  if (!deps.keys || !userIds.length) {
    return delivered;
  }

  const send = deps.send ?? sendPush;
  const gone: string[] = [];

  for (const subscription of await deps.store.subscriptionsOf(userIds)) {
    const outcome = await send(subscription, message, deps.keys).catch(() => PushOutcome.Failed);

    if (outcome === PushOutcome.Gone) {
      gone.push(subscription.endpoint);
    }
    if (outcome === PushOutcome.Delivered) {
      delivered.set(subscription.userId, (delivered.get(subscription.userId) ?? 0) + 1);
    }
  }

  await deps.store.dropSubscriptions(gone);

  return delivered;
}

export async function notifySessionShared(deps: PushDeps, session: SessionRow, hostName: string, appUrl: string): Promise<number> {
  const recipients = (await deps.store.memberIds(session.org_id)).filter((id) => id !== session.host_user_id);
  const delivered = await pushToUsers(deps, recipients, {
    title: `${hostName} shared ${session.project_name}`,
    body: 'Open the live session.',
    url: `${appUrl}/s/${session.id}`
  });

  return delivered.size;
}
