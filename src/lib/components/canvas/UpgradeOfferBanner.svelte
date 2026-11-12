<script lang="ts">
  import { countdown, offerCheckoutPath } from '$lib/upgrade-offer';
  import { upgradeOffer } from './upgrade-offer.svelte';

  const TICK_MS = 1000;

  let now = $state(Date.now());

  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), TICK_MS);
    return () => clearInterval(timer);
  });

  const expiresAt = $derived(upgradeOffer.expiresAt);
  const live = $derived(expiresAt !== null && now < expiresAt && !upgradeOffer.dismissed);
</script>

{#if live && expiresAt !== null}
  <div class="offer" role="status" data-testid="upgrade-offer">
    <span>15% off if you upgrade in the next hour</span>
    <span class="clock">{countdown(expiresAt, now)}</span>
    <a href={offerCheckoutPath(upgradeOffer.projectId)} data-sveltekit-reload>Upgrade</a>
    <button type="button" aria-label="Dismiss" onclick={() => upgradeOffer.dismiss()}>×</button>
  </div>
{/if}

<style>
  .offer {
    position: fixed;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: calc(100vw - 32px);
    padding: 8px 8px 8px 14px;
    border-radius: var(--ui-radius-lg);
    background: var(--popover, #111);
    color: var(--popover-foreground, #fff);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
    font-size: 13px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  }
  .clock {
    font-variant-numeric: tabular-nums;
    opacity: 0.7;
  }
  a {
    padding: 4px 10px;
    border-radius: var(--ui-radius-sm);
    background: var(--primary, #fff);
    color: var(--primary-foreground, #000);
    text-decoration: none;
    font-weight: 500;
  }
  button {
    padding: 2px 8px;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: inherit;
    border: 0;
    cursor: pointer;
    opacity: 0.6;
  }
</style>
