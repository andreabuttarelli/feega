<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { enhance } from '$app/forms';
  import CountryPicker from '$lib/components/CountryPicker.svelte';
  import { parseCountries } from '$lib/countries';
  import { postCompositionFor } from '$lib/canvas/post-composition';
  import { paidGateFor } from '$lib/canvas/promote-sheet';
  import { openSheet } from '$lib/canvas/sheet-nav';
  import {
    CALLS_TO_ACTION,
    GENDERS,
    META_MAX_AGE,
    META_MIN_AGE,
    OBJECTIVES,
    PLACEMENTS,
    draftProblems,
    launchFee,
    type CallToAction,
    type Gender,
    type Objective,
    type PaidAdDraft,
    type PlacementId
  } from '$lib/ads/paid-ad';
  import { PAID_AD_FIELDS as F } from '$lib/ads/paid-ad-form';
  import { creditsForSpend } from '$lib/ads-fee';

  type PromoteNode = { id: string; type: string; data: Record<string, unknown>; text: string | null; mediaUrl: string | null };
  type Brand = { id: string; name: string };
  type AdAccount = { id: string; name: string | null; currency: string };
  type BoostablePost = { id: string; caption: string };

  let {
    projectId,
    data
  }: {
    projectId: string;
    data: {
      nodes: PromoteNode[];
      brands: Brand[];
      adAccountsByBrand: Record<string, AdAccount[]>;
      boostableByBrand: Record<string, BoostablePost[]>;
      projectBrandId: string | null;
    };
  } = $props();

  const DEFAULT_DAYS = 7;
  const DEFAULT_DAILY_BUDGET = 10;
  const DEFAULT_COUNTRY = 'IT';

  const composition = $derived(postCompositionFor(data.nodes));
  const mediaNodes = $derived(
    composition.media
      .map((m) => data.nodes.find((n) => n.id === m.nodeId))
      .filter((n): n is PromoteNode => !!n && !!n.mediaUrl)
  );

  let brandId = $state(data.projectBrandId ?? data.brands[0]?.id ?? '');
  const adAccounts = $derived(data.adAccountsByBrand[brandId] ?? []);
  const boostable = $derived(data.boostableByBrand[brandId] ?? []);
  let adAccountId = $state('');
  $effect(() => {
    if (!adAccounts.some((a) => a.id === adAccountId)) {
      adAccountId = adAccounts[0]?.id ?? '';
    }
  });

  let source = $state<'selection' | 'post'>('selection');
  let postId = $state('');
  let objective = $state<Objective>('traffic');
  let budgetType = $state<'daily' | 'lifetime'>('daily');
  let budgetAmount = $state(DEFAULT_DAILY_BUDGET);
  let days = $state(DEFAULT_DAYS);
  let countries = $state(DEFAULT_COUNTRY);
  let ageMin = $state(META_MIN_AGE);
  let ageMax = $state(META_MAX_AGE);
  let gender = $state<Gender>('all');
  let placements = $state<PlacementId[]>(['facebook_feed', 'instagram_feed']);
  let primaryText = $state(composition.captions[0]?.text ?? '');
  let headline = $state('');
  let callToAction = $state<CallToAction>('LEARN_MORE');
  let linkUrl = $state('');

  const selectedMedia = $derived(source === 'selection' ? mediaNodes : []);
  const draft = $derived<PaidAdDraft>({
    brandId,
    adAccountId,
    objective,
    budgetType,
    budgetAmount: Number(budgetAmount),
    days: Number(days),
    countries: parseCountries(countries),
    ageMin: Number(ageMin),
    ageMax: Number(ageMax),
    gender,
    placements,
    primaryText,
    headline,
    callToAction,
    linkUrl,
    mediaNodeIds: selectedMedia.map((n) => n.id),
    postId: source === 'post' && postId ? postId : null
  });
  const problems = $derived(draftProblems(draft));
  const fee = $derived(launchFee(draft));
  const currency = $derived(adAccounts.find((a) => a.id === adAccountId)?.currency ?? '');
  const gate = $derived(
    paidGateFor({ hasBrand: !!brandId, hasAdAccount: adAccounts.length > 0, hasMedia: mediaNodes.length > 0 || boostable.length > 0 })
  );
  const brandName = $derived(data.brands.find((b) => b.id === brandId)?.name ?? '');
  const preview = $derived(selectedMedia[0] ?? null);
  const ctaLabel = $derived(CALLS_TO_ACTION.find((c) => c.id === callToAction)?.label ?? '');

  $effect(() => {
    if (mediaNodes.length === 0 && boostable.length > 0) {
      source = 'post';
    }
  });

  function togglePlacement(id: PlacementId) {
    placements = placements.includes(id) ? placements.filter((p) => p !== id) : [...placements, id];
  }

  let submitting = $state(false);
  let proposedId = $state<string | null>(null);
  let serverError = $state<string | null>(null);

  function money(n: number): string {
    return `${n.toFixed(2)} ${currency}`.trim();
  }
</script>

{#if gate === 'no_brand'}
  <section class="gate">
    <h2>Pick a brand first</h2>
    <p>Ads run on a brand's Facebook and Instagram. Create one, then come back.</p>
    <Button href={`/p/${projectId}/brands/new`}>Create a brand</Button>
  </section>
{:else if gate === 'no_ad_account'}
  <section class="gate" data-testid="connect-meta-cta">
    <h2>Connect a Meta ad account</h2>
    <p>{brandName} has no Meta ad account yet. Connect one to run ads on Facebook and Instagram.</p>
    <Button href={`/p/${projectId}/ads/connect`} data-sveltekit-reload>Connect Meta ads</Button>
  </section>
{:else if gate === 'no_media'}
  <section class="gate">
    <h2>Select what to promote</h2>
    <p>Select an image or a video on the canvas, then press Promote again.</p>
  </section>
{:else if proposedId}
  <section class="gate" data-testid="ad-proposed">
    <h2>Ad proposed</h2>
    <p>Nothing is spent yet. Review it in Ads and approve it to launch.</p>
    <Button onclick={() => openSheet(projectId, '/ads', 'replace')}>Open Ads</Button>
  </section>
{:else}
  <form
    method="POST"
    action={`/p/${projectId}/promote?/propose_ad`}
    class="paid"
    use:enhance={() => {
      submitting = true;
      serverError = null;
      return async ({ result }) => {
        submitting = false;
        if (result.type === 'success' && result.data?.campaign) {
          proposedId = String((result.data.campaign as { id: string }).id);
          return;
        }
        serverError = result.type === 'failure' ? String(result.data?.error ?? 'error') : 'Something went wrong. Try again.';
      };
    }}
  >
    <input type="hidden" name={F.brandId} value={brandId} />
    <input type="hidden" name={F.postId} value={draft.postId ?? ''} />
    {#each draft.mediaNodeIds as id (id)}<input type="hidden" name={F.mediaNodeId} value={id} />{/each}
    {#each draft.countries as code (code)}<input type="hidden" name={F.country} value={code} />{/each}
    {#each placements as id (id)}<input type="hidden" name={F.placement} value={id} />{/each}

    <div class="grid">
      <div class="fields">
        <section>
          <h2>Account</h2>
          {#if data.brands.length > 1}
            <label>Brand
              <select bind:value={brandId}>
                {#each data.brands as brand (brand.id)}<option value={brand.id}>{brand.name}</option>{/each}
              </select>
            </label>
          {/if}
          <label>Meta ad account
            <select name={F.adAccountId} bind:value={adAccountId}>
              {#each adAccounts as account (account.id)}<option value={account.id}>{account.name ?? account.id} · {account.currency}</option>{/each}
            </select>
          </label>
        </section>

        {#if boostable.length}
          <section>
            <h2>Creative</h2>
            <div class="seg">
              <button type="button" class:on={source === 'selection'} disabled={!mediaNodes.length} onclick={() => (source = 'selection')}>From selection</button>
              <button type="button" class:on={source === 'post'} onclick={() => (source = 'post')}>Boost a published post</button>
            </div>
            {#if source === 'post'}
              <select bind:value={postId}>
                <option value="">Choose a post…</option>
                {#each boostable as post (post.id)}<option value={post.id}>{post.caption.slice(0, 60) || post.id}</option>{/each}
              </select>
            {/if}
          </section>
        {/if}

        <section>
          <h2>Objective</h2>
          <div class="options">
            {#each OBJECTIVES as o (o.id)}
              <label class="option" class:on={objective === o.id}>
                <input type="radio" name={F.objective} value={o.id} bind:group={objective} />
                <span><b>{o.label}</b><small>{o.hint}</small></span>
              </label>
            {/each}
          </div>
        </section>

        <section>
          <h2>Budget</h2>
          <div class="row">
            <select name={F.budgetType} bind:value={budgetType}>
              <option value="daily">Daily</option>
              <option value="lifetime">Total</option>
            </select>
            <input name={F.budgetAmount} type="number" min="1" step="1" bind:value={budgetAmount} aria-label="Budget" />
            <label class="inline"><input name={F.days} type="number" min="1" step="1" bind:value={days} aria-label="Days" /> days</label>
          </div>
        </section>

        <section>
          <h2>Audience</h2>
          <CountryPicker name="country_picker" bind:value={countries} placeholder="Countries" />
          <div class="row">
            <label class="inline">Age <input name={F.ageMin} type="number" min={META_MIN_AGE} max={META_MAX_AGE} bind:value={ageMin} /></label>
            <label class="inline">to <input name={F.ageMax} type="number" min={META_MIN_AGE} max={META_MAX_AGE} bind:value={ageMax} /></label>
            <select name={F.gender} bind:value={gender} aria-label="Gender">
              {#each GENDERS as g (g.id)}<option value={g.id}>{g.label}</option>{/each}
            </select>
          </div>
        </section>

        <section>
          <h2>Placements</h2>
          <div class="chips">
            {#each PLACEMENTS as p (p.id)}
              <button type="button" class="chip" class:on={placements.includes(p.id)} onclick={() => togglePlacement(p.id)}>{p.label}</button>
            {/each}
          </div>
        </section>

        <section>
          <h2>Copy</h2>
          <label>Primary text<textarea name={F.primaryText} rows="3" bind:value={primaryText}></textarea></label>
          <label>Headline<input name={F.headline} bind:value={headline} maxlength="255" /></label>
          <div class="row">
            <select name={F.callToAction} bind:value={callToAction} aria-label="Call to action">
              {#each CALLS_TO_ACTION as c (c.id)}<option value={c.id}>{c.label}</option>{/each}
            </select>
            <input name={F.linkUrl} bind:value={linkUrl} placeholder="https://yoursite.com" aria-label="Link" />
          </div>
        </section>
      </div>

      <aside class="side">
        <div class="mock" aria-label="Ad preview">
          <div class="mock-head"><b>{brandName}</b><small>Sponsored</small></div>
          {#if primaryText}<p class="mock-text">{primaryText}</p>{/if}
          <div class="mock-media">
            {#if preview?.type === 'video'}
              <video src={preview.mediaUrl} muted></video>
            {:else if preview}
              <img src={preview.mediaUrl} alt="" />
            {:else}
              <span>Published post</span>
            {/if}
          </div>
          <div class="mock-foot"><b>{headline || 'Headline'}</b><span class="mock-cta">{ctaLabel}</span></div>
        </div>

        <dl class="cost">
          <dt>Ad spend ({budgetType === 'daily' ? `${days} days` : 'total'})</dt><dd>{money(fee.platformBudget)}</dd>
          <dt>Management fee ({Math.round(fee.feeRate * 100)}%)</dt><dd>{money(fee.fee)}</dd>
          <dt>Total</dt><dd><b>{money(fee.total)}</b></dd>
          <dt>Credits at launch</dt><dd>{creditsForSpend(budgetType === 'daily' ? Number(budgetAmount) : fee.platformBudget)}</dd>
        </dl>
        <p class="note">Spend is billed by Meta to your ad account. Nothing runs until you approve it in Ads.</p>

        {#if serverError}<p class="err" role="alert">{serverError}</p>{/if}
        {#if problems.length}<p class="reason">{problems[0].reason}</p>{/if}
        <Button type="submit" class="w-full" disabled={problems.length > 0 || submitting}>
          {submitting ? 'Proposing…' : 'Propose ad'}
        </Button>
      </aside>
    </div>
  </form>
{/if}

<style>
  .gate { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 28px 0; max-width: 460px; }
  .gate h2 { margin: 0; font-size: 1.05rem; font-weight: 650; }
  .gate p { margin: 0; font-size: 14px; line-height: 1.5; color: var(--ink-soft); }
  .grid { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 24px; }
  .fields section { margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; }
  .fields h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft, #6e6e73); margin: 0; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
  label.inline { flex-direction: row; align-items: center; gap: 6px; }
  input, select, textarea { border: 1px solid var(--line, #e5e5e5); padding: 7px 8px; font: inherit; font-size: 13px; background: var(--paper, #fff); color: inherit; min-width: 0; }
  input[type='number'] { width: 76px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .row > input:not([type='number']) { flex: 1; }
  .options { display: flex; flex-direction: column; gap: 6px; }
  .option { flex-direction: row; align-items: flex-start; gap: 8px; border: 1px solid var(--line, #e5e5e5); padding: 8px 10px; cursor: pointer; }
  .option.on { border-color: var(--ink, #1d1d1f); }
  .option span { display: flex; flex-direction: column; }
  .option small { color: var(--ink-faint, #9a9a9e); }
  .chips, .seg { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip, .seg button { border: 1px solid var(--line, #e5e5e5); background: transparent; padding: 6px 10px; font: inherit; font-size: 12.5px; cursor: pointer; color: inherit; }
  .chip.on, .seg button.on { background: var(--ink, #1d1d1f); color: var(--paper, #fff); border-color: var(--ink, #1d1d1f); }
  .seg button:disabled { opacity: 0.45; cursor: default; }
  .side { display: flex; flex-direction: column; gap: 12px; }
  .mock { border: 1px solid var(--line, #e5e5e5); font-size: 12.5px; background: var(--paper, #fff); }
  .mock-head { display: flex; flex-direction: column; padding: 8px 10px; }
  .mock-head small, .note, .reason { color: var(--ink-faint, #9a9a9e); }
  .mock-text { margin: 0; padding: 0 10px 8px; white-space: pre-wrap; }
  .mock-media { aspect-ratio: 1; background: var(--paper-2, #f5f5f7); display: flex; align-items: center; justify-content: center; }
  .mock-media img, .mock-media video { width: 100%; height: 100%; object-fit: cover; }
  .mock-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 10px; border-top: 1px solid var(--line, #e5e5e5); }
  .mock-cta { border: 1px solid var(--line, #e5e5e5); padding: 4px 8px; white-space: nowrap; }
  .cost { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; margin: 0; font-size: 12.5px; }
  .cost dd { margin: 0; text-align: right; }
  .note, .reason { margin: 0; font-size: 12px; }
  .err { margin: 0; font-size: 12.5px; color: var(--danger, #b3261e); }
  @media (max-width: 720px) {
    .grid { grid-template-columns: 1fr; }
  }
</style>
