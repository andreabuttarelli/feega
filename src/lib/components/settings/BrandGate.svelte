<script lang="ts">
  let {
    projectId,
    returnTo,
    orgBrands
  }: { projectId: string; returnTo: string; orgBrands: { id: string; name: string }[] } = $props();

  const createHref = $derived(`/p/${projectId}/brands/new?returnTo=${encodeURIComponent(returnTo)}`);
</script>

<section class="gate" data-testid="brand-gate">
  <h2 class="gate-title">This project has no brand yet</h2>
  <p class="gate-hint">This section belongs to a brand. Link an existing brand or create one.</p>

  {#if orgBrands.length}
    <form method="POST" action={`/p/${projectId}/settings/project?/linkBrand`} class="gate-form">
      <input type="hidden" name="returnTo" value={returnTo} />
      <select name="brandId" required>
        <option value="" disabled selected>Choose a brand</option>
        {#each orgBrands as b (b.id)}
          <option value={b.id}>{b.name}</option>
        {/each}
      </select>
      <button class="btn primary" type="submit">Link brand</button>
    </form>
  {/if}

  <a class="btn ghost" href={createHref}>Create brand</a>
</section>

<style>
  .gate { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; max-width: 520px; }
  .gate-title { margin: 0; font-size: 18px; font-weight: 600; color: var(--ink); }
  .gate-hint { margin: 0; font-size: 14px; line-height: 1.5; color: var(--ink-soft); }
  .gate-form { display: flex; gap: 8px; width: 100%; }
  .gate-form select {
    flex: 1; font: inherit; font-size: 14px; color: var(--ink); background: var(--paper);
    border: 1px solid var(--line); padding: 9px 10px;
  }
  .btn {
    font-size: 13px; font-weight: 600; padding: 9px 16px; cursor: pointer; line-height: 1;
    border: 1px solid transparent; text-decoration: none;
  }
  .btn.primary { background: var(--accent, #7c5cff); color: #fff; }
  .btn.ghost { background: transparent; color: var(--ink-soft); border-color: var(--line); }
</style>
