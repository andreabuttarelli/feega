import { goto } from '$app/navigation';
import { bundleApiBase } from '$lib/api/bundle-fetch';
import { forgetFrameCaches } from '$lib/canvas/core/frame-cache';

const SIGN_OUT = '/auth/signout';

export function signOutForm(form: HTMLFormElement) {
  function submitted(event: SubmitEvent) {
    void forgetFrameCaches().catch(() => undefined);
    if (!bundleApiBase()) {
      return;
    }
    event.preventDefault();
    void goto(SIGN_OUT);
  }

  form.addEventListener('submit', submitted);
  return { destroy: () => form.removeEventListener('submit', submitted) };
}
