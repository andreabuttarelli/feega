export function fieldKeys(input: HTMLInputElement | HTMLTextAreaElement): () => void {
  let entered = input.value;

  const onFocus = () => {
    entered = input.value;
  };

  const onKey = (event: Event) => {
    const e = event as KeyboardEvent;
    if (e.key === 'Enter' && input instanceof HTMLInputElement) {
      input.blur();
      return;
    }
    if (e.key !== 'Escape') {
      return;
    }
    e.stopPropagation();
    input.value = entered;
    input.blur();
  };

  input.addEventListener('focus', onFocus);
  input.addEventListener('keydown', onKey);

  return () => {
    input.removeEventListener('focus', onFocus);
    input.removeEventListener('keydown', onKey);
  };
}
