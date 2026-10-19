import { applyAction } from '$app/forms';
import { goto, invalidateAll } from '$app/navigation';
import type { ActionResult } from '@sveltejs/kit';
import { hasTwin, postPageAction } from '$lib/api/page-action';

type After = (opts: { result: ActionResult; update: () => Promise<void> }) => Promise<void> | void;
export type Submit = (opts: { cancel: () => void; formData: FormData }) => After | void;

export function actionTarget(attribute: string, currentPath: string): { pathname: string; action: string } | null {
  const url = new URL(attribute, `https://dashboard${currentPath}`);
  const action = [...url.searchParams.keys()].find((key) => key.startsWith('/'));
  return action ? { pathname: url.pathname, action: action.slice(1) } : null;
}

async function follow(form: HTMLFormElement, result: ActionResult): Promise<void> {
  if (result.type === 'success') {
    form.reset();
    await invalidateAll();
  }
  if (result.type !== 'redirect') {
    await applyAction(result);
    return;
  }

  const target = new URL(result.location, location.href);
  if (target.origin === location.origin) {
    await goto(target.pathname + target.search + target.hash);
    return;
  }
  location.href = target.href;
}

export function apiEnhance(form: HTMLFormElement, submit?: Submit) {
  async function submitted(event: SubmitEvent) {
    const target = actionTarget(form.getAttribute('action') ?? '', location.pathname);
    if (!target || !hasTwin(target.pathname)) {
      return;
    }
    event.preventDefault();

    const formData = new FormData(form, event.submitter);
    let cancelled = false;
    const after = submit?.({ cancel: () => (cancelled = true), formData });
    if (cancelled) {
      return;
    }

    const result = await postPageAction(target.pathname, target.action, formData);
    const update = () => follow(form, result);
    if (after) {
      await after({ result, update });
      return;
    }
    await update();
  }

  form.addEventListener('submit', submitted);
  return { destroy: () => form.removeEventListener('submit', submitted) };
}
