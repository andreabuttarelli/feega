<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import type { SubmitFunction } from '@sveltejs/kit';
  import PageHead from '$lib/components/PageHead.svelte';
  import NodeReferences from '$lib/components/canvas/NodeReferences.svelte';
  import type { NodeReference } from '$lib/canvas/node-references';

  type Quote = { count: number; overLimit: boolean; perImage: number; total: number; previewPerImage: number; previewModel: string; droppedRefs: number; skipped: string[] };

  let { data } = $props();

  let name = $state(`Catalogue ${new Date().toISOString().slice(0, 10)}`);
  let productIds = $state<string[]>([]);
  let modelIds = $state<string[]>([]);
  let environments = $state<string[]>(['white_ecom']);
  let shots = $state<string[]>(['packshot']);
  let variations = $state(1);
  let model = $state(data.defaultModel);
  let styleRefs = $state<NodeReference[]>([]);
  let noPeopleConfirmed = $state(false);
  let busy = $state(false);

  const selection = $derived(JSON.stringify({ name, productIds, modelIds, environments, shots, variations, model, styleRefs, noPeopleConfirmed }));
  const projectId = $derived(data.projectId);
  const castable = $derived(data.models.filter((m) => m.allowed));
  const hidden = $derived(data.models.length - castable.length);
  const actionBase = $derived(`/app/studio?project=${projectId}`);
  let quote = $state<Quote | null>(null);
  let failure = $state<string | null>(null);

  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  const submit: SubmitFunction = () => {
    busy = true;
    failure = null;
    return async ({ result }) => {
      busy = false;
      if (result.type === 'redirect') {
        await goto(result.location);
        return;
      }
      if (result.type === 'success') {
        quote = (result.data?.quote as Quote | undefined) ?? null;
        return;
      }
      if (result.type === 'failure') {
        failure = String(result.data?.error ?? 'Something went wrong.');
        return;
      }
      failure = 'Something went wrong.';
    };
  };
</script>

<div class="studio">
  <PageHead title="Photo studio" subtitle="Consistent catalogue photos for many products at once: pick products, synthetic models, scenes and shots." />

  <label class="source">
    <span class="muted">Products and media from</span>
    <select value={projectId} onchange={(e) => goto(`/app/studio?project=${e.currentTarget.value}`)} data-testid="studio-project">
      {#each data.projects as p (p.id)}
        <option value={p.id}>{p.name}</option>
      {/each}
    </select>
  </label>

  {#if data.batches.length}
    <section>
      <h3>Batches</h3>
      <ul class="batches">
        {#each data.batches as batch (batch.id)}
          <li><a href={`/app/studio/${batch.id}`}>{batch.name}</a> <span class="muted">{batch.status}</span></li>
        {/each}
      </ul>
    </section>
  {/if}

  <section>
    <h3>1 · Products</h3>
    {#if !data.products.length}
      <p class="muted">No products yet. Add a Products node to any canvas of this project and import your store, then come back.</p>
    {:else}
      <div class="tiles">
        {#each data.products as product (product.id)}
          <button type="button" class="tile" class:on={productIds.includes(product.id)} onclick={() => (productIds = toggle(productIds, product.id))}>
            {#if product.image}<img src={product.image} alt="" loading="lazy" />{/if}
            <span>{product.title}</span>
            {#if product.kids}<small>Kids: packshot and detail only</small>{/if}
          </button>
        {/each}
      </div>
    {/if}
  </section>

  <section>
    <h3>2 · Models <span class="muted">optional, synthetic only, 21+</span></h3>
    {#if castable.length}
      <div class="tiles">
        {#each castable as m (m.id)}
          <button type="button" class="tile" class:on={modelIds.includes(m.id)} onclick={() => (modelIds = toggle(modelIds, m.id))}>
            {#if m.cover}<img src={m.cover} alt="" loading="lazy" />{/if}
            <span>{m.name}</span>
          </button>
        {/each}
      </div>
    {:else}
      <p class="muted">No synthetic models yet. <a href={`/p/${projectId}/influencers`}>Create one with AI</a> (age 21+) to shoot on-model.</p>
    {/if}
    {#if hidden}<p class="muted">{hidden} catalogue or photo-based influencers are hidden: the studio casts only synthetic people.</p>{/if}
  </section>

  <section>
    <h3>3 · Environments</h3>
    <div class="chips">
      {#each data.environments as env (env.id)}
        <button type="button" class="chip" class:on={environments.includes(env.id)} onclick={() => (environments = toggle(environments, env.id))}>{env.label}</button>
      {/each}
    </div>
    <div class="refs">
      <span class="muted">Style references (scene, light, mood):</span>
      <NodeReferences
        references={styleRefs}
        catalogue={data.references.catalogue}
        media={data.references.media}
        assetUrl={(id) => data.references.mediaUrls[id] ?? ''}
        onchange={(next) => (styleRefs = next)}
      />
      {#if styleRefs.length}
        <label class="confirm"><input type="checkbox" bind:checked={noPeopleConfirmed} /> These references contain no people</label>
      {/if}
    </div>
  </section>

  <section>
    <h3>4 · Shots and variations</h3>
    <div class="chips">
      {#each data.shots as shot (shot.id)}
        <button type="button" class="chip" class:on={shots.includes(shot.id)} onclick={() => (shots = toggle(shots, shot.id))}>{shot.label}</button>
      {/each}
    </div>
    <div class="row">
      <label>Variations <input type="number" min="1" max="8" bind:value={variations} /></label>
      <label>
        Model
        <select bind:value={model}>
          {#each data.imageModels as m (m.id)}
            <option value={m.id}>{m.label} · {m.credits} credits</option>
          {/each}
        </select>
      </label>
      <label>Name <input bind:value={name} /></label>
    </div>
  </section>

  <section class="actions">
    <form method="POST" action={`${actionBase}&/quote`} use:enhance={submit}>
      <input type="hidden" name="selection" value={selection} />
      <button type="submit" disabled={busy}>Estimate</button>
    </form>
    <form method="POST" action={`${actionBase}&/preview`} use:enhance={submit}>
      <input type="hidden" name="selection" value={selection} />
      <button type="submit" class="primary" disabled={busy || !quote || quote.overLimit}>Preview 3 on the cheap model</button>
    </form>
    <span class="muted">Balance: {data.balance} credits</span>
  </section>

  {#if failure}<p class="error" role="alert">{failure}</p>{/if}

  {#if quote}
    <section class="quote" data-testid="studio-quote">
      <p><strong>{quote.count}</strong> photos · {quote.perImage} credits each · <strong>{quote.total}</strong> credits total</p>
      <p class="muted">Preview: 3 photos on {quote.previewModel}, {quote.previewPerImage * 3} credits.</p>
      {#if quote.overLimit}<p class="error">At most 200 photos per batch: remove something.</p>{/if}
      {#if quote.droppedRefs}<p class="warn">{quote.droppedRefs} style reference(s) exceed this model's limit and will be dropped.</p>{/if}
      {#each quote.skipped as line}<p class="muted">Skipped: {line}</p>{/each}
    </section>
  {/if}
</div>

<style>
  .studio { max-width: var(--content-max, 1100px); margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
  h3 { font-size: 13px; font-weight: 600; margin: 0 0 8px; }
  .muted { color: var(--ink-3, #6e6e73); font-size: 12px; font-weight: 400; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
  .tile { display: flex; flex-direction: column; gap: 4px; padding: 6px; border: 1px solid var(--ui-line-strong); background: var(--ui-bg); text-align: left; font-size: 12px; cursor: pointer; }
  .tile img { width: 100%; aspect-ratio: 1; object-fit: cover; }
  .tile small { color: var(--ink-3, #6e6e73); font-size: 11px; }
  .tile:disabled { opacity: 0.45; cursor: not-allowed; }
  .on { outline: 2px solid var(--ui-ink); outline-offset: -2px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { padding: 6px 10px; font-size: 12.5px; border: 1px solid var(--ui-line-strong); background: var(--ui-bg); cursor: pointer; }
  .chip:hover { border-color: var(--ui-ink-3); }
  .chip.on { background: var(--ui-accent-wash); color: var(--ui-accent); border-color: var(--ui-accent); }
  .refs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
  .confirm, .row label { font-size: 12.5px; display: flex; gap: 6px; align-items: center; }
  .row { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 10px; }
  .row input, .row select { padding: 4px 6px; border: 1px solid var(--ui-line-strong); background: var(--ui-bg); font-size: 12.5px; }
  .row input[type='number'] { width: 56px; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .actions button { padding: 8px 14px; font-size: 12.5px; font-weight: 600; border: 1px solid var(--ui-line-strong); background: var(--ui-bg); cursor: pointer; }
  .actions .primary { background: var(--ui-accent); color: var(--ui-accent-ink); border-color: var(--ui-accent); }
  .actions button:disabled { opacity: 0.5; cursor: not-allowed; }
  .quote { border: 1px solid var(--ui-line-strong); padding: 12px; font-size: 13px; }
  .quote p { margin: 2px 0; }
  .error { color: var(--danger, #c0392b); font-size: 12.5px; }
  .warn { color: var(--warn, #9a6700); font-size: 12.5px; }
  .source { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .source select { padding: 4px 6px; border: 1px solid var(--ui-line-strong); background: var(--ui-bg); font-size: 13px; }
  .batches { list-style: none; padding: 0; margin: 0; font-size: 13px; display: flex; flex-direction: column; gap: 4px; }
</style>
