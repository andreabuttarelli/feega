<script lang="ts">
  /**
   * IL WIZARD, UN PASSO ALLA VOLTA — sito → analisi → prodotti → target →
   * handle del brand → overview → approva. `STEPS` è la tabella: l'ordine e le etichette stanno
   * qui, non sparsi in `if`/`else` per ogni bottone avanti/indietro.
   *
   * LO STATO SOPRAVVIVE A UN REFRESH — `sessionStorage`, chiave per progetto: un wizard aperto
   * per sbaglio in un'altra scheda non lo sovrascrive, e chiudere la scheda lo dimentica (un
   * brand a metà non deve restare per sempre in un cassetto).
   */
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount, onDestroy } from 'svelte';
  import PageHead from '$lib/components/PageHead.svelte';
  import PlatformGlyph from '$lib/components/PlatformGlyph.svelte';
  import { renderBrandContentHtml, tokenizeChips, type ChipToken } from '$lib/canvas/brand-content-chips';
  import { SOCIAL_PLATFORMS } from '$lib/canvas/social-platforms';
  import { ANALYSIS_STEPS, ANALYSIS_STEP_INTERVAL_MS, analysisStepIndexAt } from '$lib/brand-wizard-analysis-steps';
  import { WIZARD_STEPS as STEPS, restoreWizardState, type WizardStep as Step } from '$lib/brand-wizard-steps';
  import '$lib/styles/doc-prose.css';

  let { data, form } = $props();

  const STEP_LABEL: Record<Step, string> = {
    website: 'Website',
    analysis: 'Analysis',
    products: 'Products',
    target: 'Target',
    handles: 'Social handles',
    overview: 'Overview'
  };

  type Handle = { platform: string; handle: string };
  type Product = {
    externalId: string;
    handle: string | null;
    title: string;
    description: string | null;
    price: number | null;
    currency: string | null;
    url: string | null;
    images: Array<{ url: string; position?: number }>;
    available: boolean | null;
    included: boolean;
  };

  type Draft = {
    website: string;
    name: string;
    shortDescription: string;
    logoUrl: string;
    products: Product[];
    productsPlatform: string;
    target: string;
    colours: string[];
    brandHandles: Handle[];
    content: string;
    images: string[];
  };

  function emptyDraft(): Draft {
    return {
      website: '',
      name: '',
      shortDescription: '',
      logoUrl: '',
      products: [],
      productsPlatform: '',
      target: '',
      colours: [],
      brandHandles: [],
      content: '',
      images: []
    };
  }

  const STORAGE_KEY = $derived(`feega:brand-wizard:${data.project.id}`);

  let step = $state<Step>('website');
  let draft = $state<Draft>(emptyDraft());
  let busy = $state(false);
  let error = $state<string | null>(null);

  let analysisStepIndex = $state(0);
  let analysisTimer: ReturnType<typeof setInterval> | null = null;

  function startAnalysisCycle() {
    analysisStepIndex = 0;
    const startedAt = Date.now();
    analysisTimer = setInterval(() => {
      analysisStepIndex = analysisStepIndexAt(Date.now() - startedAt, ANALYSIS_STEPS.length);
    }, 250);
  }

  function stopAnalysisCycle() {
    if (analysisTimer) clearInterval(analysisTimer);
    analysisTimer = null;
  }

  onDestroy(stopAnalysisCycle);

  let editingField = $state<'name' | 'shortDescription' | 'target' | null>(null);

  onMount(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const restored = restoreWizardState(JSON.parse(saved), emptyDraft());
        step = restored.step;
        draft = restored.draft;
      }
    } catch {
      // una sessionStorage rotta non deve impedire di aprire il wizard da zero
    }
  });

  $effect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ step, draft }));
    } catch {
      // niente spazio, niente persistenza — il wizard resta comunque usabile in questa sessione
    }
  });

  const stepIndex = $derived(STEPS.indexOf(step));

  function goStep(next: Step) {
    step = next;
    error = null;
  }

  function back() {
    if (stepIndex > 0) goStep(STEPS[stepIndex - 1]);
  }

  function forward() {
    if (stepIndex < STEPS.length - 1) goStep(STEPS[stepIndex + 1]);
  }

  function withBusy(onDone?: (result: unknown) => void) {
    return () => {
      busy = true;
      error = null;
      startAnalysisCycle();
      return async ({ result, update }: { result: { type: string; data?: unknown }; update: () => Promise<void> }) => {
        busy = false;
        stopAnalysisCycle();
        if (result.type === 'failure') {
          const data = result.data as { error?: string } | undefined;
          error = data?.error === 'credits_exhausted' ? 'Out of AI credits for this billing period.' : (data?.error ?? 'Something went wrong.');
          return;
        }
        await update();
        onDone?.(result.data);
      };
    };
  }

  function applyAnalysis(result: unknown) {
    const r = result as {
      name?: string;
      shortDescription?: string;
      logoUrl?: string | null;
      suggestedContent?: string;
      products?: Product[];
      images?: string[];
      website?: string;
    };

    draft.name = r.name ?? draft.name;
    draft.shortDescription = r.shortDescription ?? draft.shortDescription;
    draft.logoUrl = r.logoUrl ?? draft.logoUrl;
    draft.content = r.suggestedContent ?? draft.content;
    draft.products = r.products ?? [];
    draft.images = r.images ?? [];
    draft.website = r.website ?? draft.website;

    const targetMatch = /## Target\n\n([\s\S]*?)(\n\n##|$)/.exec(draft.content);
    if (targetMatch) draft.target = targetMatch[1].trim();

    const coloursMatch = /## Colours\n\n([\s\S]*?)(\n\n##|$)/.exec(draft.content);
    if (coloursMatch) {
      draft.colours = coloursMatch[1]
        .split('\n')
        .flatMap((l) => tokenizeChips(l).filter((t): t is Extract<ChipToken, { kind: 'colour' }> => t.kind === 'colour'))
        .map((t) => t.hex);
    }

    const handlesMatch = /## Social handles\n\n([\s\S]*?)(\n\n##|$)/.exec(draft.content);
    if (handlesMatch) {
      draft.brandHandles = handlesMatch[1]
        .split('\n')
        .map((l) => /^- (\w+):@(.+)$/.exec(l.trim()))
        .filter((m): m is RegExpExecArray => Boolean(m))
        .map((m) => ({ platform: m[1], handle: m[2] }));
    }

    goStep('analysis');
  }

  function applySync(result: unknown) {
    const r = result as { platform?: string | null; products?: Product[] };
    if (r.platform) draft.productsPlatform = r.platform;
    if (r.products) draft.products = r.products;
  }

  function addHandle(list: Handle[]): Handle[] {
    return [...list, { platform: 'instagram', handle: '' }];
  }

  function removeHandle(list: Handle[], i: number): Handle[] {
    return list.filter((_, idx) => idx !== i);
  }

  function recompose() {
    const parts: string[] = [];
    if (draft.target.trim()) parts.push(`## Target\n\n${draft.target.trim()}`);
    if (draft.colours.length) parts.push(`## Colours\n\n${draft.colours.map((c) => `- ${c}`).join('\n')}`);
    const brandLines = draft.brandHandles.filter((h) => h.handle.trim()).map((h) => `- ${h.platform}:@${h.handle.trim().replace(/^@/, '')}`);
    if (brandLines.length) parts.push(`## Social handles\n\n${brandLines.join('\n')}`);
    draft.content = parts.join('\n\n');
  }

  $effect(() => {
    if (step === 'overview') recompose();
  });

  function afterCreate() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // niente da pulire se sessionStorage non è disponibile
    }
  }

  const renderedContent = $derived(renderBrandContentHtml(draft.content));
</script>

<PageHead title="New brand" subtitle={`Step ${stepIndex + 1} of ${STEPS.length} — ${STEP_LABEL[step]}`} />

<div class="wizard-shell">
  <div class="wizard">
    <div class="step-bar">
      <p class="step-caption">Step {stepIndex + 1} of {STEPS.length} · {STEP_LABEL[step]}</p>
      <ol class="steps">
        {#each STEPS as s, i (s)}
          <li class:active={s === step} class:done={i < stepIndex}></li>
        {/each}
      </ol>
    </div>

    {#if error}
      <p class="msg warn">{error}</p>
    {/if}

    {#if step === 'website'}
    <section class="wizard-panel">
      {#if busy}
        <h2>Reading {draft.website}</h2>
        <p class="hint">This takes a moment — we're actually visiting the site.</p>
        <div class="progress-track" role="progressbar" aria-label="Analyzing site"><div class="progress-fill"></div></div>
        <ol class="analysis-steps">
          {#each ANALYSIS_STEPS as s, i (s.label)}
            <li class:done={i < analysisStepIndex} class:active={i === analysisStepIndex}>
              <span class="analysis-step-mark">{i < analysisStepIndex ? '✓' : ''}</span>
              <span>{s.label}</span>
            </li>
          {/each}
        </ol>
      {:else}
        <h2>Where can we find this brand?</h2>
        <p class="hint">We'll read the site for a logo, colours, description and detected products. You can skip this and fill everything by hand.</p>
      {/if}

      <form
        method="POST"
        action="?/analyze"
        use:enhance={withBusy((result) => applyAnalysis(result))}
      >
        {#if !busy}
          <input name="url" type="text" inputmode="url" autocapitalize="off" spellcheck="false" placeholder="example.com" bind:value={draft.website} />
        {/if}
        <div class="row">
          <button class="btn ghost" type="button" onclick={forward} disabled={busy}>Skip, no website</button>
          <button class="btn primary" type="submit" disabled={busy || !draft.website}>{busy ? 'Reading…' : 'Analyze'}</button>
        </div>
      </form>
    </section>
  {/if}

  {#if step === 'analysis'}
    <section class="wizard-panel">
      <h2>What we found</h2>
      <div class="found">
        {#if draft.logoUrl}<img class="logo" src={draft.logoUrl} alt="" />{/if}

        {#if editingField === 'name'}
          <label class="wizard-field">
            <span>Name</span>
            <input type="text" bind:value={draft.name} onblur={() => (editingField = null)} />
          </label>
        {:else}
          <div class="found-item">
            <h3 class="found-name">{draft.name || 'Untitled brand'}</h3>
            <button class="btn ghost small" type="button" onclick={() => (editingField = 'name')}>Edit</button>
          </div>
        {/if}

        {#if editingField === 'shortDescription'}
          <label class="wizard-field">
            <span>Short description</span>
            <input type="text" bind:value={draft.shortDescription} onblur={() => (editingField = null)} />
          </label>
        {:else}
          <div class="found-item">
            <p class="found-description">{draft.shortDescription || 'No description found.'}</p>
            <button class="btn ghost small" type="button" onclick={() => (editingField = 'shortDescription')}>Edit</button>
          </div>
        {/if}

        {#if draft.colours.length}
          <div class="swatches">
            {#each draft.colours as c (c)}
              <span class="swatch" style={`background:${c}`} title={c}></span>
            {/each}
          </div>
        {/if}

        {#if draft.images.length}
          <div class="image-grid">
            {#each draft.images as img (img)}
              <img class="image-grid-item" src={img} alt="" loading="lazy" />
            {/each}
          </div>
        {/if}

        <p class="hint">{draft.products.length} product{draft.products.length === 1 ? '' : 's'} detected.</p>
      </div>
      <div class="row">
        <button class="btn ghost" type="button" onclick={back}>Back</button>
        <button class="btn primary" type="button" onclick={forward}>Continue</button>
      </div>
    </section>
  {/if}

  {#if step === 'products'}
    <section class="wizard-panel">
      <h2>Products</h2>
      {#if !draft.products.length}
        <p class="hint">No products detected. This step is optional.</p>
      {:else}
        <ul class="products">
          {#each draft.products as p (p.externalId)}
            <li>
              <label>
                <input type="checkbox" bind:checked={p.included} />
                <span class="title">{p.title}</span>
              </label>
              {#if p.description}<p class="desc">{p.description}</p>{/if}
            </li>
          {/each}
        </ul>
      {/if}
      <div class="row">
        <button class="btn ghost" type="button" onclick={back}>Back</button>
        <button class="btn primary" type="button" onclick={forward}>Continue</button>
      </div>
    </section>
  {/if}

  {#if step === 'target'}
    <section class="wizard-panel">
      <h2>Who is this brand for?</h2>
      <p class="hint">A free-text description of the audience. We drafted one from the site — edit it freely.</p>
      <textarea rows="5" bind:value={draft.target} placeholder="e.g. Small coffee shops in Northern Italy, owner-operators, 25-45"></textarea>

      <div class="wizard-field">
        <span>Colours</span>
        <div class="colour-list">
          {#each draft.colours as c, i (i)}
            <div class="colour-row">
              <label class="colour-swatch-label" style={`background:${c}`}>
                <input
                  type="color"
                  class="colour-swatch-input"
                  value={/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#000000'}
                  oninput={(e) => (draft.colours[i] = (e.currentTarget as HTMLInputElement).value)}
                />
              </label>
              <input type="text" bind:value={draft.colours[i]} placeholder="#rrggbb" />
              <button class="btn ghost small" type="button" onclick={() => (draft.colours = draft.colours.filter((_, idx) => idx !== i))}>Remove</button>
            </div>
          {/each}
        </div>
        <button class="btn ghost" type="button" onclick={() => (draft.colours = [...draft.colours, '#000000'])}>+ Add colour</button>
      </div>

      <div class="row">
        <button class="btn ghost" type="button" onclick={back}>Back</button>
        <button class="btn primary" type="button" onclick={forward}>Continue</button>
      </div>
    </section>
  {/if}

  {#if step === 'handles'}
    <section class="wizard-panel">
      <h2>This brand's social handles</h2>
      <p class="hint">Recorded only — connecting accounts to publish happens later, from Settings → Connected accounts.</p>
      {#each draft.brandHandles as h, i (i)}
        <div class="handle-row">
          <select bind:value={h.platform}>
            {#each SOCIAL_PLATFORMS as p (p)}
              <option value={p}>{p}</option>
            {/each}
          </select>
          <PlatformGlyph platform={h.platform} />
          <input type="text" placeholder="handle" bind:value={h.handle} />
          <button class="btn ghost small" type="button" onclick={() => (draft.brandHandles = removeHandle(draft.brandHandles, i))}>Remove</button>
        </div>
      {/each}
      <button class="btn ghost" type="button" onclick={() => (draft.brandHandles = addHandle(draft.brandHandles))}>+ Add handle</button>
      <div class="row">
        <button class="btn ghost" type="button" onclick={back}>Back</button>
        <button class="btn primary" type="button" onclick={forward}>Continue</button>
      </div>
    </section>
  {/if}

  {#if step === 'overview'}
    <section class="wizard-panel">
      <h2>Review before creating</h2>

      <label class="wizard-field">
        <span>Name</span>
        <input type="text" bind:value={draft.name} required />
      </label>

      <label class="wizard-field">
        <span>Content</span>
        <textarea rows="10" bind:value={draft.content} oninput={() => {}}></textarea>
      </label>

      <div class="doc-prose preview">
        {@html renderedContent}
      </div>

      <form
        method="POST"
        action="?/create"
        use:enhance={() => {
          busy = true;
          error = null;
          return async ({ result }) => {
            busy = false;
            if (result.type === 'failure') {
              const data = result.data as { error?: string } | undefined;
              error = data?.error ?? 'Could not create the brand';
              return;
            }
            afterCreate();
            if (result.type === 'redirect') {
              await goto(result.location);
            }
          };
        }}
      >
        <input type="hidden" name="returnTo" value={page.url.searchParams.get('returnTo') ?? ''} />
        <input type="hidden" name="name" value={draft.name} />
        <input type="hidden" name="website" value={draft.website} />
        <input type="hidden" name="shortDescription" value={draft.shortDescription} />
        <input type="hidden" name="content" value={draft.content} />
        <input type="hidden" name="logoUrl" value={draft.logoUrl} />
        <input type="hidden" name="productsPlatform" value={draft.productsPlatform} />
        <input type="hidden" name="products" value={JSON.stringify(draft.products)} />

        <div class="row">
          <button class="btn ghost" type="button" onclick={back}>Back</button>
          <button class="btn primary" type="submit" disabled={busy || !draft.name.trim()}>{busy ? 'Creating…' : 'Approve'}</button>
        </div>
      </form>
    </section>
  {/if}
  </div>
</div>

<style>
  .wizard-shell {
    min-height: 100dvh;
    display: flex;
    justify-content: center;
    padding: 56px 24px 80px;
    background: var(--paper-2);
  }

  .wizard {
    width: 100%;
    max-width: 560px;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .step-bar { display: flex; flex-direction: column; gap: 10px; }
  .step-caption {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-soft);
  }

  .steps {
    display: flex;
    gap: 4px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .steps li {
    flex: 1 1 0;
    height: 3px;
    background: var(--line);
  }
  .steps li.done { background: var(--ink-soft); }
  .steps li.active { background: var(--accent); }

  .wizard-panel {
    display: flex;
    flex-direction: column;
    gap: 20px;
    background: var(--paper);
    border: 1px solid var(--line);
    padding: 40px;
  }
  .wizard-panel h2 {
    margin: 0;
    font-size: clamp(1.3rem, 2.4vw, 1.6rem);
    font-weight: var(--heading-weight);
    letter-spacing: var(--heading-tracking);
  }
  .hint { margin: 0; font-size: 13.5px; color: var(--ink-soft); line-height: 1.5; }

  .wizard-field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
  .wizard-field span { color: var(--ink-soft); font-weight: 500; }

  input[type='text'],
  input[type='url'],
  textarea,
  select {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--line-2);
    background: var(--paper);
    padding: 12px 14px;
    font: inherit;
    font-size: 15px;
    color: var(--ink);
    outline: none;
  }
  input[type='text']:focus,
  input[type='url']:focus,
  textarea:focus,
  select:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 4px rgba(var(--accent-rgb), 0.12);
  }
  textarea { resize: vertical; }

  .row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding-top: 4px;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--line-2);
    background: var(--paper);
    color: var(--ink);
    padding: 12px 22px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn.primary { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  .btn.ghost { background: transparent; }
  .btn.small { padding: 6px 10px; font-size: 12px; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .msg.warn {
    font-size: 13px;
    color: #c0392b;
    background: rgba(192, 57, 43, 0.06);
    border: 1px solid rgba(192, 57, 43, 0.35);
    padding: 12px 16px;
    margin: 0;
  }

  .progress-track {
    width: 100%;
    height: 3px;
    background: var(--line);
    overflow: hidden;
    position: relative;
  }
  .progress-fill {
    position: absolute;
    inset: 0;
    width: 40%;
    background: var(--accent);
    animation: progress-sweep 1.4s ease-in-out infinite;
  }
  @keyframes progress-sweep {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(250%); }
  }

  .analysis-steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .analysis-steps li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: var(--ink-soft);
  }
  .analysis-steps li.done { color: var(--ink); }
  .analysis-steps li.active {
    color: var(--ink);
    font-weight: 600;
    animation: analysis-step-pulse 1.6s ease-in-out infinite;
  }
  .analysis-step-mark {
    width: 18px;
    height: 18px;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--line-2);
    font-size: 11px;
  }
  .analysis-steps li.done .analysis-step-mark { border-color: var(--ink); background: var(--ink); color: var(--paper); }
  .analysis-steps li.active .analysis-step-mark { border-color: var(--accent); }

  @keyframes analysis-step-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-fill { animation: none; }
    .analysis-steps li.active { animation: none; }
  }

  .found-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .found-name {
    margin: 0;
    font-size: clamp(1.2rem, 2.2vw, 1.5rem);
    font-weight: var(--heading-weight);
    letter-spacing: var(--heading-tracking);
  }
  .found-description {
    margin: 0;
    font-size: 14.5px;
    line-height: 1.6;
    color: var(--ink);
  }

  .image-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    gap: 6px;
  }
  .image-grid-item {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border: 1px solid var(--line);
  }

  .found { display: flex; flex-direction: column; gap: 14px; }
  .logo { width: 64px; height: 64px; object-fit: cover; border: 1px solid var(--line); }
  .swatches { display: flex; gap: 8px; }
  .swatch { width: 28px; height: 28px; border: 1px solid var(--line); }

  .products { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .products li { border-bottom: 1px solid var(--line); padding-bottom: 12px; }
  .products label { display: flex; align-items: center; gap: 10px; font-size: 14px; }
  .products .desc { margin: 6px 0 0 26px; font-size: 12.5px; color: var(--ink-soft); }

  .handle-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .handle-row select { flex: 0 0 auto; width: auto; }
  .handle-row input { flex: 1 1 160px; min-width: 0; }
  .handle-row .btn.small { flex: 0 0 auto; margin-left: auto; }

  .colour-list { display: flex; flex-direction: column; gap: 8px; }
  .colour-row { display: flex; align-items: center; gap: 8px; }
  .colour-row input[type='text'] { flex: 1 1 auto; min-width: 0; }
  .colour-row .btn.small { flex: 0 0 auto; }

  .colour-swatch-label {
    position: relative;
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    border: 1px solid var(--line);
    cursor: pointer;
    overflow: hidden;
  }
  .colour-swatch-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    opacity: 0;
    cursor: pointer;
  }

  .preview { border: 1px solid var(--line); padding: 16px; background: var(--paper-2); }

  :global([data-viewport='mobile']) .wizard-shell { min-height: 100%; padding: 20px var(--page-gutter) 32px; }
  :global([data-viewport='mobile']) .wizard-panel { padding: 20px 16px; }
  :global([data-viewport='mobile']) .row { flex-direction: column-reverse; }
  :global([data-viewport='mobile']) .row .btn { width: 100%; min-height: var(--touch-target); }
  :global([data-viewport='mobile']) .handle-row select { flex: 1 1 auto; }
  :global([data-viewport='mobile']) .handle-row input { flex: 1 1 100%; order: 1; }
  :global([data-viewport='mobile']) .handle-row .btn.small { flex: 1 1 auto; margin-left: 0; order: 2; }
</style>
