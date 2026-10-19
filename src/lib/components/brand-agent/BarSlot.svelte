<script lang="ts">
  import { untrack } from 'svelte';
  import type { ChatPrefill } from './chat-prefill';
  import type { StreamData } from './chat-session.svelte';
  import { BarSeat, rightBar, type BarBinding, type BarProperties } from './right-bar-host.svelte';

  let {
    context,
    onturnend,
    ondata,
    onbusy,
    prefill = null,
    reload = 0,
    properties,
    seat = BarSeat.Own
  }: {
    context?: () => Record<string, unknown>;
    onturnend?: () => void;
    ondata?: (part: StreamData) => void;
    onbusy?: (busy: boolean) => void;
    prefill?: ChatPrefill | null;
    reload?: number;
    properties?: BarProperties;
    seat?: BarSeat;
  } = $props();

  let slot = $state<HTMLDivElement | null>(null);

  const binding: BarBinding = {
    get context() {
      return context;
    },
    get onturnend() {
      return onturnend;
    },
    get ondata() {
      return ondata;
    },
    get onbusy() {
      return onbusy;
    },
    get properties() {
      return properties;
    }
  };

  $effect(() => {
    const element = seat === BarSeat.Own ? slot : null;
    if (seat === BarSeat.Own && !element) {
      return;
    }
    const claim = untrack(() => rightBar.claim(element, binding));
    return () => rightBar.release(claim);
  });

  $effect(() => {
    if (prefill) {
      rightBar.ask(prefill);
    }
  });

  let lastReload = untrack(() => reload);

  $effect(() => {
    if (reload === lastReload) {
      return;
    }
    lastReload = reload;
    untrack(() => rightBar.refresh());
  });
</script>

{#if seat === BarSeat.Own}<div class="bar-slot" bind:this={slot} data-testid="bar-slot"></div>{/if}

<style>
  .bar-slot {
    flex: 1;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
</style>
