export type Follow = 'following' | 'reading';

export type FollowEvent =
  | { kind: 'scrolled'; atBottom: boolean }
  | { kind: 'grew' }
  | { kind: 'sent' }
  | { kind: 'jumped' };

const TRANSITIONS: { [K in FollowEvent['kind']]: (now: Follow, event: Extract<FollowEvent, { kind: K }>) => Follow } = {
  scrolled: (_, event) => (event.atBottom ? 'following' : 'reading'),
  grew: (now) => now,
  sent: () => 'following',
  jumped: () => 'following'
};

export function nextFollow(now: Follow, event: FollowEvent): Follow {
  const transition = TRANSITIONS[event.kind] as (now: Follow, event: FollowEvent) => Follow;
  return transition(now, event);
}
