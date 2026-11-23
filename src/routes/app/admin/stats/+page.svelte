<script lang="ts">
  let { data } = $props();

  const FUNNEL_STEPS = [
    ['Installed', 'installed'],
    ['Opened', 'opened'],
    ['Finished onboarding', 'onboarded'],
    ['Session started', 'started'],
    ['Preview ready', 'preview_ready'],
    ['First edit', 'first_edit'],
    ['Signed in', 'signed_in'],
    ['Edits on 2+ days', 'multi_day']
  ] as const;
</script>

{#snippet failed()}
  <p>Couldn't load this table.</p>
{/snippet}

<main>
  <h1>Stats</h1>

  <h2>Weekly active installs by editor</h2>
  {#if data.weekly}
  <div class="scroll"><table>
    <thead><tr><th>Week</th><th>Editor</th><th>Installs</th></tr></thead>
    <tbody>
      {#each data.weekly as row (`${row.week}-${row.editor}`)}
        <tr><td>{row.week}</td><td>{row.editor}</td><td>{row.installs}</td></tr>
      {/each}
    </tbody>
  </table></div>
  {:else}
  {@render failed()}
  {/if}

  <h2>Retention by weekly cohort</h2>
  {#if data.retention}
  <div class="scroll"><table>
    <thead><tr><th>Cohort</th><th>Installs</th><th>+1</th><th>+2</th><th>+4</th><th>+8</th></tr></thead>
    <tbody>
      {#each data.retention as row (row.cohort)}
        <tr><td>{row.cohort}</td><td>{row.installs}</td><td>{row.w1}%</td><td>{row.w2}%</td><td>{row.w4}%</td><td>{row.w8}%</td></tr>
      {/each}
    </tbody>
  </table></div>
  {:else}
  {@render failed()}
  {/if}

  <h2>Sign-ups per week</h2>
  {#if data.signups}
  <div class="scroll"><table>
    <thead><tr><th>Week</th><th>Total</th><th>Confirmed</th></tr></thead>
    <tbody>
      {#each data.signups as row (row.week)}
        <tr><td>{row.week}</td><td>{row.total}</td><td>{row.confirmed}</td></tr>
      {/each}
    </tbody>
  </table></div>
  {:else}
  {@render failed()}
  {/if}

  <h2>Funnel, last 30 days</h2>
  {#if data.funnel}
  <div class="scroll"><table>
    <thead><tr><th>Step</th><th>Installs</th></tr></thead>
    <tbody>
      {#each FUNNEL_STEPS as [label, key] (key)}
        <tr><td>{label}</td><td>{data.funnel[key]}</td></tr>
      {/each}
    </tbody>
  </table></div>
  {:else}
  {@render failed()}
  {/if}
</main>

<style>
  main {
    max-width: 48rem;
    margin: 0 auto;
    padding: 2rem 1rem;
  }
  .scroll {
    overflow-x: auto;
    margin-bottom: 2rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    text-align: left;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid #8884;
    white-space: nowrap;
  }
  @media (max-width: 30rem) {
    main {
      padding: 1.25rem 1rem;
    }
    th,
    td {
      padding: 0.35rem 0.4rem;
      font-size: 0.875rem;
    }
  }
</style>
