<script lang="ts">
  import { dev } from '$app/environment';
  import { _ } from 'svelte-i18n';
  import { showBanner, consent, acceptAll, rejectAll, saveConsent } from '$lib/consent';

  let customising = $state(false);
  let analytics = $state(false);
  let marketing = $state(false);

  function customise() {
    analytics = $consent?.analytics ?? false;
    marketing = $consent?.marketing ?? false;
    customising = true;
  }

  function save() {
    saveConsent({ analytics, marketing });
    customising = false;
  }
</script>

{#if $showBanner && !dev}
  <div class="cc" role="dialog" aria-labelledby="cc-title" data-testid="cookie-banner">
    <p id="cc-title" class="cc-title">{$_('cookie.title')}</p>
    <p class="cc-text">{$_('cookie.text')}</p>

    {#if customising}
      <fieldset class="cc-options">
        <label class="cc-option">
          <input type="checkbox" checked disabled />
          <span><strong>{$_('cookie.necessary')}</strong>{$_('cookie.necessaryHint')}</span>
        </label>
        <label class="cc-option">
          <input type="checkbox" bind:checked={analytics} data-testid="cookie-analytics" />
          <span><strong>{$_('cookie.analytics')}</strong>{$_('cookie.analyticsHint')}</span>
        </label>
        <label class="cc-option">
          <input type="checkbox" bind:checked={marketing} data-testid="cookie-marketing" />
          <span><strong>{$_('cookie.marketing')}</strong>{$_('cookie.marketingHint')}</span>
        </label>
      </fieldset>
      <div class="cc-actions">
        <button class="cc-btn" type="button" onclick={rejectAll}>{$_('cookie.rejectAll')}</button>
        <button class="cc-btn" type="button" onclick={save} data-testid="cookie-save">{$_('cookie.save')}</button>
      </div>
    {:else}
      <div class="cc-actions">
        <button class="cc-btn" type="button" onclick={rejectAll} data-testid="cookie-reject">{$_('cookie.rejectAll')}</button>
        <button class="cc-btn" type="button" onclick={acceptAll} data-testid="cookie-accept">{$_('cookie.acceptAll')}</button>
      </div>
      <button class="cc-link" type="button" onclick={customise} data-testid="cookie-customise">{$_('cookie.customise')}</button>
    {/if}
  </div>
{/if}

<style>
  .cc {
    position: fixed;
    left: 16px;
    bottom: 16px;
    z-index: 9999;
    width: calc(100% - 32px);
    max-width: 360px;
    background: var(--background, #fff);
    color: var(--foreground, #111);
    border: 1px solid var(--border, #d2d2d7);
    border-radius: 0;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.16);
    padding: 16px;
    font-family: var(--sans, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif);
  }
  .cc-title {
    font-size: 13px;
    font-weight: 600;
    margin: 0 0 6px;
  }
  .cc-text {
    font-size: 12.5px;
    line-height: 1.5;
    opacity: 0.8;
    margin: 0 0 12px;
  }
  .cc-options {
    border: 0;
    padding: 0;
    margin: 0 0 12px;
    display: grid;
    gap: 10px;
  }
  .cc-option {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: 12.5px;
    line-height: 1.4;
  }
  .cc-option strong {
    display: block;
  }
  .cc-option input {
    border-radius: 0;
    margin-top: 2px;
  }
  .cc-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .cc-btn {
    appearance: none;
    border: 1px solid var(--foreground, #111);
    border-radius: 0;
    background: var(--foreground, #111);
    color: var(--background, #fff);
    padding: 8px 12px;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .cc-btn:hover {
    opacity: 0.85;
  }
  .cc-link {
    appearance: none;
    background: none;
    border: 0;
    padding: 0;
    margin-top: 10px;
    font: inherit;
    font-size: 12.5px;
    color: inherit;
    text-decoration: underline;
    cursor: pointer;
  }
</style>
