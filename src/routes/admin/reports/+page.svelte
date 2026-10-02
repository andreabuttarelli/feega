<script lang="ts">
  import { reasonOf } from '$lib/reports/reasons';
  import { Decision, DECISION_EFFECTS, groundsFor, ReportStatus } from '$lib/reports/decisions';

  let { data, form } = $props();

  const DECISIONS = Object.values(Decision);
  const picked = $state<Record<string, Decision>>({});
  const decisionOf = (id: string): Decision => picked[id] ?? Decision.Remove;
</script>

<svelte:head>
  <title>Reports · feega</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="page">
  <h1>Moderation queue</h1>
  <p class="lead">Open cases first, by priority. Every decision needs a ground and the facts; the affected user and the reporter are emailed.</p>

  {#if !data.reports.length}
    <p>No reports.</p>
  {/if}

  {#each data.reports as r (r.id)}
    <article class="case" class:urgent={r.escalated_at && r.status === ReportStatus.Open}>
      <header>
        <strong>{reasonOf(r.reason)?.label ?? r.reason}</strong>
        <span class="status">{r.status}</span>
        {#if r.escalated_at}<span class="flag">ESCALATE</span>{/if}
        <time>{r.created_at.slice(0, 16).replace('T', ' ')}</time>
      </header>
      <p><a href={r.target_url} target="_blank" rel="noopener noreferrer">{r.target_url}</a></p>
      <dl>
        {#each Object.entries((r.details ?? {}) as Record<string, string>) as [k, v] (k)}
          {#if k !== 'url'}<dt>{k}</dt><dd>{v}</dd>{/if}
        {/each}
      </dl>
      {#if r.decision}
        <p class="decided">Decision: {r.decision} · {r.ground} — {r.decision_note}</p>
      {/if}
      {#if r.restore_after}
        <p class="decided">Counter-notice: restore after {r.restore_after.slice(0, 10)}{r.suit_filed_at ? ' (suit filed: timer stopped)' : ''}</p>
        {#if !r.suit_filed_at && r.status === ReportStatus.CounterNoticed}
          <form method="POST" action="?/suitFiled">
            <input type="hidden" name="id" value={r.id} />
            <button type="submit" class="secondary">Claimant filed suit</button>
          </form>
        {/if}
      {/if}

      <form method="POST" action="?/decide" class="decide">
        <input type="hidden" name="id" value={r.id} />
        <select name="decision" value={decisionOf(r.id)} onchange={(e) => (picked[r.id] = e.currentTarget.value as Decision)}>
          {#each DECISIONS as d (d)}
            <option value={d}>{DECISION_EFFECTS[d].label}</option>
          {/each}
        </select>
        <select name="ground" required>
          {#each groundsFor(decisionOf(r.id)) as g (g.id)}
            <option value={g.id}>{g.label} — {g.clause}</option>
          {/each}
        </select>
        <textarea name="note" required rows="2" placeholder="Facts and circumstances (sent to the user)"></textarea>
        <button type="submit">Decide</button>
        {#if form?.id === r.id && form?.error}<p class="error">{form.error}</p>{/if}
        {#if form?.id === r.id && form?.success}<p class="ok">Saved.</p>{/if}
      </form>
    </article>
  {/each}
</main>

<style>
  .page {
    max-width: 880px;
    margin: 0 auto;
    padding: 32px 16px 64px;
    min-height: 100vh;
    font-size: 14px;
    color: var(--ink, #1d1d1f);
    background: var(--paper, #fff);
  }
  h1 {
    margin: 0 0 8px;
    font-size: 22px;
  }
  .case {
    padding: 14px;
    margin-bottom: 12px;
    border: 1px solid var(--line, #ededef);
  }
  .case.urgent {
    border-color: var(--danger, #d70015);
  }
  header {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: baseline;
  }
  .status,
  time {
    color: var(--ink-faint, #6e6e73);
  }
  .flag {
    padding: 0 6px;
    font-size: 11px;
    font-weight: 700;
    color: var(--paper, #fff);
    background: var(--danger, #d70015);
  }
  a {
    word-break: break-all;
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 2px 12px;
    margin: 8px 0;
  }
  dt {
    color: var(--ink-faint, #6e6e73);
  }
  dd {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .decide {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }
  select,
  textarea {
    padding: 8px;
    font: inherit;
    color: inherit;
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    border-radius: 0;
    max-width: 100%;
  }
  textarea {
    flex: 1 1 100%;
  }
  button {
    padding: 8px 14px;
    font: inherit;
    font-weight: 600;
    color: var(--paper, #fff);
    background: var(--ink, #1d1d1f);
    border: 0;
    border-radius: 0;
    cursor: pointer;
  }
  button.secondary {
    color: var(--ink, #1d1d1f);
    background: transparent;
    border: 1px solid var(--line-2, #d2d2d7);
  }
  .decided {
    color: var(--ink-faint, #6e6e73);
  }
  .error {
    color: var(--danger, #d70015);
  }
  .ok {
    color: var(--ok, #248a3d);
  }
</style>
