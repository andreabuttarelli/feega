import { sendOnce, OnceOutcome } from '../cloud-emails/send-once';
import { EmailKind, renderEmail } from '../cloud-emails/templates';
import { pushToUsers, type DigestCommentRow, type PushDeps } from './notify';

export const DIGEST_WINDOW_MS = 15 * 60 * 1000;

export enum DigestDelivery {
  Pushed = 'pushed',
  Emailed = 'emailed',
  Skipped = 'skipped'
}

export type Mailer = (userId: string, refId: string, build: () => Promise<{ to: string; subject: string; html: string; text: string }>) => Promise<OnceOutcome>;

export type DigestDeps = PushDeps & { appUrl: string; mail?: Mailer };

const defaultMail: Mailer = (userId, refId, build) => sendOnce(userId, EmailKind.CommentsDigest, refId, build);

export function windowEndingAt(now: Date): { from: Date; to: Date } {
  const end = Math.floor(now.getTime() / DIGEST_WINDOW_MS) * DIGEST_WINDOW_MS;

  return { from: new Date(end - DIGEST_WINDOW_MS), to: new Date(end) };
}

function groupBySession(rows: DigestCommentRow[]): DigestCommentRow[][] {
  const groups = new Map<string, DigestCommentRow[]>();
  for (const row of rows.filter((candidate) => candidate.authorId !== candidate.hostId)) {
    groups.set(row.sessionId, [...(groups.get(row.sessionId) ?? []), row]);
  }

  return [...groups.values()];
}

function pushSummary(comments: DigestCommentRow[]): { title: string; body: string } {
  const [first] = comments;
  const count = comments.length;

  return {
    title: `${count} new comment${count === 1 ? '' : 's'} on ${first.projectName}`,
    body: `${first.authorName}: ${first.body}`.slice(0, 140)
  };
}

async function deliver(deps: DigestDeps, comments: DigestCommentRow[], refId: string): Promise<DigestDelivery> {
  const [first] = comments;
  const url = `${deps.appUrl}/s/${first.sessionId}`;

  const pushed = await pushToUsers(deps, [first.hostId], { ...pushSummary(comments), url });
  if (pushed.size) {
    return DigestDelivery.Pushed;
  }

  const contact = await deps.store.contactOf(first.hostId);
  if (!contact) {
    return DigestDelivery.Skipped;
  }

  const mail = deps.mail ?? defaultMail;
  const outcome = await mail(first.hostId, refId, async () => ({
    to: contact.email,
    ...renderEmail(EmailKind.CommentsDigest, {
      url,
      comments: comments.map((row) => ({ author: row.authorName, text: row.body, element: row.selector, file: row.sourceFile, line: row.sourceLine }))
    })
  }));

  return outcome === OnceOutcome.Sent ? DigestDelivery.Emailed : DigestDelivery.Skipped;
}

export async function runDigest(deps: DigestDeps, now: Date): Promise<Record<DigestDelivery, number>> {
  const { from, to } = windowEndingAt(now);
  const tally: Record<DigestDelivery, number> = { [DigestDelivery.Pushed]: 0, [DigestDelivery.Emailed]: 0, [DigestDelivery.Skipped]: 0 };

  for (const comments of groupBySession(await deps.store.commentsBetween(from, to))) {
    const refId = `${comments[0].sessionId}:${to.toISOString()}`;
    tally[await deliver(deps, comments, refId)]++;
  }

  return tally;
}
