let open = $state(false);

export const tourDialog = {
  get open() {
    return open;
  },
  set open(value: boolean) {
    open = value;
  }
};
