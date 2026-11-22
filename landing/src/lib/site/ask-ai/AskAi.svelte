<script lang="ts">
  import { onMount } from 'svelte';
  import { ASSISTANTS, askUrl } from './assistants';
  import { browserStorage, dismiss, inFrame, isDismissed } from './visibility';

  let shown = $state(false);
  let expanded = $state(false);

  onMount(() => {
    shown = !inFrame(window) && !isDismissed(browserStorage());
  });

  function close() {
    dismiss(browserStorage());
    shown = false;
  }
</script>

{#if shown}
  <aside class="ask" class:expanded aria-label="Ask your AI what Feega is">
    <span class="label">ask your ai what feega is</span>
    <button class="toggle" type="button" aria-expanded={expanded} aria-controls="ask-ai-links" onclick={() => (expanded = !expanded)}>
      ask ai
    </button>
    <ul id="ask-ai-links">
      {#each ASSISTANTS as assistant (assistant.name)}
        <li>
          <a href={askUrl(assistant)} target="_blank" rel="noopener noreferrer" aria-label={`Ask ${assistant.name} what Feega is`} title={assistant.name}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={assistant.logo} /></svg>
          </a>
        </li>
      {/each}
    </ul>
    <button class="close" type="button" aria-label="Dismiss" title="Dismiss" onclick={close}>
      <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" /></svg>
    </button>
  </aside>
{/if}

<style>
  .ask {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: calc(100vw - 32px);
    padding: 8px 8px 8px 14px;
    border: 1px solid var(--sx-line-strong);
    border-radius: 999px;
    background: var(--sx-grey-1);
    color: var(--sx-ink-2);
    font: var(--sx-w-body) 14px/1 var(--sx-font);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  }

  .label::before {
    content: '';
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-right: 10px;
    background: var(--sx-accent);
  }

  .toggle {
    display: none;
  }

  ul {
    display: flex;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  a,
  .close {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--sx-ink);
    cursor: pointer;
  }

  a:hover,
  .close:hover,
  .toggle:hover {
    background: var(--sx-hover);
  }

  a:focus-visible,
  .close:focus-visible,
  .toggle:focus-visible {
    outline: 2px solid var(--sx-accent);
    outline-offset: 2px;
  }

  a svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }

  .close {
    color: var(--sx-ink-3);
  }

  .close svg {
    width: 10px;
    height: 10px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
  }

  @media (prefers-reduced-motion: no-preference) {
    .ask {
      animation: rise 240ms ease-out;
    }

    a {
      transition: background-color 120ms;
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }

  @media (max-width: 640px) {
    .ask {
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 4px 8px;
      padding: 4px 4px 4px 12px;
    }

    .label {
      display: none;
    }

    .toggle {
      display: inline-flex;
      align-items: center;
      height: 32px;
      padding: 0 8px 0 0;
      border: 0;
      border-radius: 999px;
      background: none;
      color: var(--sx-ink);
      font: inherit;
      cursor: pointer;
    }

    .toggle::before {
      content: '';
      width: 6px;
      height: 6px;
      margin-right: 10px;
      background: var(--sx-accent);
    }

    ul {
      display: none;
    }

    .expanded ul {
      display: flex;
    }
  }
</style>
