import type { CommentThread } from './comment-threads';

export type Teammate = { id: string; name: string };

const TRAILING_MENTION = /(?:^|\s)@([^\s@]*)$/;
const NAME_CONTINUES = /[\p{L}\p{N}_]/u;

export function mentionQuery(draft: string): string | null {
  return TRAILING_MENTION.exec(draft)?.[1] ?? null;
}

export function insertMention(draft: string, name: string): string {
  return draft.replace(/@[^\s@]*$/, `@${name} `);
}

const MASK = '\u0000';

export function mentionedIds(body: string, team: Teammate[]): string[] {
  const longestFirst = [...team].sort((a, b) => b.name.length - a.name.length);
  const ids = new Set<string>();
  let left = body;

  for (const mate of longestFirst) {
    const token = `@${mate.name}`;
    let from = left.indexOf(token);
    while (from !== -1) {
      const end = from + token.length;
      if (!NAME_CONTINUES.test(left.charAt(end))) {
        ids.add(mate.id);
        left = left.slice(0, from) + MASK.repeat(token.length) + left.slice(end);
      }
      from = left.indexOf(token, from + 1);
    }
  }

  return [...ids];
}

export function hasUnseenMention(threads: CommentThread[], me: string, seenAt: string | null): boolean {
  const entries = threads.flatMap((t) => [t, ...t.replies]);

  return entries.some((e) => e.authorId !== me && e.mentions.includes(me) && (seenAt === null || e.createdAt > seenAt));
}

export function latestActivity(threads: CommentThread[]): string | null {
  const stamps = threads.flatMap((t) => [t.createdAt, ...t.replies.map((r) => r.createdAt)]);

  return stamps.reduce<string | null>((latest, at) => (latest === null || at > latest ? at : latest), null);
}
