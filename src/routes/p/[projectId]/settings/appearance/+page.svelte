<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { Moon, Sun } from '@lucide/svelte';
  import { Panel } from '$lib/components/ui/panel';
  import { Field } from '$lib/components/ui/field';

  let theme = $state<'light' | 'dark'>('light');

  $effect(() => {
    if (typeof window === 'undefined') return;
    const read = () =>
      (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') ?? 'light';
    theme = read();
    const obs = new MutationObserver(() => (theme = read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  });

  function setTheme(next: 'light' | 'dark') {
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    theme = next;
  }
</script>

<Panel title={$_('app.settings.appearance.title')}>
  <Field label={$_('app.settings.appearance.theme')} hint={$_('app.settings.appearance.themeDesc')}>
    <div class="theme-options" role="radiogroup" aria-label={$_('app.settings.appearance.theme')}>
      <button
        type="button"
        class="theme-card"
        class:active={theme === 'light'}
        aria-pressed={theme === 'light'}
        onclick={() => setTheme('light')}
      >
        <span class="theme-icon"><Sun class="size-4" strokeWidth={1.8} /></span>
        <span class="theme-label">{$_('app.account.lightMode')}</span>
        <span class="theme-swatch light" aria-hidden="true"></span>
      </button>
      <button
        type="button"
        class="theme-card"
        class:active={theme === 'dark'}
        aria-pressed={theme === 'dark'}
        onclick={() => setTheme('dark')}
      >
        <span class="theme-icon"><Moon class="size-4" strokeWidth={1.8} /></span>
        <span class="theme-label">{$_('app.account.darkMode')}</span>
        <span class="theme-swatch dark" aria-hidden="true"></span>
      </button>
    </div>
  </Field>
</Panel>

<style>
  .theme-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    max-width: 420px;
  }
  .theme-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 14px;
    border: 1px solid var(--line);
    background: var(--paper);
    color: var(--ink);
    cursor: pointer;
    text-align: left;
    font: inherit;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }
  .theme-card:hover {
    border-color: var(--line-2, #d2d2d7);
  }
  .theme-card.active {
    border-color: var(--ink);
    box-shadow: inset 0 0 0 1px var(--ink);
  }
  .theme-icon {
    display: flex;
    color: var(--ink-soft);
  }
  .theme-card.active .theme-icon {
    color: var(--ink);
  }
  .theme-label {
    font-size: 14px;
    font-weight: 600;
  }
  .theme-swatch {
    width: 100%;
    height: 36px;
    border: 1px solid var(--line);
  }
  .theme-swatch.light {
    background: linear-gradient(135deg, #ffffff 50%, #f4f4f4 50%);
  }
  .theme-swatch.dark {
    background: linear-gradient(135deg, #1d1d1f 50%, #111111 50%);
  }
  @media (max-width: 480px) {
    .theme-options {
      grid-template-columns: 1fr;
    }
  }
</style>
