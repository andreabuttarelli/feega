export enum KeyOwner {
  Canvas = 'canvas',
  Editor = 'editor'
}

let owner = $state(KeyOwner.Canvas);

export const keyOwner = {
  get current() {
    return owner;
  },
  claim(next: KeyOwner) {
    owner = next;
    return () => {
      owner = KeyOwner.Canvas;
    };
  }
};
