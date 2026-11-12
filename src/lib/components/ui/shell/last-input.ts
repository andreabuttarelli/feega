export enum Input {
  Pointer = 'pointer',
  Keys = 'keys'
}

let last = Input.Keys;

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => (last = Input.Pointer), true);
  window.addEventListener('keydown', () => (last = Input.Keys), true);
}

export const lastInput = () => last;
