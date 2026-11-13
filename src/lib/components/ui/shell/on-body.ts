import type { Attachment } from 'svelte/attachments';

export const FOCUS_TRAP = 'data-focus-trap';

const insideTrap = (el: HTMLElement) => !!el.parentElement?.closest(`[${FOCUS_TRAP}]`);

export const onBody: Attachment<HTMLElement> = (el) => {
  if (insideTrap(el)) {
    return;
  }
  document.body.append(el);
  return () => el.remove();
};
