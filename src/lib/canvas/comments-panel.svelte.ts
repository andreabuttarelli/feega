import type { CommentPlacement } from '$lib/canvas/comment-placement';

let open = $state(false);
let active = $state<string | null>(null);
let placing = $state(false);
let openedByPlacing = false;
let pending = $state<CommentPlacement | null>(null);
let unseen = $state(false);

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
  get unseen(): boolean {
    return unseen;
  },
  setUnseen(on: boolean) {
    unseen = on;
  },
  show() {
    open = true;
  },
  hide() {
    open = false;
    openedByPlacing = false;
    active = null;
    placing = false;
    pending = null;
  },
  focus(threadId: string | null) {
    active = threadId;
    open = open || threadId !== null;
  },
  place(on: boolean) {
    openedByPlacing = on ? openedByPlacing || !open : openedByPlacing;
    placing = on;
    pending = on ? pending : null;
    open = on ? true : open && !openedByPlacing;
    openedByPlacing = on && openedByPlacing;
  },
  drop(at: CommentPlacement) {
    openedByPlacing = false;
    pending = at;
    active = null;
    open = true;
  },
  settle() {
    pending = null;
    placing = false;
  }
};
