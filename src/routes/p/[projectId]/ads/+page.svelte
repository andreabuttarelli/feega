<script lang="ts">
  import { _ } from 'svelte-i18n';
  import PageHead from '$lib/components/PageHead.svelte';
  import { page } from '$app/stores';

  let { data } = $props();
  const state = $derived(data.state);
  const projectId = $derived($page.params.projectId);
</script>

<PageHead
  title={$_('app.ads.social.title')}
  subtitle={state.kind === 'ready'
    ? $_('app.ads.social.subtitle', { values: { brand: state.brand.name } })
    : $_('app.ads.steps.title')}
/>

<div class="content">
  {#if state.kind === 'no_brand'}
    <section class="panel gate">
      <h2>{$_('app.ads.noBrand.title')}</h2>
      <p>{$_('app.ads.noBrand.body')}</p>
      <a class="cta" href={`/p/${projectId}/brands/new`}>{$_('app.ads.noBrand.cta')}</a>
    </section>
  {:else if state.kind === 'no_ad_account'}
    <section class="panel gate">
      <h2>{$_('app.ads.noAdAccount.title')}</h2>
      <p>{$_('app.ads.noAdAccount.body', { values: { brand: state.brand.name } })}</p>
      <button class="cta" type="button" disabled title={$_('app.ads.noAdAccount.unavailable')}>
        {$_('app.ads.noAdAccount.cta')}
      </button>
      <p class="hint">{$_('app.ads.noAdAccount.unavailable')}</p>
    </section>
  {:else}
    <section class="panel block">
      <div class="panel-head">
        <div class="t">{$_('app.ads.campaigns')}</div>
      </div>
      <div class="empty"><p>{$_('app.ads.empty')}</p></div>
    </section>

    <section class="panel block steps">
      <div class="panel-head"><div class="t">{$_('app.ads.steps.title')}</div></div>
      <ol>
        <li>{$_('app.ads.steps.one')}</li>
        <li>{$_('app.ads.steps.two')}</li>
        <li>{$_('app.ads.steps.three')}</li>
      </ol>
    </section>
  {/if}
</div>

<style>
  .content { display: flex; flex-direction: column; gap: 0; }
  .block { margin-top: 16px; }
  .panel-head { display: flex; align-items: center; padding: 14px 22px; border-bottom: 1px solid var(--line); }
  .t { font-weight: 600; }
  .empty { padding: 22px; color: var(--muted); }
  .gate {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 28px 24px;
    max-width: 480px;
    margin: 32px auto 0;
    border: 1px solid var(--line);
    text-align: left;
  }
  .gate h2 { margin: 0; font-size: 1.1rem; font-weight: 650; }
  .gate p { margin: 0; font-size: 14px; line-height: 1.5; color: var(--muted); }
  .gate p.hint { font-size: 12.5px; }
  .cta {
    display: inline-flex;
    align-items: center;
    height: 38px;
    margin-top: 6px;
    padding: 0 18px;
    background: var(--ink);
    color: var(--paper);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
  }
  .cta:disabled { background: var(--line); color: var(--muted); cursor: not-allowed; }
  .steps ol { margin: 0; padding: 14px 22px 18px 38px; display: flex; flex-direction: column; gap: 6px; }
  .steps li { font-size: 14px; color: var(--muted); }
</style>
