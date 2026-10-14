import { mount } from 'svelte';
import BareFlowHarness from './BareFlowHarness.svelte';

declare global {
  interface Window {
    bareFlow: { mount: (count: number) => void };
  }
}

window.bareFlow = {
  mount: (count) => {
    document.body.replaceChildren();
    mount(BareFlowHarness, { target: document.body, props: { count } });
  }
};
