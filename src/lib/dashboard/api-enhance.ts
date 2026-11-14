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

enum Landing {
  Stayed = 'stayed',
  Left = 'left'
}

async function follow(form: HTMLFormElement, result: ActionResult): Promise<Landing> {
  if (result.type === 'success') {
    form.reset();
    await invalidateAll();
  }
  if (result.type !== 'redirect') {
    await applyAction(result);
    return Landing.Stayed;
  }

  const target = new URL(result.location, location.href);
  if (target.origin === location.origin) {
    await goto(target.pathname + target.search + target.hash);
    return Landing.Stayed;
  }
  location.href = target.href;
  return Landing.Left;
}

export function apiEnhance(form: HTMLFormElement, submit?: Submit) {
  let posting = false;

  async function submitted(event: SubmitEvent) {
    const target = actionTarget(form.getAttribute('action') ?? '', location.pathname);
    if (!target || !hasTwin(target.pathname)) {
      return;
    }
    event.preventDefault();
    if (posting) {
      return;
    }
    posting = true;
    let landing = Landing.Stayed;
    try {
      landing = await post(event, target);
    } finally {
      posting = landing === Landing.Left;
    }
  }

  async function post(event: SubmitEvent, target: { pathname: string; action: string }): Promise<Landing> {
    const formData = new FormData(form, event.submitter);
    let cancelled = false;
    const after = submit?.({ cancel: () => (cancelled = true), formData });
    if (cancelled) {
      return Landing.Stayed;
    }

    const result = await postPageAction(target.pathname, target.action, formData);
    let landing = Landing.Stayed;
    const update = async () => {
      landing = await follow(form, result);
    };
    if (after) {
      await after({ result, update });
      return landing;
    }
    await update();
    return landing;
  }

  form.addEventListener('submit', submitted);
  return { destroy: () => form.removeEventListener('submit', submitted) };
}
