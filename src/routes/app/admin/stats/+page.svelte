<script lang="ts">
  let { data } = $props();

  const EDIT_DIM_TITLES = [
    ['prop_category', 'Property category'],
    ['target', 'Edit target'],
    ['file_ext', 'File type'],
    ['breakpoint', 'Breakpoint'],
    ['state', 'State']
  ] as const;
</script>

{#snippet failed()}
  <p>Couldn't load this table.</p>
{/snippet}

<main>
  <h1>Stats</h1>

  <h2>Active installs per day, last 30 days</h2>
  {#if data.active}
  <div class="scroll"><table>
    <thead><tr><th>Day</th><th>Active</th><th>Signed in</th><th>Anonymous</th></tr></thead>
    <tbody>
      {#each data.active.day as row (row.period)}
        <tr><td>{row.period}</td><td>{row.installs}</td><td>{row.signed_in}</td><td>{row.anonymous}</td></tr>
      {/each}
    </tbody>
  </table></div>

  <h2>Active installs per week</h2>
  <div class="scroll"><table>
    <thead><tr><th>Week</th><th>Active</th><th>Signed in</th><th>Anonymous</th></tr></thead>
    <tbody>
      {#each data.active.week as row (row.period)}
        <tr><td>{row.period}</td><td>{row.installs}</td><td>{row.signed_in}</td><td>{row.anonymous}</td></tr>
      {/each}
    </tbody>
  </table></div>
  {:else}
  {@render failed()}
  {/if}

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

  <h2>Surface, last 30 days</h2>
  {#if data.surfaces}
  <div class="scroll"><table>
    <thead><tr><th>Host</th><th>OS</th><th>Version</th><th>Installs</th></tr></thead>
    <tbody>
      {#each data.surfaces as row (`${row.editor}-${row.os}-${row.ext_version}`)}
        <tr><td>{row.editor}</td><td>{row.os}</td><td>{row.ext_version}</td><td>{row.installs}</td></tr>
      {/each}
    </tbody>
  </table></div>
  {:else}
  {@render failed()}
  {/if}

  <h2>Funnel, installs first seen in the last 30 days</h2>
  {#if data.funnel}
  <div class="scroll"><table>
    <thead><tr><th>Step</th><th>Installs</th><th>Of first seen</th></tr></thead>
    <tbody>
      {#each data.funnel as row (row.step)}
        <tr><td>{row.step}</td><td>{row.installs}</td><td>{row.percent}%</td></tr>
      {/each}
    </tbody>
  </table></div>
  {:else}
  {@render failed()}
  {/if}

  <h2>Onboarding by step</h2>
  {#if data.onboarding}
  <div class="scroll"><table>
    <thead><tr><th>Step</th><th>Viewed</th><th>Completed</th><th>Skipped</th></tr></thead>
    <tbody>
      {#each data.onboarding as row (row.step)}
        <tr><td>{row.step}</td><td>{row.viewed}</td><td>{row.completed}</td><td>{row.skipped}</td></tr>
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

  <h2>Diffs per day, last 30 days</h2>
  {#if data.diffs}
  <div class="scroll"><table>
    <thead><tr><th>Day</th><th>Diffs</th><th>AI</th><th>Reverted</th><th>Lines +</th><th>Lines -</th></tr></thead>
    <tbody>
      {#each data.diffs as row (row.day)}
        <tr><td>{row.day}</td><td>{row.diffs}</td><td>{row.aiShare}%</td><td>{row.revertRate}%</td><td>{row.lines_added}</td><td>{row.lines_removed}</td></tr>
      {/each}
    </tbody>
  </table></div>
  {:else}
  {@render failed()}
  {/if}

  {#if data.editDims}
    {#each EDIT_DIM_TITLES as [dim, title] (dim)}
      <h2>{title}, last 30 days</h2>
      <div class="scroll"><table>
        <thead><tr><th>Value</th><th>Diffs</th></tr></thead>
        <tbody>
          {#each data.editDims[dim] as row (row.value)}
            <tr><td>{row.value}</td><td>{row.diffs}</td></tr>
          {/each}
        </tbody>
      </table></div>
    {/each}
  {:else}
  <h2>Edit breakdown</h2>
  {@render failed()}
  {/if}

  <h2>Feature usage, last 30 days</h2>
  {#if data.features}
  <div class="scroll"><table>
    <thead><tr><th>Event</th><th>Count</th><th>Installs</th></tr></thead>
    <tbody>
      {#each data.features as row (row.event)}
        <tr><td>{row.event}</td><td>{row.events}</td><td>{row.installs}</td></tr>
      {/each}
    </tbody>
  </table></div>
  {:else}
  {@render failed()}
  {/if}

  <h2>AI agents, last 30 days</h2>
  {#if data.agents}
  <div class="scroll"><table>
    <thead><tr><th>Agent</th><th>Sessions</th><th>Messages</th><th>Tool calls</th><th>Allowed</th><th>Rejected</th><th>Cancels</th><th>Errors</th><th>Diffs</th><th>Reverted</th></tr></thead>
    <tbody>
      {#each data.agents as row (row.agent)}
        <tr><td>{row.agent}</td><td>{row.sessions}</td><td>{row.messages}</td><td>{row.tool_calls}</td><td>{row.allowed}</td><td>{row.rejected}</td><td>{row.cancels}</td><td>{row.errors}</td><td>{row.diffs}</td><td>{row.reverted}</td></tr>
      {/each}
    </tbody>
  </table></div>
  {:else}
  {@render failed()}
  {/if}

  <h2>Errors, last 30 days</h2>
  {#if data.errors}
  <div class="scroll"><table>
    <thead><tr><th>Event</th><th>Class</th><th>Area</th><th>Count</th><th>Installs</th></tr></thead>
    <tbody>
      {#each data.errors as row (`${row.event}-${row.error_class}-${row.area}`)}
        <tr><td>{row.event}</td><td>{row.error_class}</td><td>{row.area}</td><td>{row.events}</td><td>{row.installs}</td></tr>
      {/each}
    </tbody>
  </table></div>
  {:else}
  {@render failed()}
  {/if}

  <h2>Frameworks and styling, last 30 days</h2>
  {#if data.frameworks}
  <div class="scroll"><table>
    <thead><tr><th>Framework</th><th>Styling</th><th>Installs</th></tr></thead>
    <tbody>
      {#each data.frameworks as row (`${row.framework}-${row.styling}`)}
        <tr><td>{row.framework}</td><td>{row.styling}</td><td>{row.installs}</td></tr>
      {/each}
    </tbody>
  </table></div>
  {:else}
  {@render failed()}
  {/if}

  <h2>Sign-ups per week</h2>
  {#if data.signups}
  <div class="scroll"><table>
    <thead><tr><th>Week</th><th>Real</th><th>Confirmed</th><th>Blocked domains</th></tr></thead>
    <tbody>
      {#each data.signups as row (row.week)}
        <tr><td>{row.week}</td><td>{row.total}</td><td>{row.confirmed}</td><td>{row.blocked ?? '-'}</td></tr>
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
