import type { Addable } from './addable';

let asked = $state(0);
let what = $state<Addable | null>(null);

export const insertRequest = {
  get asked(): number {
    return asked;
  },
  get what(): Addable | null {
    return what;
  },
  ask(next: Addable) {
    what = next;
    asked += 1;
  }
};
