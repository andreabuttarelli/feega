<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import { onMount } from 'svelte';
  import { AccountState, OnboardingOutcome, type OnboardingStep, ToHost } from '../messages';
  import { SLIDES } from './onboarding-slides';

  let { account, onaccount, onstep, ondone }: { account: { state: AccountState; email?: string }; onaccount: (kind: ToHost.SignIn | ToHost.CancelSignIn) => void; onstep: (step: OnboardingStep) => void; ondone: (outcome: OnboardingOutcome) => void } = $props();

  let index = $state(0);
  let dialog = $state<HTMLDivElement | null>(null);

  const slide = $derived(SLIDES[index]);
  const last = $derived(index === SLIDES.length - 1);

  function focusables() {
    return [...(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])];
  }

  function trap(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      ondone(OnboardingOutcome.Skipped);
      return;
    }
    if (e.key !== 'Tab') {
      return;
    }
    const items = focusables();
    const first = items[0];
    const end = items[items.length - 1];
    if (!dialog?.contains(document.activeElement)) {
      e.preventDefault();
      first?.focus();
      return;
    }
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      end?.focus();
    }
    if (!e.shiftKey && document.activeElement === end) {
      e.preventDefault();
      first?.focus();
    }
  }

  $effect(() => onstep(slide.step));

  onMount(() => dialog?.querySelector<HTMLElement>('[data-primary]')?.focus());
</script>

<svelte:window onkeydown={trap} />

<div class="scrim" role="presentation" data-testid="onboarding">
  <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="onb-title" aria-describedby="onb-body" tabindex="-1" bind:this={dialog}>
    <button type="button" class="close" aria-label="Close" title="Close" data-testid="onboarding-close" onclick={() => ondone(OnboardingOutcome.Skipped)}><X size={14} /></button>

    <div class="body">
      <h2 id="onb-title">{slide.title}</h2>
      <p id="onb-body">{slide.body}</p>
      {#if slide.more}<p class="more">{slide.more}</p>{/if}

      {#if last}
        <div class="account">
          {#if account.state === AccountState.SignedIn}
            <p class="signed" data-testid="onboarding-email">Signed in as {account.email}</p>
            <button type="button" class="primary" data-primary data-testid="onboarding-finish" onclick={() => ondone(OnboardingOutcome.Finished)}>Start designing</button>
          {:else if account.state === AccountState.Waiting}
            <button type="button" class="primary" data-primary disabled>Waiting for the browser…</button>
            <button type="button" class="ghost" data-testid="onboarding-cancel" onclick={() => onaccount(ToHost.CancelSignIn)}>cancel</button>
          {:else}
            <button type="button" class="primary" data-primary data-testid="onboarding-sign-in" onclick={() => onaccount(ToHost.SignIn)}>Sign in to Feega</button>
            <button type="button" class="ghost" data-testid="onboarding-later" onclick={() => ondone(OnboardingOutcome.Finished)}>maybe later</button>
            {#if account.state === AccountState.Cancelled}<p class="hint">Sign-in cancelled or timed out.</p>{/if}
          {/if}
        </div>
      {/if}
    </div>

    <footer>
      <button type="button" class="ghost" data-testid="onboarding-skip" onclick={() => ondone(OnboardingOutcome.Skipped)}>skip</button>
      <div class="dots" aria-hidden="true">
        {#each SLIDES as _, at (at)}<span class="dot" class:on={at === index}></span>{/each}
      </div>
      <div class="steps">
        <button type="button" class="ghost" data-testid="onboarding-back" disabled={index === 0} onclick={() => (index -= 1)}>back</button>
        <button type="button" class="ghost next" data-testid="onboarding-next" disabled={last} onclick={() => (index += 1)} data-primary>next</button>
      </div>
    </footer>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--ui-space-2);
    background: rgb(0 0 0 / 0.5);
  }

  .dialog {
    position: relative;
    display: flex;
    flex-direction: column;
    width: min(360px, 100%);
    max-height: 100%;
    overflow-y: auto;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel);
    box-shadow: 0 0 0 1px var(--ui-divider), 0 16px 48px rgb(0 0 0 / 0.4);
    outline: none;
  }

  .close {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    cursor: pointer;
  }

  .close:hover {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 32px 24px 16px;
    text-align: center;
  }

  h2 {
    margin: 0;
    color: var(--ui-text);
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.04em;
  }

  p {
    margin: 0;
    color: var(--ui-text-2);
    font-size: var(--ui-text-sm);
    line-height: 1.5;
    text-wrap: balance;
  }

  .more {
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .account {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin-top: 12px;
  }

  .signed {
    color: var(--ui-text);
  }

  .hint {
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .primary {
    width: 100%;
    height: 30px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-text);
    color: var(--ui-panel);
    font: inherit;
    font-weight: 500;
    cursor: pointer;
  }

  .primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .primary:disabled {
    opacity: 0.7;
    cursor: default;
  }

  .ghost {
    height: 26px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .ghost:hover:not(:disabled),
  .ghost:focus-visible {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .ghost:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .next:not(:disabled) {
    color: var(--ui-text);
    font-weight: 500;
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px 12px;
  }

  .dots {
    display: flex;
    gap: 6px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-divider);
  }

  .dot.on {
    background: var(--ui-text);
  }

  .steps {
    display: flex;
    gap: 2px;
  }
</style>
