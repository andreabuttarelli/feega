<script lang="ts">
  import { follow, installOptions, type InstallOption } from './install';
  import { EDITOR_ICONS } from './editor-icons';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const options = installOptions();
  let dialog: HTMLDialogElement;
  let copied = $state(false);

  $effect(() => {
    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  });

  function choose(option: InstallOption) {
    if (option.soon) {
      return;
    }
    if (option.command) {
      navigator.clipboard?.writeText(option.command);
      copied = true;
      return;
    }
    follow({ label: option.label, href: option.href, deepLink: option.deepLink }, {
      userAgent: navigator.userAgent,
      open: (url) => {
        window.location.href = url;
      },
      hidden: () => document.hidden,
      later: (fn, ms) => {
        setTimeout(fn, ms);
      }
    });
  }
</script>

<dialog bind:this={dialog} onclose={() => (open = false)} onclick={(e) => e.target === dialog && (open = false)}>
  <div class="box">
    <header>
      <strong>Download Feega for free</strong>
      <button class="close" aria-label="Close" onclick={() => (open = false)}>×</button>
    </header>
    <ul>
      {#each options as option (option.label)}
        <li>
          <button class="option" disabled={option.soon} onclick={() => choose(option)}>
            <span class="icon">{@html EDITOR_ICONS[option.label]}</span>
            <span class="name">{option.command ? 'Install with npx' : `Extension for ${option.label}`}</span>
            {#if option.command}<code>{option.command}</code>{/if}
            {#if option.soon}<span class="soon">soon</span>{:else if option.command}<span class="hint">{copied ? 'copied' : 'copy'}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  </div>
</dialog>

<style>
  dialog {
    padding: 0;
    border: 0;
    border-radius: 10px;
    background: #141414;
    color: #fff;
    width: min(420px, calc(100vw - 32px));
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 0.6);
  }

  .box {
    padding: 20px;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    font-size: 19px;
    letter-spacing: -0.01em;
  }

  .close {
    background: none;
    border: 0;
    color: rgb(255 255 255 / 0.6);
    font-size: 22px;
    cursor: pointer;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px 14px;
    border: 1px solid rgb(255 255 255 / 0.12);
    border-radius: 6px;
    background: rgb(255 255 255 / 0.04);
    color: #fff;
    font-size: 16px;
    line-height: 1.3;
    text-align: left;
    cursor: pointer;
  }

  .option:hover:not(:disabled) {
    border-color: rgb(255 255 255 / 0.4);
  }

  .option:disabled {
    cursor: default;
    opacity: 0.75;
  }

  .icon {
    display: flex;
    flex: none;
    color: #fff;
  }

  .name {
    flex: 1;
    font-weight: 500;
  }

  code {
    font-family: 'DM Mono', monospace;
    font-size: 13px;
    color: rgb(255 255 255 / 0.85);
  }

  .soon,
  .hint {
    font-size: 13px;
    color: rgb(255 255 255 / 0.7);
  }
</style>
