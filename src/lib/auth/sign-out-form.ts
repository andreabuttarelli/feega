import { goto } from '$app/navigation';
import { bundleApiBase } from '$lib/api/bundle-fetch';

const SIGN_OUT = '/auth/signout';

export function signOutForm(form: HTMLFormElement) {
  function submitted(event: SubmitEvent) {
    if (!bundleApiBase()) {
      return;
    }
    event.preventDefault();
    void goto(SIGN_OUT);
  }

  form.addEventListener('submit', submitted);
  return { destroy: () => form.removeEventListener('submit', submitted) };
}
