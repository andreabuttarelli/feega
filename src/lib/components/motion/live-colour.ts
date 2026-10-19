import { colourDrag, type LiveGesture } from '$lib/motion/live-edit';

export type LiveColour = { gesture: LiveGesture | null; apply: (value: string) => void };

export function liveColour(input: HTMLInputElement, params: LiveColour) {
  let current = params;
  const drag = colourDrag(current.gesture, (value) => current.apply(value));
  const onInput = () => drag.input(input.value);
  const onChange = () => drag.change(input.value);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      drag.cancel();
    }
  };

  input.addEventListener('input', onInput);
  input.addEventListener('change', onChange);
  input.addEventListener('keydown', onKey);

  return {
    update(next: LiveColour) {
      current = next;
    },
    destroy() {
      drag.settle();
      input.removeEventListener('input', onInput);
      input.removeEventListener('change', onChange);
      input.removeEventListener('keydown', onKey);
    }
  };
}
