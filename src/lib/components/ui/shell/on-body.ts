import type { Attachment } from 'svelte/attachments';

export const onBody: Attachment<HTMLElement> = (el) => {
  document.body.append(el);
  return () => el.remove();
};
