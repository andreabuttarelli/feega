<script lang="ts">
  import { COUNTER_NOTICE_FIELDS } from '$lib/reports/reasons';
  import ReportFields from '$lib/components/reports/ReportFields.svelte';

  let { data, form } = $props();

  const values = $derived<Record<string, string>>((form?.values as Record<string, string>) ?? {});
  const errors = $derived<Record<string, string>>((form?.errors as Record<string, string>) ?? {});
</script>

<svelte:head>
  <title>DMCA counter-notice · feega</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="page">
  <a class="mark" href="/">feega</a>
  <h1>DMCA counter-notice</h1>

  {#if form?.success}
    <p>
      Received. We forwarded your counter-notice to the claimant. Unless they tell us they have filed a court action, we restore the material
      on or after {form.restoreAfter}.
    </p>
  {:else}
    <p class="lead">
      If your material was removed after a copyright notice and you believe it was a mistake or misidentification, send this counter-notice
      (17 U.S.C. §512(g)(3)). We forward it, including your name and address, to the person who sent the notice.
    </p>

    <form method="POST" action={`?t=${encodeURIComponent(data.token)}`}>
      <ReportFields fields={COUNTER_NOTICE_FIELDS} {values} {errors} />
      {#if errors.form}
        <p class="error">{errors.form}</p>
      {/if}
      <button type="submit">Send counter-notice</button>
    </form>
  {/if}
</main>

<style>
  .page {
    max-width: 640px;
    margin: 0 auto;
    padding: 32px 16px 64px;
    min-height: 100vh;
    color: var(--ink, #1d1d1f);
    background: var(--paper, #fff);
    font-size: 14px;
    line-height: 1.5;
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
  }
</style>
