<script lang="ts">
  import { BRAND_COLORS, COMPONENTS, Control, type AssetKind } from '$lib/motion/components';
  import { FPS, TRANSITION_KINDS, type Edge } from '$lib/motion/design';
  import { resolveColor, type BrandTokens } from '$lib/motion/brand';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { fieldGroups, type Field } from '$lib/motion/inspector';
  import { setProps, setTiming, setTransition, Side, type OpResult } from '$lib/motion/timeline';

  type Asset = { id: string; kind: AssetKind; label: string; previewUrl: string };

  let {
    doc,
    clip,
    tokens,
    assets,
    onchange
  }: { doc: MotionDoc; clip: MotionClip; tokens: BrandTokens; assets: Asset[]; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  let error = $state('');

  const groups = $derived(fieldGroups(clip.component));
  const spec = $derived(COMPONENTS[clip.component]);

  function commit(result: OpResult, summary: string) {
    if (!result.ok) {
      error = result.error;
      return;
    }
    error = '';
    onchange(result.doc, summary);
  }

  function setProp(field: Field, value: unknown) {
    commit(setProps(doc, clip.id, { [field.key]: value }), `Edited ${field.label.toLowerCase()}`);
  }

  function setSeconds(key: 'from' | 'durationInFrames', seconds: number) {
    if (!Number.isFinite(seconds)) {
      return;
    }
    commit(setTiming(doc, clip.id, { [key]: Math.round(seconds * FPS) }), 'Changed timing');
  }

  function setEdge(side: Side, edge: Partial<Edge>) {
    const current = side === Side.In ? clip.transitionIn : clip.transitionOut;
    commit(setTransition(doc, clip.id, side, { ...current, ...edge }), 'Changed transition');
  }

  const value = (field: Field) => (clip.props as Record<string, unknown>)[field.key];
  const isHex = (v: unknown) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
</script>

<div class="inspector" data-testid="motion-inspector">
  <header>
    <span class="kind">{spec.label}</span>
    <span class="id">{clip.id}</span>
  </header>

  <section>
    <h4>Timing</h4>
    <div class="row two">
      <label>Start (s)<input type="number" step="0.1" min="0" value={clip.from / FPS} onchange={(e) => setSeconds('from', Number(e.currentTarget.value))} /></label>
      <label>Length (s)<input type="number" step="0.1" min="0.1" value={clip.durationInFrames / FPS} onchange={(e) => setSeconds('durationInFrames', Number(e.currentTarget.value))} /></label>
    </div>
    {#each [Side.In, Side.Out] as side (side)}
      {@const edge = side === Side.In ? clip.transitionIn : clip.transitionOut}
      <div class="row two">
        <label>
          Transition {side}
          <select value={edge.kind} onchange={(e) => setEdge(side, { kind: e.currentTarget.value as Edge['kind'], durationInFrames: edge.durationInFrames || 12 })}>
            {#each TRANSITION_KINDS as kind (kind)}<option value={kind}>{kind}</option>{/each}
          </select>
        </label>
        <label>Duration (s)<input type="number" step="0.05" min="0" max="2" value={edge.durationInFrames / FPS} onchange={(e) => setEdge(side, { durationInFrames: Math.round(Number(e.currentTarget.value) * FPS) })} /></label>
      </div>
    {/each}
  </section>

  {#each groups as { group, fields } (group)}
    <section>
      <h4>{group}</h4>
      {#each fields as field (field.key)}
        <div class="row">
          <label for={`f-${field.key}`}>{field.label}</label>
          {#if field.control === Control.Text}
            <input id={`f-${field.key}`} type="text" value={String(value(field) ?? '')} onchange={(e) => setProp(field, e.currentTarget.value)} />
          {:else if field.control === Control.Textarea}
            <textarea id={`f-${field.key}`} rows="3" value={String(value(field) ?? '')} onchange={(e) => setProp(field, e.currentTarget.value)}></textarea>
          {:else if field.control === Control.Range}
            <div class="range">
              <input id={`f-${field.key}`} type="range" min={field.min} max={field.max} step={field.step} value={Number(value(field))} oninput={(e) => setProp(field, Number(e.currentTarget.value))} />
              <output>{Number(value(field)).toFixed(field.step && field.step < 1 ? 2 : 0)}</output>
            </div>
          {:else if field.control === Control.Select}
            <select id={`f-${field.key}`} value={String(value(field))} onchange={(e) => setProp(field, e.currentTarget.value)}>
              {#each field.options ?? [] as option (option)}<option value={option}>{option}</option>{/each}
            </select>
          {:else if field.control === Control.Toggle}
            <input id={`f-${field.key}`} type="checkbox" checked={value(field) === true} onchange={(e) => setProp(field, e.currentTarget.checked)} />
          {:else if field.control === Control.Color}
            <div class="swatches">
              {#each BRAND_COLORS as token (token)}
                <button type="button" class="swatch" class:on={value(field) === token} title={token} aria-label={token} style={`background: ${resolveColor(token, tokens)};`} onclick={() => setProp(field, token)}></button>
              {/each}
              <input id={`f-${field.key}`} type="color" value={isHex(value(field)) ? String(value(field)) : resolveColor(value(field), tokens)} onchange={(e) => setProp(field, e.currentTarget.value)} />
            </div>
          {:else if field.control === Control.Asset}
            <div class="assets">
              <button type="button" class="asset none" class:on={!value(field)} onclick={() => setProp(field, null)}>None</button>
              {#each assets.filter((a) => a.kind === field.assetKind) as asset (asset.id)}
                <button type="button" class="asset" class:on={value(field) === asset.id} title={asset.label} onclick={() => setProp(field, asset.id)}>
                  {#if asset.kind === 'image'}<img src={asset.previewUrl} alt="" />{:else}<span>{asset.label}</span>{/if}
                </button>
              {:else}
                <span class="empty">No {field.assetKind} assets on this canvas yet.</span>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </section>
  {/each}

  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    font-size: 12px;
    overflow: auto;
    height: 100%;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 10px 12px;
    border-bottom: 1px solid var(--line);
  }

  .kind {
    font-weight: 600;
    font-size: 13px;
  }

  .id {
    font-family: 'Fragment Mono', ui-monospace, monospace;
    color: var(--ink-soft);
  }

  section {
    padding: 8px 12px 12px;
    border-bottom: 1px solid var(--line);
  }

  h4 {
    margin: 0 0 6px;
    font-family: 'Fragment Mono', ui-monospace, monospace;
    font-size: 10px;
    font-weight: 400;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-bottom: 8px;
  }

  .row.two {
    flex-direction: row;
    gap: 8px;
  }

  .row.two label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  input[type='text'],
  input[type='number'],
  textarea,
  select {
    width: 100%;
    padding: 4px 6px;
    border: 1px solid var(--line);
    background: var(--paper);
    color: var(--ink);
    font: inherit;
  }

  .range {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .range input {
    flex: 1;
  }

  output {
    width: 40px;
    text-align: right;
    font-family: 'Fragment Mono', ui-monospace, monospace;
  }

  .swatches {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .swatch {
    width: 20px;
    height: 20px;
    border: 1px solid var(--line);
  }

  .swatch.on {
    outline: 2px solid #a855f7;
    outline-offset: 1px;
  }

  input[type='color'] {
    width: 28px;
    height: 22px;
    padding: 0;
    border: 1px solid var(--line);
    background: none;
  }

  .assets {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }

  .asset {
    aspect-ratio: 1;
    border: 1px solid var(--line);
    background: var(--paper-2);
    overflow: hidden;
    font-size: 9px;
    padding: 2px;
    word-break: break-all;
  }

  .asset img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .asset.on {
    outline: 2px solid #a855f7;
    outline-offset: 1px;
  }

  .empty {
    grid-column: 1 / -1;
    color: var(--ink-soft);
  }

  .error {
    margin: 8px 12px;
    color: var(--sh-destructive);
  }
</style>
