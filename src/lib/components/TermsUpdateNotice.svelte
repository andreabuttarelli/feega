<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { legalHref } from '$lib/legal-links';

  let { version } = $props<{ version: string | null }>();
  let dismissed = $state(false);

  async function dismiss() {
    dismissed = true;
    try {
      await fetch('/api/terms-accept', { method: 'POST' });
    } catch {
      dismissed = false;
    }
  }
</script>

{#if version && !dismissed}
  <div class="terms-notice" role="status">
    <span>{$_('legal.updated.title')}</span>
    <a href={legalHref('terms')} target="_blank" rel="noopener" onclick={dismiss}>
      {$_('legal.updated.action')}
    </a>
  </div>
{/if}

<style>
  .terms-notice {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 9998;
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--paper, #fff);
    border: 1px solid var(--line, #d2d2d7);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.16);
    padding: 12px 16px;
    font-size: 13px;
    color: var(--ink, #1d1d1f);
  }
  a {
    color: var(--accent, #7c5cff);
    font-weight: 600;
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
</style>
