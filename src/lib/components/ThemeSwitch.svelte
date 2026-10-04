<script lang="ts">
  import Monitor from '@lucide/svelte/icons/monitor';
  import Sun from '@lucide/svelte/icons/sun';
  import Moon from '@lucide/svelte/icons/moon';
  import type { Component } from 'svelte';
  import { THEME_LABEL, THEME_PREFS, ThemePref, applyTheme, parseThemePref } from '$lib/theme';

  const ICON: Record<ThemePref, Component> = { [ThemePref.System]: Monitor, [ThemePref.Light]: Sun, [ThemePref.Dark]: Moon };
  const LEGACY_KEY = 'theme';

  let pref = $state(ThemePref.System);

  $effect(() => {
    pref = parseThemePref(document.documentElement.getAttribute('data-theme-pref'));
  });

  function pick(next: ThemePref) {
    pref = next;
    applyTheme(next);
    try {
      if (next === ThemePref.System) {
        localStorage.removeItem(LEGACY_KEY);
      } else {
        localStorage.setItem(LEGACY_KEY, next);
      }
    } catch {
      void 0;
    }
    void fetch('/api/theme', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ theme: next }) });
  }
</script>

<div class="switch" role="radiogroup" aria-label="Theme" data-testid="theme-switch">
  {#each THEME_PREFS as p (p)}
    {@const Icon = ICON[p]}
    <button type="button" role="radio" aria-checked={pref === p} aria-label={THEME_LABEL[p]} title={THEME_LABEL[p]} data-theme-option={p} class:on={pref === p} onclick={(e) => (e.stopPropagation(), pick(p))}>
      <Icon size={14} />
    </button>
  {/each}
</div>

<style>
  .switch {
    display: inline-flex;
    border: 1px solid var(--ui-line-strong);
  }

  button {
    display: grid;
    place-items: center;
    width: 28px;
    height: 24px;
    color: var(--ui-ink-2);
    background: var(--ui-bg);
  }

  button + button {
    border-left: 1px solid var(--ui-line);
  }

  button:hover {
    background: var(--ui-hover);
  }

  button.on {
    background: var(--ui-accent-wash);
    color: var(--ui-accent);
  }
</style>
