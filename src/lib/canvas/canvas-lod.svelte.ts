let far = $state(false);

export const canvasLod = {
  get far() {
    return far;
  },
  set(next: boolean) {
    far = next;
  }
};
