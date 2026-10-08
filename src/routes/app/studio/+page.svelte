<script lang="ts">
  import PageTitle from '$lib/components/PageTitle.svelte';
  import { deserialize } from '$app/forms';
  import type { ActionResult } from '@sveltejs/kit';
  import { goto, invalidateAll } from '$app/navigation';
  import { ArrowLeft, Check } from '@lucide/svelte';
  import PageHead from '$lib/components/PageHead.svelte';
  import CreditAmount from '$lib/components/CreditAmount.svelte';
  import PhotoDrop, { type Checked } from '$lib/components/studio/PhotoDrop.svelte';
  import NodeReferences from '$lib/components/canvas/NodeReferences.svelte';
  import type { NodeReference } from '$lib/canvas/node-references';
  import { canvasUploadPrefix } from '$lib/canvas/upload-kind';
  import { createSupabaseBrowserClient } from '$lib/supabase/client';
  import { billingPath } from '$lib/billing-path';
  import { DEFAULT_VERSIONS, Step, STEPS, VERSION_CHOICES } from '$lib/studio/wizard';

  type Quote = { count: number; overLimit: boolean; perImage: number; total: number; droppedRefs: number; skipped: string[] };
  type Shortfall = { needed: number; balance: number };
  type Product = { id: string; title: string; image: string | null; kids: boolean };

  const UPLOAD_STAGE = { uploading: 'Uploading… (1 of 2)', saving: 'Saving to your products… (2 of 2)', added: 'Added to your products.' } as const;

  let { data } = $props();

  const supabase = createSupabaseBrowserClient();
  let step = $state<Step>(Step.Photo);
  let uploaded = $state<Product[]>([]);
  let productIds = $state<string[]>([]);
  let environments = $state<string[]>(['white_ecom']);
  let shots = $state<string[]>(['packshot']);
  let modelIds = $state<string[]>([]);
  let variations = $state(DEFAULT_VERSIONS);
  let model = $state(data.previewModel || data.defaultModel);
  let styleRefs = $state<NodeReference[]>([]);
  let noPeopleConfirmed = $state(false);
  let name = $state(`Photos ${new Date().toISOString().slice(0, 10)}`);
  let stage = $state<string | null>(null);
  let busy = $state(false);
  let failure = $state<string | null>(null);
  let shortfall = $state<Shortfall | null>(null);
  let quote = $state<Quote | null>(null);

  const products = $derived<Product[]>([...uploaded, ...data.products.filter((p) => !uploaded.some((u) => u.id === p.id))]);
  const castable = $derived(data.models.filter((m) => m.allowed));
  const qualities = $derived(
    [
      { id: data.previewModel, label: 'Draft', hint: 'Fast and cheap. Good to try styles.' },
      { id: data.defaultModel, label: 'Best', hint: 'Sharpest detail, most faithful to your product.' }
    ].filter((q, i, all) => q.id && all.findIndex((o) => o.id === q.id) === i)
  );
  const creditsOf = (id: string) => data.imageModels.find((m) => m.id === id)?.credits ?? 0;
  const selection = $derived(JSON.stringify({ name, productIds, modelIds, environments, shots, variations, model, styleRefs, noPeopleConfirmed }));
  const actionBase = $derived(`/app/studio?project=${data.projectId}`);
  const affordable = $derived(!!quote && quote.total <= data.balance);
  const stepIndex = $derived(STEPS.findIndex((s) => s.id === step));

  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  function reasonOf(result: ActionResult): string {
    if (result.type === 'failure') {
      return String(result.data?.error);
    }
    const detail = result.type === 'error' ? (result.error as { message?: string } | undefined)?.message : null;
    return `${detail ?? 'Something went wrong'}. Try again in a moment.`;
  }

  async function post(action: string, body: FormData) {
    const res = await fetch(`${actionBase}&/${action}`, { method: 'POST', headers: { 'x-sveltekit-action': 'true' }, body });
    return deserialize(await res.text());
  }

  async function addPhoto(photo: Checked) {
    busy = true;
    failure = null;
    try {
      stage = UPLOAD_STAGE.uploading;
      const path = `${canvasUploadPrefix(data.orgId, data.projectId)}${crypto.randomUUID()}-${photo.file.name}`;
      const up = await supabase.storage.from('canvas-assets').upload(path, photo.file, { contentType: photo.file.type, upsert: false });
      if (up.error) {
        failure = `The upload failed: ${up.error.message}. Check your connection and try again.`;
        return;
      }

      stage = UPLOAD_STAGE.saving;
      const body = new FormData();
      const fields = { path, file_name: photo.file.name, mime_type: photo.file.type, bytes: String(photo.file.size), width: String(photo.width), height: String(photo.height) };
      for (const [k, v] of Object.entries(fields)) {
        body.set(k, v);
      }
      const result = await post('upload', body);
      if (result.type !== 'success') {
        failure = reasonOf(result);
        return;
      }
      const product = result.data?.product as { id: string; title: string; image: string };
      uploaded = [{ ...product, kids: false }, ...uploaded];
      productIds = [...new Set([...productIds, product.id])];
      stage = UPLOAD_STAGE.added;
    } finally {
      stage = stage === UPLOAD_STAGE.added ? stage : null;
      busy = false;
    }
  }

  async function refreshQuote(asked: string) {
    quote = null;
    const body = new FormData();
    body.set('selection', asked);
    const result = await post('quote', body);
    if (asked !== selection) {
      return;
    }
    if (result.type === 'success') {
      quote = result.data?.quote as Quote;
      failure = null;
      return;
    }
    quote = null;
    failure = result.type === 'failure' ? String(result.data?.error) : 'Could not price this selection.';
  }

  $effect(() => {
    if (step === Step.Generate) {
      void refreshQuote(selection);
    }
  });

  async function generate() {
    busy = true;
    failure = null;
    shortfall = null;
    try {
      const body = new FormData();
      body.set('selection', selection);
      const result = await post('generate', body);
      if (result.type === 'redirect') {
        await goto(result.location);
        return;
      }
      if (result.type === 'failure') {
        failure = String(result.data?.error);
        shortfall = (result.data?.shortfall as Shortfall | null) ?? null;
        await invalidateAll();
        return;
      }
      failure = reasonOf(result);
    } finally {
      busy = false;
    }
  }
</script>

<PageHead title="Photo studio" />

<div class="studio" data-testid="studio" data-step={step}>
  <ol class="steps" aria-label="Steps">
    {#each STEPS as s, i (s.id)}
      <li class:on={s.id === step} class:done={i < stepIndex}>
        <span class="num">{#if i < stepIndex}<Check size={12} />{:else}{i + 1}{/if}</span>{s.label}
      </li>
    {/each}
  </ol>

  {#if step === Step.Photo}
    <section class="panel">
      <header>
        <PageTitle text="Add your product photo" />
        <p>A clear photo of the product alone, in good light. We keep its shape, colours and label.</p>
      </header>

      <PhotoDrop {busy} {stage} onpick={addPhoto} />

      {#if products.length}
        <h2>Your products <span class="muted">{productIds.length} selected</span></h2>
        <div class="products">
          {#each products as product (product.id)}
            <button type="button" class="product" class:on={productIds.includes(product.id)} aria-pressed={productIds.includes(product.id)} onclick={() => (productIds = toggle(productIds, product.id))}>
              {#if product.image}<img src={product.image} alt="" loading="lazy" />{:else}<span class="noimg"></span>{/if}
              <span class="title">{product.title}</span>
              {#if productIds.includes(product.id)}<span class="tick"><Check size={14} /></span>{/if}
            </button>
          {/each}
        </div>
      {/if}

      {#if failure}<p class="error" role="alert">{failure}</p>{/if}

      <footer class="next">
        {#if data.projects.length > 1}
          <label class="project">
            <span class="muted">Project</span>
            <select value={data.projectId} onchange={(e) => goto(`/app/studio?project=${e.currentTarget.value}`)} data-testid="studio-project">
              {#each data.projects as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
            </select>
          </label>
        {/if}
        <button type="button" class="primary" disabled={!productIds.length || busy} onclick={() => (step = Step.Style)} data-testid="studio-next-style">Next: choose a style</button>
      </footer>
    </section>

    {#if data.batches.length}
      <section class="recent">
        <h2>Recent shoots</h2>
        <ul>
          {#each data.batches as batch (batch.id)}
            <li><a href={`/app/studio/${batch.id}`}>{batch.name}</a> <span class="muted">{new Date(batch.createdAt).toLocaleDateString()}</span></li>
          {/each}
        </ul>
      </section>
    {/if}
  {:else if step === Step.Style}
    <section class="panel">
      <header>
        <button type="button" class="back" onclick={() => (step = Step.Photo)}><ArrowLeft size={16} /> Photo</button>
        <PageTitle text="Pick a style" />
        <p>Each style you pick becomes its own photo. White is ready for Amazon and most marketplaces.</p>
      </header>

      <div class="styles">
        {#each data.environments as env (env.id)}
          <button type="button" class="style" class:on={environments.includes(env.id)} aria-pressed={environments.includes(env.id)} onclick={() => (environments = toggle(environments, env.id))} data-testid={`studio-style-${env.id}`}>
            <img src={env.preview} alt={`Example: ${env.label}`} loading="lazy" />
            <span class="label">{env.label}</span>
            <span class="hint">{env.hint}</span>
            {#if environments.includes(env.id)}<span class="tick"><Check size={14} /></span>{/if}
          </button>
        {/each}
      </div>

      <p class="muted credit">Examples made in Photo studio from “A small cup of coffee” by Julius Schorzman, CC BY-SA 2.0.</p>

      <details class="advanced">
        <summary>More options</summary>
        <div class="adv-body">
          <div>
            <h3>Shots</h3>
            <div class="chips">
              {#each data.shots as shot (shot.id)}
                <button type="button" class="chip" class:on={shots.includes(shot.id)} onclick={() => (shots = toggle(shots, shot.id))}>{shot.label}</button>
              {/each}
            </div>
          </div>
          <div>
            <h3>Models <span class="muted">synthetic people only, 21+</span></h3>
            {#if castable.length}
              <div class="chips">
                {#each castable as m (m.id)}
                  <button type="button" class="chip" class:on={modelIds.includes(m.id)} onclick={() => (modelIds = toggle(modelIds, m.id))}>{m.name}</button>
                {/each}
              </div>
            {:else}
              <p class="muted">None yet. <a href={`/p/${data.projectId}/influencers`}>Create one with AI</a> to shoot on a person.</p>
            {/if}
          </div>
          <div>
            <h3>Style references <span class="muted">scene, light, mood</span></h3>
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
          <label class="field">Name <input bind:value={name} /></label>
        </div>
      </details>

      <footer class="next">
        <button type="button" class="primary" disabled={!environments.length || !shots.length} onclick={() => (step = Step.Generate)} data-testid="studio-next-generate">Next: generate</button>
      </footer>
    </section>
  {:else}
    <section class="panel">
      <header>
        <button type="button" class="back" onclick={() => (step = Step.Style)}><ArrowLeft size={16} /> Style</button>
        <PageTitle text="Generate your photos" />
        <p>You see the price before anything is spent.</p>
      </header>

      <div class="row">
        <h2>Versions of each</h2>
        <div class="segmented" role="radiogroup" aria-label="Versions of each">
          {#each VERSION_CHOICES as n (n)}
            <button type="button" role="radio" aria-checked={variations === n} class:on={variations === n} onclick={() => (variations = n)}>{n}</button>
          {/each}
        </div>
      </div>

      {#if qualities.length > 1}
        <div class="row">
          <h2>Quality</h2>
          <div class="qualities" role="radiogroup" aria-label="Quality">
            {#each qualities as q (q.id)}
              <button type="button" role="radio" aria-checked={model === q.id} class="quality" class:on={model === q.id} onclick={() => (model = q.id)}>
                <span class="label">{q.label}</span>
                <span class="hint">{q.hint}</span>
                <span class="price"><CreditAmount amount={creditsOf(q.id)} /> per photo</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <div class="cost" data-testid="studio-cost" aria-live="polite">
        {#if quote}
          <p class="big"><strong>{quote.count}</strong> photo{quote.count === 1 ? '' : 's'} · <CreditAmount amount={quote.total} /></p>
          <p class="muted"><CreditAmount amount={quote.perImage} /> per photo · your balance <CreditAmount amount={data.balance} /></p>
          {#if quote.droppedRefs}<p class="warn">{quote.droppedRefs} style reference(s) will be left out: this quality takes fewer.</p>{/if}
          {#each quote.skipped as line}<p class="muted">Skipped: {line}</p>{/each}
          {#if quote.overLimit}<p class="error">At most 200 photos at a time: pick fewer styles or versions.</p>{/if}
        {:else}
          <p class="muted">Pricing…</p>
        {/if}
      </div>

      {#if (quote && !affordable) || shortfall}
        <div class="empty-credits" role="alert" data-testid="studio-no-credits">
          <p><strong>Not enough credits.</strong> These photos cost <CreditAmount amount={shortfall?.needed ?? quote?.total ?? 0} />, you have <CreditAmount amount={shortfall?.balance ?? data.balance} />.</p>
          <p class="muted">Pick Draft quality or fewer versions, or add credits.</p>
          <a class="button" href={billingPath(data.projectId)}>Add credits</a>
        </div>
      {:else if failure}
        <p class="error" role="alert">{failure}</p>
      {/if}

      <footer class="next">
        <button type="button" class="primary" disabled={busy || !quote || !quote.count || quote.overLimit || !affordable} onclick={generate} data-testid="studio-generate">
          {#if busy}Starting…{:else if quote}Generate {quote.count} photo{quote.count === 1 ? '' : 's'}{:else}Generate{/if}
        </button>
      </footer>
    </section>
  {/if}
</div>

<style>
  .studio {
    max-width: 960px;
    margin: 0 auto;
    padding: var(--ui-space-4) var(--ui-space-4) var(--ui-space-8);
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-4);
    color: var(--ui-ink);
  }
  .steps {
    list-style: none;
    display: flex;
    gap: var(--ui-space-4);
    margin: 0;
    padding: 0;
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-3);
  }
  .steps li {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
  }
  .steps .on {
    color: var(--ui-ink);
    font-weight: 600;
  }
  .num {
    display: inline-grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border: 1px solid var(--ui-line-strong);
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
  }
  .on .num {
    background: var(--ui-accent);
    border-color: var(--ui-accent);
    color: var(--ui-accent-ink);
  }
  .done .num {
    color: var(--ui-ok);
    border-color: var(--ui-ok);
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-4);
  }
  header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ui-space-1);
  }
  header p {
    margin: 0;
    color: var(--ui-ink-2);
    font-size: var(--ui-text-md);
  }
  h2 {
    margin: 0;
    font-size: var(--ui-text-md);
    font-weight: 600;
  }
  h3 {
    margin: 0 0 var(--ui-space-2);
    font-size: var(--ui-text-sm);
    font-weight: 600;
  }
  .muted {
    color: var(--ui-ink-3);
    font-size: var(--ui-text-sm);
    font-weight: 400;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--ui-space-1);
    padding: 0;
    border: 0;
    background: none;
    color: var(--ui-ink-2);
    font-size: var(--ui-text-sm);
    cursor: pointer;
  }
  .products {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: var(--ui-space-2);
  }
  .product,
  .style,
  .quality {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-1);
    padding: var(--ui-space-2);
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
    color: var(--ui-ink);
    text-align: left;
    cursor: pointer;
  }
  .product:hover,
  .style:hover,
  .quality:hover {
    background: var(--ui-hover);
  }
  .product.on,
  .style.on,
  .quality.on {
    border-color: var(--ui-accent);
    outline: 1px solid var(--ui-accent);
    outline-offset: -2px;
  }
  .product img,
  .noimg {
    width: 100%;
    aspect-ratio: 1;
    object-fit: contain;
    background: var(--ui-surface);
  }
  .title {
    font-size: var(--ui-text-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tick {
    position: absolute;
    top: var(--ui-space-2);
    right: var(--ui-space-2);
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
  }
  .styles {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--ui-space-2);
  }
  @media (min-width: 720px) {
    .styles {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  .style img {
    width: 100%;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    background: var(--ui-surface);
  }
  .label {
    font-size: var(--ui-text-md);
    font-weight: 600;
  }
  .hint {
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-2);
  }
  .advanced {
    border: 1px solid var(--ui-line);
  }
  .advanced summary {
    padding: var(--ui-space-3);
    font-size: var(--ui-text-md);
    font-weight: 600;
    cursor: pointer;
  }
  .adv-body {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-4);
    padding: 0 var(--ui-space-3) var(--ui-space-3);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-2);
  }
  .chip,
  .segmented button {
    min-height: 36px;
    padding: 0 var(--ui-space-3);
    font-size: var(--ui-text-md);
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
    color: var(--ui-ink);
    cursor: pointer;
  }
  .chip.on,
  .segmented .on {
    background: var(--ui-accent-wash);
    color: var(--ui-accent);
    border-color: var(--ui-accent);
  }
  .segmented {
    display: flex;
  }
  .segmented button {
    min-width: 48px;
  }
  .segmented button + button {
    margin-left: -1px;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
  }
  .qualities {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--ui-space-2);
  }
  .price {
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-2);
  }
  .cost {
    padding: var(--ui-space-4);
    background: var(--ui-surface);
    border: 1px solid var(--ui-line);
  }
  .cost p {
    margin: 0 0 var(--ui-space-1);
  }
  .big {
    font-size: var(--ui-text-lg);
  }
  .empty-credits {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ui-space-2);
    padding: var(--ui-space-4);
    border: 1px solid var(--ui-warn);
  }
  .empty-credits p {
    margin: 0;
  }
  .field,
  .confirm,
  .project {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    font-size: var(--ui-text-md);
  }
  .field input,
  .project select {
    min-height: 32px;
    padding: 0 var(--ui-space-2);
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font-size: var(--ui-text-md);
  }
  .next {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--ui-space-3);
    position: sticky;
    bottom: 0;
    padding: var(--ui-space-3) 0;
    background: var(--ui-bg);
    border-top: 1px solid var(--ui-line);
  }
  .project {
    margin-right: auto;
  }
  .primary,
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 var(--ui-space-6);
    font-size: var(--ui-text-md);
    font-weight: 600;
    border: 1px solid var(--ui-accent);
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
    text-decoration: none;
    cursor: pointer;
  }
  .primary:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  @media (max-width: 560px) {
    .next .primary {
      flex: 1;
    }
  }
  .error {
    margin: 0;
    color: var(--ui-danger);
    font-size: var(--ui-text-md);
  }
  .warn {
    color: var(--ui-warn);
  }
  .recent ul {
    list-style: none;
    margin: var(--ui-space-2) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-1);
    font-size: var(--ui-text-md);
  }
  .recent a {
    color: var(--ui-ink);
  }
</style>
