<script lang="ts">
  import Unlink from '@lucide/svelte/icons/unlink';
  import { AssetKind } from '$lib/motion/components';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { FieldType } from '$lib/motion/template/field-model';
  import { locateClip, setDeepProps } from '$lib/motion/template/fields';
  import { detachTemplate, instanceComp, setTemplateValues, templateFields, type TemplateFieldValue } from '$lib/motion/template/library';

  type Asset = { id: string; kind: AssetKind; label: string; previewUrl: string };
  type Media = { assetId: string; kind: 'image' | 'video' };
  type Change = { ok: true; doc: MotionDoc } | { ok: false; error: string };

  let { doc, clip, assets, onchange }: { doc: MotionDoc; clip: MotionClip; assets: Asset[]; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  const MEDIA_KIND: Record<string, AssetKind> = { Image: AssetKind.Image, Video: AssetKind.Video, Logo: AssetKind.Image };
  const CROPPABLE = new Set(['Image', 'Video']);
  const LIST_KINDS = new Set(['image', 'video']);

  let error = $state('');

  const mark = $derived(instanceComp(doc, clip.id)?.comp.template ?? null);
  const fields = $derived(templateFields(doc, clip.id));

  const target = (f: TemplateFieldValue) => locateClip(doc, f.clipId)?.clip ?? null;
  const preview = (id: unknown) => assets.find((a) => a.id === id)?.previewUrl ?? '';

  function done(result: Change, summary: string) {
    error = result.ok ? '' : result.error;
    if (result.ok) {
      onchange(result.doc, summary);
    }
  }

  const set = (f: TemplateFieldValue, raw: string) => done(setTemplateValues(doc, clip.id, { [f.key]: raw }), `Set ${f.label}`);
  const crop = (f: TemplateFieldValue, axis: 'focusX' | 'focusY', value: number) => done(setDeepProps(doc, f.clipId, { [axis]: value }), `Cropped ${f.label}`);

  function toggleMedia(f: TemplateFieldValue, asset: Asset) {
    const list = (f.value as Media[] | null) ?? [];
    const next = list.some((m) => m.assetId === asset.id) ? list.filter((m) => m.assetId !== asset.id) : [...list, { assetId: asset.id, kind: asset.kind as Media['kind'] }];
    done(setDeepProps(doc, f.clipId, { [f.prop]: next }), `Set ${f.label}`);
  }
</script>

{#if mark}
  <section class="template" data-testid="template-inspector">
    <header>
      <span class="name">{mark.name}</span>
      <button type="button" class="detach" data-testid="detach-template" title="Detach to edit its structure" onclick={() => done(detachTemplate(doc, clip.id), 'Detached template')}><Unlink size={12} /> Detach</button>
    </header>

    {#each fields as f (f.docKey)}
      <label class="field">
        <span>{f.label}{f.unit ? ` (${f.unit})` : ''}</span>
        {#if f.type === FieldType.Text}
          <textarea rows="2" value={String(f.value ?? '')} onchange={(e) => set(f, e.currentTarget.value)}></textarea>
        {:else if f.type === FieldType.Color}
          <input type="color" value={String(f.value ?? '#000000').slice(0, 7)} onchange={(e) => set(f, e.currentTarget.value)} />
        {:else if f.type === FieldType.Number}
          <input type="number" min={f.min} max={f.max} step="any" value={Number(f.value ?? 0)} onchange={(e) => set(f, e.currentTarget.value)} />
        {:else if f.type === FieldType.Select}
          <select value={String(f.value ?? '')} onchange={(e) => set(f, e.currentTarget.value)}>
            {#each f.options ?? [] as option (option)}<option value={option}>{option}</option>{/each}
          </select>
        {:else if f.type === FieldType.Boolean}
          <input type="checkbox" checked={Boolean(f.value)} onchange={(e) => set(f, e.currentTarget.checked ? 'yes' : 'no')} />
        {:else if f.type === FieldType.Asset}
          {@const kind = MEDIA_KIND[target(f)?.component ?? ''] ?? AssetKind.Image}
          <div class="assets">
            {#each assets.filter((a) => a.kind === kind) as asset (asset.id)}
              <button type="button" class="asset" class:on={f.value === asset.id} title={asset.label} onclick={() => set(f, asset.id)}>
                {#if asset.kind === 'image'}<img src={asset.previewUrl} alt="" />{:else}<span>{asset.label}</span>{/if}
              </button>
            {:else}
              <span class="empty">No {kind} assets on this canvas yet.</span>
            {/each}
          </div>
          {#if CROPPABLE.has(target(f)?.component ?? '') && f.value}
            {@const t = target(f)}
            <div class="crop" style={`aspect-ratio: ${f.aspect ?? 1};`}>
              {#if t?.component === 'Image'}<img src={preview(f.value)} alt="" style={`object-position: ${Number(t.props.focusX) * 100}% ${Number(t.props.focusY) * 100}%;`} />{/if}
            </div>
            <span class="row">Crop X <input type="range" min="0" max="1" step="0.01" value={Number(t?.props.focusX ?? 0.5)} oninput={(e) => crop(f, 'focusX', Number(e.currentTarget.value))} /></span>
            <span class="row">Crop Y <input type="range" min="0" max="1" step="0.01" value={Number(t?.props.focusY ?? 0.5)} oninput={(e) => crop(f, 'focusY', Number(e.currentTarget.value))} /></span>
          {/if}
        {:else if f.type === FieldType.MediaList}
          <div class="assets">
            {#each assets.filter((a) => LIST_KINDS.has(a.kind)) as asset (asset.id)}
              <button type="button" class="asset" class:on={((f.value as Media[] | null) ?? []).some((m) => m.assetId === asset.id)} title={asset.label} onclick={() => toggleMedia(f, asset)}>
                {#if asset.kind === 'image'}<img src={asset.previewUrl} alt="" />{:else}<span>{asset.label}</span>{/if}
              </button>
            {:else}
              <span class="empty">No pictures or videos on this canvas yet.</span>
            {/each}
          </div>
        {/if}
      </label>
    {/each}

    {#if error}<p class="error">{error}</p>{/if}
  </section>
{/if}

<style>
  .template {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .name {
    font-weight: 500;
  }

  .detach {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    border: 1px solid var(--ui-line);
    background: var(--ui-surface);
    padding: 2px 6px;
    font-size: 11px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
  }

  .assets {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }

  .asset {
    aspect-ratio: 1;
    border: 1px solid var(--ui-line);
    background: var(--ui-surface);
    overflow: hidden;
    font-size: 9px;
    padding: 2px;
  }

  .asset img,
  .crop img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .asset.on {
    outline: 2px solid var(--ui-accent);
    outline-offset: 1px;
  }

  .crop {
    width: 100%;
    overflow: hidden;
    border: 1px solid var(--ui-line);
  }

  .row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .empty,
  .error {
    grid-column: 1 / -1;
    color: var(--ui-ink-2);
  }
</style>
