import { mount } from 'svelte';
import ZoomLockHarness from './ZoomLockHarness.svelte';

declare global {
  interface Window {
    zoomLock: { mount: () => void };
    zoomKeyBlocked?: boolean;
  }
}

window.zoomLock = {
  mount: () => {
    document.body.replaceChildren();
    mount(ZoomLockHarness, { target: document.body });
  }
};
