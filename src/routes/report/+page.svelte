<script lang="ts">
  import { REPORT_REASONS, ReportReason, reasonOf } from '$lib/reports/reasons';
  import ReportFields from '$lib/components/reports/ReportFields.svelte';
  import { legalHref } from '$lib/legal-links';

  let { data, form } = $props();

  const values = $derived<Record<string, string>>({ url: data.prefillUrl, ...((form?.values as Record<string, string>) ?? {}) });
  const errors = $derived<Record<string, string>>((form?.errors as Record<string, string>) ?? {});
  let chosen = $state<string>('');
  const reasonId = $derived(chosen || values.reason || ReportReason.Illegal);
  const reason = $derived(reasonOf(reasonId)!);
</script>

<svelte:head>
  <title>Report content · feega</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="page">
  <a class="mark" href="/">feega</a>
  <h1>Report content</h1>

  {#if form?.success}
    <p class="done">Thank you. Your report was received. If you gave an email, a confirmation is on its way, and we will tell you our decision.</p>
  {:else}
    <p class="lead">
      Use this form to notify us of illegal content (EU Digital Services Act, art. 16), copyright infringement (DMCA), or your likeness or
      voice used without consent. You can also write to <a href="mailto:support@feega.app">support@feega.app</a>.
    </p>

    <form method="POST">
      <fieldset>
        <legend>Reason</legend>
        {#each REPORT_REASONS as r (r.id)}
          <label class="reason">
            <input type="radio" name="reason" value={r.id} checked={reasonId === r.id} onchange={() => (chosen = r.id)} />
            <span><strong>{r.label}</strong><small>{r.hint}</small></span>
          </label>
        {/each}
      </fieldset>

      {#key reason.id}
        <ReportFields fields={reason.fields} {values} {errors} />
      {/key}

      <div class="trap" aria-hidden="true">
        <label>Website <input name="website" tabindex="-1" autocomplete="off" /></label>
      </div>

      {#if errors.form}
        <p class="error">{errors.form}</p>
      {/if}

      <button type="submit">Send report</button>
      <p class="fine">
        We use what you send only to handle this report. Knowingly false notices may make you liable. See
        <a href={legalHref('terms')} target="_blank" rel="noopener">Terms §12 and §12A</a>.
      </p>
    </form>
  {/if}
</main>

<style>
  .page {
    max-width: 640px;
    margin: 0 auto;
    padding: 32px 16px 64px;
    color: var(--ink, #1d1d1f);
    background: var(--paper, #fff);
    min-height: 100vh;
  }
  .mark {
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-faint, #9a9a9e);
    text-decoration: none;
  }
  h1 {
    margin: 16px 0 8px;
    font-size: 24px;
  }
  .lead,
  .done {
    font-size: 14px;
    line-height: 1.5;
  }
  fieldset {
    margin: 0 0 20px;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 600;
  }
  .reason {
    display: flex;
    gap: 10px;
    padding: 10px;
    margin-bottom: 6px;
    border: 1px solid var(--line, #ededef);
    cursor: pointer;
  }
  .reason span {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 14px;
  }
  .reason small {
    color: var(--ink-faint, #6e6e73);
  }
  .trap {
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }
  button {
    padding: 12px 20px;
    font: inherit;
    font-weight: 600;
    color: var(--paper, #fff);
    background: var(--ink, #1d1d1f);
    border: 0;
    border-radius: 0;
    cursor: pointer;
  }
  .error {
    color: var(--danger, #d70015);
    font-size: 13px;
  }
  .fine {
    margin-top: 16px;
    font-size: 12px;
    color: var(--ink-faint, #6e6e73);
  }
</style>
