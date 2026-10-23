let open = $state(false);
let active = $state<string | null>(null);

export const commentsPanel = {
  get open(): boolean {
    return open;
  },
  get active(): string | null {
    return active;
  },
  show() {
    open = true;
  },
  hide() {
    open = false;
    active = null;
  },
  focus(threadId: string | null) {
    active = threadId;
    open = open || threadId !== null;
  }
};
