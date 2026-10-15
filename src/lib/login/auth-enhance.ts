import { applyAction, enhance } from '$app/forms';
import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
import { RUNTIME, Runtime } from '$lib/runtime';
import { actionTarget } from '$lib/dashboard/api-enhance';
import { land, OAuthProvider, sendReset, signIn, signUp, startOAuth, type AuthRefusal } from './client-auth';

const OK = 200;
const BAD_REQUEST = 400;

type Fields = { email: string; password: string; locale: string };
type AuthAction = (fields: Fields) => Promise<ActionResult | null>;

function refusedOrLanded(email: string) {
  return async (refusal: AuthRefusal | null): Promise<ActionResult | null> => {
    if (refusal) {
      return { type: 'failure', status: BAD_REQUEST, data: { ...refusal, email } };
    }
    await land();
    return null;
  };
}

const AUTH_ACTIONS: Record<string, AuthAction> = {
  login: ({ email, password }) => signIn(email, password).then(refusedOrLanded(email)),
  signup: ({ email, password }) => signUp(email, password).then(refusedOrLanded(email)),
  reset: async ({ email, locale }) => {
    const refusal = await sendReset(email, locale);
    return refusal ? { type: 'failure', status: BAD_REQUEST, data: { ...refusal, email } } : { type: 'success', status: OK, data: { reset: true, email } };
  },
  google: () => startOAuth(OAuthProvider.Google).then((refusal) => (refusal ? { type: 'failure', status: BAD_REQUEST, data: refusal } : null)),
  github: () => startOAuth(OAuthProvider.GitHub).then((refusal) => (refusal ? { type: 'failure', status: BAD_REQUEST, data: refusal } : null))
};

function fieldsOf(form: FormData): Fields {
  return {
    email: String(form.get('email') ?? '').trim().toLowerCase(),
    password: String(form.get('password') ?? ''),
    locale: String(form.get('locale') ?? '')
  };
}

function bundledAuth(form: HTMLFormElement, submit?: SubmitFunction) {
  async function submitted(event: SubmitEvent) {
    const target = actionTarget(form.getAttribute('action') ?? '', location.pathname);
    const run = target ? AUTH_ACTIONS[target.action] : undefined;
    if (!run) {
      return;
    }
    event.preventDefault();

    const formData = new FormData(form, event.submitter);
    const after = await submit?.({ action: new URL(location.href), formData, formElement: form, controller: new AbortController(), submitter: event.submitter, cancel: () => {} });
    const result = await run(fieldsOf(formData)).catch((error: unknown): ActionResult => ({ type: 'failure', status: BAD_REQUEST, data: { error: error instanceof Error ? error.message : String(error) } }));
    if (!result) {
      return;
    }
    const update = () => applyAction(result);
    if (typeof after === 'function') {
      await after({ action: new URL(location.href), formData, formElement: form, result, update });
      return;
    }
    await update();
  }

  form.addEventListener('submit', submitted);
  return { destroy: () => form.removeEventListener('submit', submitted) };
}

export function authEnhance(form: HTMLFormElement, submit?: SubmitFunction) {
  if (RUNTIME === Runtime.Bundle) {
    return bundledAuth(form, submit);
  }
  if (!submit) {
    return { destroy: () => {} };
  }
  return enhance(form, submit);
}
