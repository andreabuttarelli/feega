<script lang="ts">
  import { runStateOf, type GenNode, type ModelChoice } from '$lib/canvas/gen-node';
  import { shownIndex } from '$lib/canvas/gen-history';
  import { PROMPT_PLACEHOLDER, RUN_LABEL, hasGenBody } from '$lib/canvas/gen-tile-view';
  import { loopCreditsOf, providerQuotesOf, runLabelOf, runQuoteOf } from '$lib/canvas/run-quote';
  import { effectiveModel } from '$lib/canvas/default-models';
  import type { RememberedVariants } from '$lib/canvas/variants';
  import { scrollGuard } from '$lib/canvas/scroll-guard';
  import { filterSkills, insertSkill, slashQueryAt, type PromptSkill, type SlashQuery } from '$lib/canvas/prompt-skills';
  import CreditAmount from '$lib/components/CreditAmount.svelte';
  import { untrack } from 'svelte';
  import OutputDragHandle from './OutputDragHandle.svelte';
  import BookmarkPlus from '@lucide/svelte/icons/bookmark-plus';
  import { EXAMPLE_LABEL, type DemoResult } from '$lib/onboarding/demo';

  let {
    node,
    choices = [],
    catalogueSynced = true,
    enhanceUnitCredits,
    estimatedTextInputTokens,
    estimatedTextOutputTokens,
    estimateRevision = '',
    variableTextInput = false,
    hasUpstreamText = false,
    loopQueued = 0,
    loopVisible = false,
    loopCombinationCount = 0,
    variantsInFlight = 0,
    remembered = null,
    onchange,
    onrun,
    onrunloop,
    oncancelloop,
    onshow,
    onunlock,
    onmeasure,
    onestimate,
    result,
    references,
    example = null,
    skills = [],
    onsaveskill,
    selected = false
  }: {
    node: GenNode;
    choices?: ModelChoice[];
    catalogueSynced?: boolean;
    enhanceUnitCredits?: number;
    estimatedTextInputTokens?: number;
    estimatedTextOutputTokens?: number;
    estimateRevision?: string;
    variableTextInput?: boolean;
    hasUpstreamText?: boolean;
    loopQueued?: number;
    loopVisible?: boolean;
    loopCombinationCount?: number;
    onchange?: (patch: Partial<GenNode>) => void;
    onrun?: () => void;
    onrunloop?: () => void;
    variantsInFlight?: number;
    remembered?: RememberedVariants | null;
    oncancelloop?: () => void;
    onshow?: (runId: string) => void;
    onunlock?: () => void;
    onmeasure?: (contentHeight: number) => void;
    onestimate?: (prompt: string, model: string | null, revision: string) => void;
    result?: import('svelte').Snippet<[{ refId: string; text: string | null }]>;
    references?: import('svelte').Snippet;
    example?: DemoResult | null;
    skills?: PromptSkill[];
    onsaveskill?: (name: string, body: string) => Promise<boolean>;
    selected?: boolean;
  } = $props();

  const COMPACT_MEDIA: ReadonlySet<GenNode['medium']> = new Set(['text', 'image', 'video']);
  const compact = $derived(COMPACT_MEDIA.has(node.medium));

  let slash = $state<SlashQuery | null>(null);
  let picked = $state(0);
  let promptEl = $state<HTMLTextAreaElement | null>(null);
  let naming = $state<string | null>(null);
  const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const matches = $derived(slash ? filterSkills(skills, slash.query) : []);

  function trackSlash(el: HTMLTextAreaElement) {
    slash = slashQueryAt(el.value, el.selectionStart);
    picked = 0;
  }

  function useSkill(skill: PromptSkill) {
    if (!slash || !promptEl) {
      return;
    }
    const out = insertSkill(promptEl.value, slash, skill);
    slash = null;
    onchange?.({ prompt: out.text });
    queueMicrotask(() => {
      promptEl?.focus();
      promptEl?.setSelectionRange(out.caret, out.caret);
    });
  }

  function pickKey(e: KeyboardEvent) {
    if (!slash || matches.length === 0) {
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      picked = (picked + (e.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length;
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      useSkill(matches[picked]);
    } else if (e.key === 'Escape') {
      slash = null;
    }
  }

  async function saveNamed() {
    const name = naming?.trim() ?? '';
    if (!SKILL_NAME.test(name) || !onsaveskill) {
      return;
    }
    if (await onsaveskill(name, node.prompt)) {
      naming = null;
    }
  }

  const resolvedModel = $derived(effectiveModel(node.medium, node.model, choices));
  const quote = $derived(
    runQuoteOf({ node, choices, hasUpstreamText, variableTextInput, enhanceUnitCredits, estimatedTextInputTokens, estimatedTextOutputTokens, remembered })
  );
  const providerQuotes = $derived(
    providerQuotesOf({ node, choices, hasUpstreamText, variableTextInput, enhanceUnitCredits, estimatedTextInputTokens, estimatedTextOutputTokens, remembered })
  );
  const choice = $derived(quote.choice);
  const upstream = $derived({ hasUpstreamText });
  const runState = $derived(runStateOf(node, upstream));
  const tooLong = $derived(quote.tooLong);
  const TEXT_ESTIMATE_DELAY_MS = 400;

  $effect(() => {
    const estimate = untrack(() => onestimate);
    if (node.medium !== 'text' || !estimate) {
      return;
    }

    const prompt = node.prompt;
    const model = resolvedModel;
    const revision = estimateRevision;
    const timer = setTimeout(() => estimate(prompt, model, revision), TEXT_ESTIMATE_DELAY_MS);
    return () => clearTimeout(timer);
  });

  const blocked = $derived(quote.reason);
  const canRun = $derived(quote.enabled);
  const shown = $derived(shownIndex(node));

  const runCredits = $derived(quote.credits);
  const loopCredits = $derived(loopCreditsOf(quote, loopCombinationCount, variableTextInput));

  const shownExample = $derived(node.refId ? null : example);
  const hasBody = $derived(hasGenBody(node.medium, runState, node.refId, !!shownExample));


  function measureHeight(el: HTMLElement) {
    if (node.medium !== 'text' || !onmeasure) return {};

    let bodyHeight = 0;
    let promptHeight = 0;
    const report = () => onmeasure?.(bodyHeight + promptHeight);

    const body = el.querySelector<HTMLElement>('.gen-text') ?? el.querySelector<HTMLElement>('.gen-body > *');
    const prompt = el.querySelector<HTMLTextAreaElement>('.gen-prompt');

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.target.scrollHeight;
        if (entry.target === body) bodyHeight = height;
        if (entry.target === prompt) promptHeight = height;
      }
      report();
    });
    if (body) ro.observe(body);
    if (prompt) ro.observe(prompt);

    bodyHeight = body?.scrollHeight ?? 0;
    promptHeight = prompt?.scrollHeight ?? 0;
    report();

    return { destroy: () => ro.disconnect() };
  }
</script>

{#snippet prompt()}
  <textarea
    class="gen-prompt nodrag"
    class:is-full={!hasBody}
    rows={compact && hasBody ? 1 : 2}
    placeholder={PROMPT_PLACEHOLDER[node.medium]}
    value={node.prompt}
    bind:this={promptEl}
    oninput={(e) => {
      onchange?.({ prompt: e.currentTarget.value });
      trackSlash(e.currentTarget);
    }}
    onkeydown={pickKey}
    onblur={() => setTimeout(() => (slash = null), 150)}
    use:scrollGuard
  ></textarea>
{/snippet}

{#snippet refs()}
  {#if references && node.medium !== 'text'}
    {#if choice?.uncensored}
      <p class="gen-uncensored-note nodrag">Uncensored models don't accept references</p>
    {:else}
      {@render references()}
    {/if}
  {/if}
{/snippet}

<div class="gen" class:is-compact={compact} class:is-done={runState === 'done'} class:is-selected={selected} class:is-running={runState === 'running' || loopQueued > 0} use:measureHeight>
  {#if hasBody}
    <div class="gen-body">
      {#if runState === 'running'}
        <div class="gen-busy">
          <span class="gen-dots" aria-label={RUN_LABEL.running}><i></i><i></i><i></i></span>
          <button type="button" class="gen-unlock" onclick={() => onunlock?.()}>Sblocca</button>
        </div>
      {:else if runState === 'failed'}
        <div class="gen-fail" role="alert">
          <p class="gen-fail-title">{RUN_LABEL.failed}</p>
          {#if node.error}
            <p class="gen-fail-why">{node.error}</p>
          {/if}
          <button type="button" class="gen-unlock" onclick={() => onrun?.()} disabled={!canRun}>Try again</button>
        </div>
      {:else if node.refId && result}
        {@render result({ refId: node.refId, text: node.runs.find((r) => r.mediaId === node.refId)?.text ?? null })}
        <OutputDragHandle nodeId={node.id} />
      {:else if shownExample}
        <div class="gen-example" data-testid="example-result">
          <span class="gen-example-mark">{EXAMPLE_LABEL}</span>
          {#if shownExample.text}
            <p class="gen-example-text nodrag" use:scrollGuard>{shownExample.text}</p>
          {:else if shownExample.medium === 'video'}
            <video src={shownExample.src} autoplay muted loop playsinline></video>
          {:else}
            <img src={shownExample.src} alt={EXAMPLE_LABEL} />
          {/if}
        </div>
      {:else}
        <p class="gen-hint">{RUN_LABEL[runState]}</p>
      {/if}
    </div>
  {/if}
  {#if node.runs.length > 1}
    <div class="gen-past" role="group" aria-label="Earlier generations">
      {#each node.runs as run, i (run.id)}
        <button
          type="button"
          class="gen-past-one"
          class:is-shown={i === shown}
          title={run.prompt}
          aria-label={`Generation ${i + 1} of ${node.runs.length}`}
          aria-pressed={i === shown}
          onclick={() => onshow?.(run.id)}
        >
          {i + 1}
        </button>
      {/each}
    </div>
  {/if}

  {#if node.routeNote && !node.running}
    <p class="gen-route-note nodrag" data-testid="route-note">{node.routeNote}</p>
  {/if}

  {#if !compact}
    {@render refs()}
  {/if}

  <footer class="gen-foot" class:is-full={!hasBody}>
    {#if tooLong && blocked}
      <span class="gen-warn">{blocked}{#if choice?.maxPromptChars} ({node.prompt.length}/{choice.maxPromptChars}){/if}</span>
    {/if}
    {#if !compact || !hasBody}
      {@render prompt()}
    {/if}

    {#if slash && matches.length > 0}
      <ul class="gen-skills nodrag" role="listbox" data-testid="skill-picker">
        {#each matches as skill, i (skill.id)}
          <li role="option" aria-selected={i === picked}>
            <button type="button" class:is-picked={i === picked} onmousedown={(e) => e.preventDefault()} onclick={() => useSkill(skill)}>
              <b>/{skill.name}</b>
              <span>{skill.body}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    {#if naming !== null}
      <form class="gen-skill-name nodrag" onsubmit={(e) => { e.preventDefault(); void saveNamed(); }}>
        <input placeholder="skill-name" bind:value={naming} data-testid="skill-name" />
        <button type="submit" disabled={!SKILL_NAME.test(naming.trim())}>Save</button>
        <button type="button" onclick={() => (naming = null)}>Cancel</button>
      </form>
    {/if}

    <div class="gen-actions">
      {#if compact}
        {@render refs()}
        {#if hasBody}
          {@render prompt()}
        {/if}
      {/if}
      {#if onsaveskill && node.prompt.trim() && naming === null}
        <button type="button" class="gen-skill-save nodrag" data-testid="skill-save" title="Save this prompt as a skill" aria-label="Save this prompt as a skill" onclick={() => (naming = '')}><BookmarkPlus size={14} strokeWidth={1.75} /></button>
      {/if}
      {#if !compact && blocked && !tooLong}
        <span class="gen-warn is-soft">{blocked}</span>
      {/if}
      {#if variantsInFlight > 0 && oncancelloop}
        <button type="button" class="gen-loop" onclick={() => oncancelloop?.()}>
          Cancel all ({variantsInFlight})
        </button>
      {:else if loopQueued > 0 && oncancelloop}
        <button type="button" class="gen-loop" onclick={() => oncancelloop?.()}>
          Annulla loop ({loopQueued})
        </button>
      {:else if onrunloop && loopVisible}
        <button type="button" class="gen-loop" onclick={() => onrunloop?.()} disabled={!canRun}>
          Loop ×{loopCombinationCount}{#if loopCredits !== null} · <CreditAmount amount={loopCredits} approx />{:else if quote.variable} · variable cost{/if}
        </button>
      {/if}
      <span class="gen-run">
        <button type="button" class="gen-cta" data-testid="gen-run" title={blocked ?? undefined} onclick={() => onrun?.()} disabled={!canRun}>
          {runLabelOf(quote)}{#if runCredits !== null} · <CreditAmount amount={runCredits} approx />{:else if quote.variable} · variable cost{/if}
        </button>
        {#if providerQuotes.length && !variableTextInput}
          <ul class="gen-providers" data-testid="provider-quotes">
            {#each providerQuotes as providerQuote (providerQuote.provider)}
              <li class:is-selected={providerQuote.selected} class:is-cheapest={providerQuote.cheapest}>
                <span>{providerQuote.label}</span>
                {#if providerQuote.credits !== null}<CreditAmount amount={providerQuote.credits} approx />{/if}
                {#if providerQuote.cheapest}<em>cheapest</em>{/if}
              </li>
            {/each}
          </ul>
        {/if}
      </span>
    </div>
  </footer>
</div>

<style>
  .gen {
    --gen-inset: 6px;
    --gen-well: var(--ui-radius-md, 6px);
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    padding: 0 var(--gen-inset) var(--gen-inset);
    background: var(--paper, #fff);
    border: 1px solid var(--line, #e5e5e5);
    border-radius: var(--ui-radius-lg, 10px);
    box-shadow:
      0 1px 2px rgb(0 0 0 / 0.05),
      0 8px 24px -12px rgb(0 0 0 / 0.2);
    transition:
      box-shadow var(--ui-dur-fast, 120ms) ease,
      border-color var(--ui-dur-fast, 120ms) ease;
  }
  .gen:hover {
    box-shadow:
      0 1px 2px rgb(0 0 0 / 0.06),
      0 12px 32px -14px rgb(0 0 0 / 0.26);
  }
  .gen.is-running {
    border-color: transparent;
  }
  .gen.is-running::after {
    content: '';
    position: absolute;
    inset: -1px;
    padding: 1.5px;
    border-radius: inherit;
    pointer-events: none;
    background: conic-gradient(
      from var(--gen-running-angle),
      transparent 0deg,
      var(--ui-accent, #0099ff) 70deg,
      transparent 140deg,
      transparent 360deg
    );
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    animation: gen-running-spin 1.6s linear infinite;
  }

  @property --gen-running-angle {
    syntax: '<angle>';
    initial-value: 0deg;
    inherits: false;
  }

  @keyframes gen-running-spin {
    to {
      --gen-running-angle: 360deg;
    }
  }

  .gen-body {
    position: relative;
    flex: 1;
    min-height: 0;
    margin-top: var(--gen-inset);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: var(--gen-well);
    background: var(--paper-2, #f9f9f9);
  }

  .gen.is-running .gen-body::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(100deg, transparent 20%, color-mix(in srgb, var(--ui-accent, #0099ff) 9%, transparent) 50%, transparent 80%);
    background-size: 220% 100%;
    animation: gen-shimmer 1.8s ease-in-out infinite;
  }

  @keyframes gen-shimmer {
    from {
      background-position: 120% 0;
    }
    to {
      background-position: -120% 0;
    }
  }

  .gen-body :global(img),
  .gen-body :global(video) {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .gen-example {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .gen-example img,
  .gen-example video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .gen-example-text {
    margin: 0;
    padding: 28px 12px 12px;
    height: 100%;
    overflow: auto;
    font-size: 13px;
    line-height: 1.45;
    color: var(--ink, #1d1d1f);
  }
  .gen-example-mark {
    position: absolute;
    top: 6px;
    left: 6px;
    z-index: 2;
    padding: 0 6px;
    border-radius: var(--ui-radius-sm, 4px);
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 1.25rem;
    color: var(--paper, #fff);
    background: var(--accent-ink, #6d28d9);
  }

  .gen-hint {
    margin: 0;
    padding: 10px;
    font-size: 12px;
    text-align: center;
    color: var(--ink-soft, #6e6e73);
  }

  .gen-busy {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 12px;
  }

  .gen-fail {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 12px;
    text-align: center;
  }
  .gen-fail-title {
    margin: 0;
    font-size: 12.5px;
    font-weight: 650;
    color: var(--ink, #1d1d1f);
  }
  .gen-fail-why {
    margin: 0;
    max-width: 28ch;
    font-size: 11px;
    line-height: 1.4;
    color: var(--ink-soft, #6e6e73);
    overflow-wrap: anywhere;
  }

  .gen-unlock {
    padding: 4px 12px;
    font: inherit;
    font-size: 11.5px;
    line-height: 1.5;
    border: 1px solid var(--line-2, #d2d2d7);
    border-radius: var(--gen-well);
    background: var(--paper, #fff);
    color: var(--ink, #1d1d1f);
    cursor: pointer;
  }
  .gen-unlock:hover {
    background: var(--paper-2, #f9f9f9);
  }
  .gen-unlock:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .gen-route-note {
    margin: 0;
    padding: 0.25rem 0.125rem 0;
    font-size: 0.6875rem;
    color: var(--muted-foreground);
  }

  .gen-uncensored-note {
    margin: 0;
    padding: 8px 2px 0;
    font-size: 11px;
    color: var(--ink-soft, #6e6e73);
  }

  .gen-foot {
    margin-top: auto;
    padding-top: var(--gen-inset);
  }
  .gen-foot.is-full {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .gen-prompt {
    display: block;
    width: 100%;
    resize: none;
    border: 1px solid var(--line, #e5e5e5);
    border-radius: var(--gen-well);
    padding: 8px 10px;
    font: inherit;
    font-size: 12.5px;
    line-height: 1.45;
    color: var(--ink, #1d1d1f);
    background: var(--paper-2, #f9f9f9);
    transition:
      border-color var(--ui-dur-fast, 120ms) ease,
      box-shadow var(--ui-dur-fast, 120ms) ease,
      background var(--ui-dur-fast, 120ms) ease;
  }
  .gen-prompt::placeholder {
    color: var(--ink-soft, #6e6e73);
    opacity: 0.55;
  }
  .gen-prompt.is-full {
    flex: 1;
    min-height: 0;
  }
  .gen-prompt:hover {
    border-color: var(--line-2, #d2d2d7);
  }
  .gen-prompt:focus {
    outline: none;
    background: var(--paper, #fff);
    border-color: var(--ui-accent, #0099ff);
    box-shadow: 0 0 0 3px var(--ui-accent-wash, rgb(0 153 255 / 0.1));
  }

  .gen-skills {
    list-style: none;
    margin: 4px 0 0;
    padding: 2px;
    max-height: 132px;
    overflow-y: auto;
    border: 1px solid var(--line-2, #d2d2d7);
    border-radius: var(--ui-radius-md, 6px);
    background: var(--paper, #fff);
    box-shadow: var(--ui-shadow-float);
  }
  .gen-skills button {
    display: flex;
    gap: 8px;
    width: 100%;
    height: auto;
    padding: 4px 6px;
    border: 0;
    border-radius: var(--ui-radius-sm, 4px);
    background: none;
    font: inherit;
    font-size: 12px;
    text-align: left;
    color: var(--ink, #1d1d1f);
    cursor: pointer;
  }
  .gen-skills button.is-picked {
    background: var(--paper-2, #f2f2f2);
  }
  .gen-skills span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ink-3, #6e6e73);
  }

  .gen-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    height: 30px;
    margin-top: var(--gen-inset);
  }
  .gen-skill-save {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-right: auto;
    height: 26px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--gen-well);
    background: none;
    font: inherit;
    font-size: 11.5px;
    color: var(--ink-soft, #6e6e73);
    cursor: pointer;
  }
  .gen-skill-save:hover {
    background: var(--paper-2, #f2f2f2);
    color: var(--ink, #1d1d1f);
  }
  .gen-skill-name {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-right: auto;
    min-width: 0;
    font-size: 12px;
  }
  .gen-skill-name input {
    flex: 1;
    min-width: 0;
    height: 26px;
    padding: 0 8px;
    font: inherit;
    border: 1px solid var(--line-2, #d2d2d7);
    border-radius: var(--gen-well);
    background: var(--paper, #fff);
    color: var(--ink, #1d1d1f);
  }
  .gen-skill-name button {
    height: 26px;
    padding: 0 8px;
    font-size: 11.5px;
  }
  .gen-warn {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    color: var(--ui-danger, #e5484d);
  }
  .gen-warn.is-soft {
    color: var(--ink-soft, #6e6e73);
  }

  .gen-past {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    padding-top: 5px;
  }
  .gen-past-one {
    min-width: 22px;
    height: auto;
    padding: 1px 7px;
    font-size: 10.5px;
    line-height: 1.5;
    color: var(--ink-soft, #6e6e73);
    background: var(--paper-2, #f9f9f9);
    border: 1px solid transparent;
    border-radius: var(--ui-radius-full, 9999px);
    cursor: pointer;
  }
  .gen-past-one:hover {
    color: var(--ink, #1d1d1f);
  }
  .gen-past-one.is-shown {
    color: var(--paper, #fff);
    background: var(--ink, #1d1d1f);
  }

  button {
    display: inline-flex;
    align-items: center;
    height: 30px;
    padding: 0 12px;
    font: inherit;
    font-size: 12px;
    border: none;
    border-radius: var(--gen-well);
    background: var(--paper-2, #f2f2f2);
    color: var(--ink, #1d1d1f);
    cursor: pointer;
    white-space: nowrap;
  }
  button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .gen-cta {
    gap: 4px;
    font-weight: 500;
    background: var(--ui-accent, #0099ff);
    color: #fff;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.18), 0 1px 2px rgb(0 0 0 / 0.12);
    transition: filter var(--ui-dur-fast, 120ms) ease;
  }
  .gen-cta:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  .gen-cta:active:not(:disabled) {
    filter: brightness(0.95);
  }
  .gen-cta:focus-visible {
    outline: none;
    box-shadow: var(--ui-focus);
  }

  .gen-run {
    position: relative;
    display: inline-flex;
  }
  .gen-providers {
    display: none;
    position: absolute;
    right: 0;
    bottom: 100%;
    margin: 0 0 6px;
    padding: 4px;
    list-style: none;
    min-width: 220px;
    background: var(--ui-raised, #fff);
    border-radius: var(--ui-radius-md, 6px);
    box-shadow: var(--ui-shadow-float);
    font-size: 12px;
    z-index: 5;
  }
  .gen-run:hover .gen-providers,
  .gen-run:focus-within .gen-providers {
    display: block;
  }
  .gen-providers li {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    padding: 4px 6px;
    border-radius: var(--ui-radius-sm, 4px);
  }
  .gen-providers li.is-selected {
    font-weight: 600;
    background: var(--paper-2, #f2f2f2);
  }
  .gen-providers li.is-cheapest em {
    font-style: normal;
    color: var(--ui-ok, #1f9d55);
  }
  .gen-loop {
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
  }
  .gen-loop:hover:not(:disabled) {
    background: var(--paper-2, #f9f9f9);
  }

  .gen-dots {
    display: inline-flex;
    gap: 5px;
  }
  .gen-dots i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ui-accent, #0099ff);
    animation: gen-blink 1.2s infinite;
  }
  .gen-dots i:nth-child(2) {
    animation-delay: 0.2s;
  }
  .gen-dots i:nth-child(3) {
    animation-delay: 0.4s;
  }
  @keyframes gen-blink {
    0%, 60%, 100% { opacity: 0.25; }
    30% { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .gen.is-running::after {
      animation: none;
      background: var(--ui-accent, #0099ff);
    }
    .gen.is-running .gen-body::before,
    .gen-dots i {
      animation: none;
    }
    .gen {
      transition: none;
    }
  }
  .gen.is-compact {
    padding: 0;
  }
  .is-compact .gen-body {
    position: absolute;
    inset: 0;
    margin: 0;
    border-radius: calc(var(--ui-radius-lg, 10px) - 1px);
  }
  .is-compact:not(.is-done) .gen-body {
    padding-bottom: 48px;
  }
  .is-compact .gen-foot {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 8px;
    z-index: 3;
    padding: 0;
    transition: opacity var(--ui-dur-fast, 120ms) ease;
  }
  .is-compact .gen-foot.is-full {
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 0 8px 8px;
  }
  .is-compact.is-done:not(.is-selected):not(:hover):not(:focus-within) .gen-foot {
    opacity: 0;
    pointer-events: none;
  }
  .is-compact .gen-actions {
    height: auto;
    min-height: 40px;
    margin: 0;
    align-items: flex-end;
    gap: 6px;
    padding: 5px;
    border: 1px solid var(--line, #e5e5e5);
    border-radius: var(--gen-well);
    background: color-mix(in srgb, var(--paper, #fff) 94%, transparent);
    backdrop-filter: blur(12px);
    box-shadow: 0 6px 20px -10px rgb(0 0 0 / 0.35);
  }
  .is-compact .gen-actions .gen-prompt {
    flex: 1;
    min-width: 0;
    height: 28px;
    padding: 5px 4px;
    border: 0;
    border-radius: var(--ui-radius-sm, 4px);
    background: transparent;
    overflow: hidden;
    transition: height var(--ui-dur, 200ms) var(--ui-ease, ease);
  }
  .is-compact .gen-actions .gen-prompt:focus {
    height: 96px;
    overflow: auto;
    background: transparent;
    box-shadow: none;
  }
  .is-compact .gen-foot.is-full .gen-prompt {
    flex: 1;
    margin: 8px 0;
    padding: 0 10px;
    border: 0;
    background: transparent;
  }
  .is-compact .gen-foot.is-full .gen-prompt:focus {
    box-shadow: none;
  }
  .is-compact .gen-actions :global(.refs) {
    padding: 0;
    gap: 4px;
    flex-wrap: nowrap;
  }
  .is-compact .gen-actions :global(.refs-add) {
    width: 28px;
    height: 28px;
    padding: 0;
    justify-content: center;
    border: 0;
  }
  .is-compact .gen-actions :global(.refs-label) {
    display: none;
  }
  .is-compact .gen-actions :global(.ref) {
    width: 28px;
    height: 28px;
  }
  .is-compact .gen-actions button,
  .is-compact .gen-actions :global(button) {
    height: 28px;
  }
  .is-compact .gen-skill-save {
    width: 28px;
    margin: 0;
    padding: 0;
    justify-content: center;
  }
  .is-compact .gen-past {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 3;
    padding: 0;
  }
  .is-compact .gen-route-note {
    position: absolute;
    left: 12px;
    bottom: 54px;
    z-index: 3;
  }
  .gen-warn {
    display: block;
    margin-bottom: 4px;
  }
  .gen-skill-name {
    margin: 0 0 6px;
  }
  .is-compact .gen-uncensored-note {
    padding: 0 4px;
    align-self: center;
  }
  .is-compact .gen-skills {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(100% + 6px);
  }
</style>
