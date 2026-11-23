<script lang="ts">
  let { data } = $props();

  const FUNNEL_STEPS = [
    ['Session started', 'started'],
    ['Preview ready', 'preview_ready'],
    ['First edit', 'first_edit'],
    ['Edits on 2+ days', 'multi_day']
  ] as const;
</script>

<main>
  <h1>Stats</h1>

  <h2>Weekly active installs by editor</h2>
  <table>
    <thead><tr><th>Week</th><th>Editor</th><th>Installs</th></tr></thead>
    <tbody>
      {#each data.weekly as row (`${row.week}-${row.editor}`)}
        <tr><td>{row.week}</td><td>{row.editor}</td><td>{row.installs}</td></tr>
      {/each}
    </tbody>
  </table>

  <h2>Retention by weekly cohort</h2>
  <table>
    <thead><tr><th>Cohort</th><th>Installs</th><th>+1</th><th>+2</th><th>+4</th><th>+8</th></tr></thead>
    <tbody>
      {#each data.retention as row (row.cohort)}
        <tr><td>{row.cohort}</td><td>{row.installs}</td><td>{row.w1}%</td><td>{row.w2}%</td><td>{row.w4}%</td><td>{row.w8}%</td></tr>
      {/each}
    </tbody>
  </table>

  <h2>Funnel, last 30 days</h2>
  <table>
    <thead><tr><th>Step</th><th>Installs</th></tr></thead>
    <tbody>
      {#each FUNNEL_STEPS as [label, key] (key)}
        <tr><td>{label}</td><td>{data.funnel[key]}</td></tr>
      {/each}
    </tbody>
  </table>
</main>

<style>
  main {
    max-width: 48rem;
    margin: 0 auto;
    padding: 2rem 1rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 2rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid #8884;
  }
</style>
