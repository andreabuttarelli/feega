import type { CommentPlacement } from '$lib/canvas/comment-placement';

let open = $state(false);
let active = $state<string | null>(null);
let placing = $state(false);
let pending = $state<CommentPlacement | null>(null);

export const commentsPanel = {
  get open(): boolean {
    return open;
  },
  get active(): string | null {
    return active;
  },
  get placing(): boolean {
    return placing;
  },
  get pending(): CommentPlacement | null {
    return pending;
  },
  show() {
    open = true;
  },
  hide() {
    open = false;
    active = null;
    placing = false;
    pending = null;
  },
  focus(threadId: string | null) {
    active = threadId;
    open = open || threadId !== null;
  },
  place(on: boolean) {
    placing = on;
    pending = on ? pending : null;
    open = open || on;
  },
  drop(at: CommentPlacement) {
    pending = at;
    active = null;
    open = true;
  },
  settle() {
    pending = null;
    placing = false;
  }
};
