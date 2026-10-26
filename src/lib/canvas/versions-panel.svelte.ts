let open = $state(false);

export const versionsPanel = {
  get open(): boolean {
    return open;
  },
  show() {
    open = true;
  },
  hide() {
    open = false;
  }
};
