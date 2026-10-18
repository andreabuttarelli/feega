import { applyAction, enhance as kitEnhance } from '$app/forms';
import { goto, invalidateAll } from '$app/navigation';
import { page } from '$app/state';
import { refreshSheet } from '$lib/canvas/sheet-nav';
import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
import { postSettingsAction } from './api';
import { settingsTarget } from './sections';

type UpdateOptions = { reset?: boolean; invalidateAll?: boolean };

async function follow(result: ActionResult): Promise<void> {
  if (result.type !== 'redirect') {
    await applyAction(result);
    return;
  }

  const target = new URL(result.location, location.href);
  if (target.origin !== location.origin) {
    location.href = target.href;
    return;
  }
  await goto(target.pathname + target.search + target.hash, { invalidateAll: true });
}

function updater(form: HTMLFormElement, result: ActionResult) {
  return async ({ reset = true, invalidateAll: refresh = true }: UpdateOptions = {}) => {
    const sheet = page.state.sheet;
    const succeeded = result.type === 'success';
    if (succeeded && reset) {
      form.reset();
    }
    if (succeeded && refresh) {
      await invalidateAll();
    }
    await follow(result);
    if (succeeded && sheet) {
      await refreshSheet(sheet.path);
    }
  };
}

export function enhance(form: HTMLFormElement, submit?: SubmitFunction) {
  const kit = kitEnhance(form, submit);

  async function submitted(event: SubmitEvent) {
    const target = settingsTarget(form.getAttribute('action') ?? '', location.pathname);
    if (!target) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();

    const formData = new FormData(form, event.submitter);
    const action = new URL(form.action);
    let cancelled = false;
    const controller = new AbortController();
    const after = await submit?.({ action, formData, formElement: form, controller, submitter: event.submitter, cancel: () => (cancelled = true) });
    if (cancelled) {
      return;
    }

    const result = await postSettingsAction(target.projectId, target.section, target.action, formData);
    const update = updater(form, result);
    if (typeof after === 'function') {
      await after({ action, formData, formElement: form, result, update });
      return;
    }
    await update();
  }

  form.addEventListener('submit', submitted, { capture: true });
  return {
    destroy: () => {
      form.removeEventListener('submit', submitted, { capture: true });
      kit.destroy();
    }
  };
}
