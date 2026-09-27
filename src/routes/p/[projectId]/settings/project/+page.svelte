<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';

  let { data, form } = $props();

  let confirmName = $state('');
  const canDelete = $derived(confirmName === data.project.name);
  const createHref = $derived(
    `/p/${data.project.id}/brands/new?returnTo=${encodeURIComponent(page.url.pathname)}`
  );
</script>

<section class="block">
  <h2 class="block-title">Name</h2>
  <form method="POST" action="?/rename" use:enhance class="row">
    <input name="name" type="text" value={data.project.name} required aria-label="Project name" />
    <button class="btn primary" type="submit">Rename</button>
  </form>
  {#if form?.renamed}<p class="msg ok">Renamed.</p>{/if}
</section>

<section class="block">
  <h2 class="block-title">Brand</h2>
  {#if data.linkedBrand}
    <p class="block-desc">Linked to <strong>{data.linkedBrand.name}</strong>. Posts, calendar and connected accounts use this brand.</p>
  {:else}
    <p class="block-desc">No brand linked. The canvas works without one; link a brand when you are ready to publish.</p>
  {/if}

  {#if data.orgBrands.length}
    <form method="POST" action="?/linkBrand" use:enhance class="row">
      <select name="brandId" required aria-label="Brand">
        <option value="" disabled selected={!data.linkedBrand}>Choose a brand</option>
        {#each data.orgBrands as b (b.id)}
          <option value={b.id} selected={b.id === data.linkedBrand?.id}>{b.name}</option>
        {/each}
      </select>
      <button class="btn primary" type="submit">{data.linkedBrand ? 'Switch brand' : 'Link brand'}</button>
    </form>
  {/if}

  <div class="row">
    <a class="btn ghost" href={createHref}>Create brand</a>
    {#if data.linkedBrand}
      <form method="POST" action="?/unlinkBrand" use:enhance>
        <button class="btn ghost" type="submit">Unlink brand</button>
      </form>
    {/if}
  </div>
</section>

<section class="block">
  <h2 class="block-title">Delete project</h2>
  <p class="block-desc">The project and its canvases disappear from your workspace. Brands and posts stay.</p>
  <form method="POST" action="?/delete" class="col">
    <label class="confirm">
      <span>Type <strong>{data.project.name}</strong> to confirm</span>
      <input name="confirmName" type="text" bind:value={confirmName} autocomplete="off" />
    </label>
    <button class="btn danger" type="submit" disabled={!canDelete}>Delete project</button>
  </form>
  {#if form?.error}<p class="msg warn">{form.error}</p>{/if}
</section>

<style>
  .block { display: flex; flex-direction: column; gap: 12px; max-width: 640px; margin-bottom: 32px; }
  .block-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--ink); }
  .block-desc { margin: 0; font-size: 14px; line-height: 1.5; color: var(--ink-soft); }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .col { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
  .confirm { display: flex; flex-direction: column; gap: 6px; width: 100%; font-size: 13px; color: var(--ink-soft); }
  input, select {
    flex: 1; min-width: 0; font: inherit; font-size: 14px; color: var(--ink); background: var(--paper);
    border: 1px solid var(--line); padding: 9px 10px; box-sizing: border-box;
  }
  .btn {
    font-size: 13px; font-weight: 600; padding: 9px 16px; cursor: pointer; line-height: 1;
    border: 1px solid transparent; text-decoration: none;
  }
  .btn:disabled { opacity: 0.5; cursor: default; }
  .btn.primary { background: var(--accent, #7c5cff); color: #fff; }
  .btn.ghost { background: transparent; color: var(--ink-soft); border-color: var(--line); }
  .btn.danger { background: #c0392b; color: #fff; }
  .msg { margin: 0; font-size: 13px; }
  .msg.ok { color: var(--accent, #7c5cff); font-weight: 600; }
  .msg.warn { color: #b25000; }
</style>
