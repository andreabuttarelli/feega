<script lang="ts">
  import { browserEnv, installOptions, Outcome, runOption, type InstallOption } from './install';
  import { EDITOR_ICONS } from './editor-icons';
  import CommandField from './CommandField.svelte';
  import { eventAttrs } from './analytics/attrs';
  import { installOptionAttrs } from './analytics/nav';
  import { APPLE_ICON } from './social-icons';
  import { DESKTOP_DMGS, DESKTOP_INSTALL_COMMAND, DESKTOP_PUBLISHED, DOWNLOAD_PATH } from './links';

  let { label, place }: { label: string; place: string } = $props();

  const options = installOptions().filter((o) => !o.soon);
  let open = $state(false);
  let copied = $state(false);
  let root: HTMLDivElement;

  function choose(option: InstallOption) {
    const outcome = runOption(option, browserEnv(), (text) => navigator.clipboard?.writeText(text));
    copied = outcome === Outcome.Copied;
    open = copied;
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      open = false;
    }
  }

  function onPointer(event: PointerEvent) {
    if (open && !root.contains(event.target as Node)) {
      open = false;
    }
  }
</script>

<svelte:window onkeydown={onKey} onpointerdown={onPointer} />

<div class="split" bind:this={root}>
  <a class="main" href={DOWNLOAD_PATH} {...eventAttrs('download_click', { target: 'download_page', place })}>{label}</a>
  <button class="chev" type="button" aria-label="More ways to install" aria-haspopup="menu" aria-expanded={open} onclick={() => (open = !open)}>
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
  </button>

  {#if open}
    <div class="menu" role="menu">
      {#each options as option (option.label)}
        <button role="menuitem" type="button" onclick={() => choose(option)} {...installOptionAttrs(option, place)}>
          <span class="logo">{@html EDITOR_ICONS[option.label] ?? ''}</span>
          <span>{(option.command ?? option.label).toLowerCase()}</span>
          {#if option.command && copied}<span class="done">copied</span>{/if}
        </button>
      {/each}
      {#if DESKTOP_PUBLISHED}
        <p class="section"><img src="/img/feega-desktop.png" alt="" width="20" height="20" />desktop app (beta)</p>
        <div class="field"><CommandField command={DESKTOP_INSTALL_COMMAND} /></div>
        {#each DESKTOP_DMGS as dmg (dmg.arch)}
          <a role="menuitem" href={dmg.href} {...eventAttrs('download_click', { target: `dmg ${dmg.arch.toLowerCase()}`, place })}><span class="logo">{@html APPLE_ICON}</span><span>dmg · {dmg.arch.toLowerCase()}</span></a>
        {/each}
        <p class="hint">macOS blocks the dmg. allow it in privacy & security, open anyway.</p>
      {/if}
      <a role="menuitem" class="all" href={DOWNLOAD_PATH} {...eventAttrs('download_click', { target: 'download_page', place })}>All download options →</a>
    </div>
  {/if}
</div>

<style>
  .split {
    position: relative;
    display: flex;
    background: #fff;
    color: #000;
    border-radius: 999px;
  }

  .main {
    display: flex;
    align-items: center;
    min-height: 48px;
    line-height: 1;
    text-box: trim-both cap alphabetic;
    padding: 0 18px 0 26px;
    color: inherit;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.02em;
    text-decoration: none;
  }

  .chev {
    display: grid;
    place-items: center;
    width: 44px;
    border: 0;
    border-left: 1px solid rgb(0 0 0 / 0.15);
    border-radius: 0 999px 999px 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .main:hover,
  .chev:hover {
    opacity: 0.7;
  }

  .menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    display: flex;
    flex-direction: column;
    min-width: 240px;
    max-width: calc(100vw - 32px);
    padding: 6px;
    border: 1px solid rgb(255 255 255 / 0.15);
    border-radius: var(--ui-radius-lg, 10px);
    background: #111;
    color: #fff;
    text-align: left;
  }

  .menu button,
  .menu a {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 10px;
    border: 0;
    border-radius: var(--ui-radius-sm, 4px);
    background: transparent;
    color: #fff;
    font: inherit;
    font-size: 15px;
    text-decoration: none;
    cursor: pointer;
  }

  .menu button:hover,
  .menu a:hover,
  .menu button:focus-visible,
  .menu a:focus-visible {
    background: rgb(255 255 255 / 0.1);
    outline: none;
  }

  .logo {
    display: grid;
    place-items: center;
    width: 20px;
  }

  .done {
    margin-left: auto;
    color: #ff5100;
    font-size: 13px;
  }

  .section {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 10px 4px;
    padding-top: 8px;
    border-top: 1px solid rgb(255 255 255 / 0.1);
    color: rgb(255 255 255 / 0.5);
    font-size: 13px;
  }

  .hint {
    margin: 4px 10px 6px;
    color: rgb(255 255 255 / 0.5);
    font-size: 12px;
    line-height: 1.35;
  }

  .field {
    margin: 2px 4px 6px;
  }

  .section img {
    border-radius: 4px;
  }

  .all {
    margin-top: 4px;
    border-top: 1px solid rgb(255 255 255 / 0.1);
    border-radius: 0;
    color: rgb(255 255 255 / 0.7);
  }
</style>
