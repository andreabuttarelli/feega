<script lang="ts">
  import { AssetKind } from '$lib/motion/components';
  import type { MotionDoc } from '$lib/motion/doc';
  import { FieldType } from '$lib/motion/template/field-model';
  import { locateClip, setDeepProps, setField } from '$lib/motion/template/fields';
  import type { TemplateFieldValue } from '$lib/motion/template/library';
  import { FieldLayout } from '$lib/motion/template/key-fields';
  import { PropFormat } from '$lib/motion/custom/component';
  import { MediaAccept, MediaKind, acceptOf, itemOfPick, pickOfItem, type MediaPick } from '$lib/motion/media/pick';
  import MediaPicker from './MediaPicker.svelte';
  import type { LiveGesture } from '$lib/motion/live-edit';
  import { liveColour } from './live-colour';
  import MediaListField from './MediaListField.svelte';
  import type { MediaUploader } from './media-upload';

  type Asset = { id: string; kind: string; label: string; previewUrl: string; seconds?: number | null };
  type Change = { ok: true; doc: MotionDoc } | { ok: false; error: string };

  let {
    doc,
    fields,
    assets,
    setValue,
    onchange,
    upload = null,
    gesture = null,
    layout = FieldLayout.Grouped
  }: {
    gesture?: LiveGesture | null;
    doc: MotionDoc;
    fields: TemplateFieldValue[];
    assets: Asset[];
    setValue: (f: TemplateFieldValue, raw: string) => Change;
    onchange: (doc: MotionDoc, summary: string) => void;
    upload?: MediaUploader | null;
    layout?: FieldLayout;
  } = $props();

  const MEDIA_KIND: Record<string, AssetKind> = { Image: AssetKind.Image, Video: AssetKind.Video, Logo: AssetKind.Image };
  const CROPPABLE = new Set(['Image', 'Video']);
  const MEDIA_FIELDS = new Set([FieldType.Asset, FieldType.MediaList]);

  type Slot = { accept: MediaAccept; read: (v: unknown) => MediaPick | null; write: (p: MediaPick | null) => string };
  const ASSET_SLOT = (accept: MediaAccept): Slot => ({ accept, read: (v) => (typeof v === 'string' && v ? { kind: accept === MediaAccept.Video ? MediaKind.Video : MediaKind.Image, assetId: v } : null), write: (p) => p?.assetId ?? '' });
  const ITEM_SLOT = (accept: MediaAccept): Slot => ({ accept, read: pickOfItem, write: itemOfPick });

  function slotOf(f: TemplateFieldValue): Slot {
    const clip = target(f);
    const spec = clip?.component === 'Custom' ? doc.components[String(clip.props.name)]?.propsSchema.properties[f.prop] : undefined;
    if (spec?.format === PropFormat.MediaItem) {
      return ITEM_SLOT(acceptOf(spec.assetKind));
    }
    return ASSET_SLOT(acceptOf(MEDIA_KIND[clip?.component ?? ''] ?? AssetKind.Image));
  }

  let error = $state('');

  const UNGROUPED = '';
  const HEX_VALUE = /^#[0-9a-f]{6}/i;
  const groups = $derived([...new Set(fields.map((f) => f.group ?? UNGROUPED))].map((name) => ({ name, fields: fields.filter((f) => (f.group ?? UNGROUPED) === name) })));
  const ranged = (f: TemplateFieldValue) => f.min !== undefined && f.max !== undefined;
  const stepOf = (f: TemplateFieldValue) => ((f.max ?? 1) - (f.min ?? 0)) / 100;

  const target = (f: TemplateFieldValue) => locateClip(doc, f.clipId)?.clip ?? null;
  const preview = (id: unknown) => assets.find((a) => a.id === id)?.previewUrl ?? '';

  function done(result: Change, summary: string) {
    error = result.ok ? '' : result.error;
    if (result.ok) {
      onchange(result.doc, summary);
    }
  }

  const set = (f: TemplateFieldValue, raw: string) => done(setValue(f, raw), `Set ${f.label}`);
  const crop = (f: TemplateFieldValue, axis: 'focusX' | 'focusY', value: number) => done(setDeepProps(doc, f.clipId, { [axis]: value }), `Cropped ${f.label}`);

</script>

{#each groups as group (group.name)}
{#if group.name && layout === FieldLayout.Grouped}<h4 class="group" data-testid="field-group">{group.name}</h4>{/if}
{#each group.fields as f (f.docKey)}
  <svelte:element this={MEDIA_FIELDS.has(f.type) ? 'div' : 'label'} class="field">
    <span>{f.label}{f.unit ? ` (${f.unit})` : ''}</span>
    {#if f.type === FieldType.Text}
      <textarea rows="2" value={String(f.value ?? '')} onchange={(e) => set(f, e.currentTarget.value)}></textarea>
    {:else if f.type === FieldType.Color}
      <span class="colour">
        <input type="color" value={HEX_VALUE.test(String(f.value)) ? String(f.value).slice(0, 7) : '#000000'} use:liveColour={{ gesture, apply: (value) => set(f, value) }} />
        <output>{HEX_VALUE.test(String(f.value)) ? f.value : 'none'}</output>
      </span>
    {:else if f.type === FieldType.Number && ranged(f)}
      <span class="slider">
        <input type="range" min={f.min} max={f.max} step={stepOf(f)} value={Number(f.value ?? 0)} oninput={(e) => set(f, e.currentTarget.value)} />
        <output>{Number(f.value ?? 0)}</output>
      </span>
    {:else if f.type === FieldType.Number}
      <input type="number" min={f.min} max={f.max} step="any" value={Number(f.value ?? 0)} onchange={(e) => set(f, e.currentTarget.value)} />
    {:else if f.type === FieldType.Select}
      <select value={String(f.value ?? '')} onchange={(e) => set(f, e.currentTarget.value)}>
        {#each f.options ?? [] as option (option)}<option value={option}>{option}</option>{/each}
      </select>
    {:else if f.type === FieldType.Boolean}
      <input type="checkbox" checked={Boolean(f.value)} onchange={(e) => set(f, e.currentTarget.checked ? 'yes' : 'no')} />
    {:else if f.type === FieldType.Asset}
      {@const slot = slotOf(f)}
      <MediaPicker label={f.label} value={slot.read(f.value)} {assets} accept={slot.accept} uploader={upload} onpick={(pick) => set(f, slot.write(pick))} />
      {#if CROPPABLE.has(target(f)?.component ?? '') && f.value}
        {@const t = target(f)}
        <div class="crop" style={`aspect-ratio: ${f.aspect ?? 1};`}>
          {#if t?.component === 'Image'}<img src={preview(f.value)} alt="" style={`object-position: ${Number(t.props.focusX) * 100}% ${Number(t.props.focusY) * 100}%;`} />{/if}
        </div>
        <span class="row">Crop X <input type="range" min="0" max="1" step="0.01" value={Number(t?.props.focusX ?? 0.5)} oninput={(e) => crop(f, 'focusX', Number(e.currentTarget.value))} /></span>
        <span class="row">Crop Y <input type="range" min="0" max="1" step="0.01" value={Number(t?.props.focusY ?? 0.5)} oninput={(e) => crop(f, 'focusY', Number(e.currentTarget.value))} /></span>
      {/if}
    {:else if f.type === FieldType.MediaList}
      <MediaListField label={f.label} value={f.value} {assets} {upload} onchange={(list) => done(setField(doc, f, list), `Set ${f.label}`)} />
    {/if}
  </svelte:element>
{/each}
{/each}

{#if error}<p class="error">{error}</p>{/if}

<style>
  .group {
    margin: 8px 0 0;
    font-size: 11px;
    font-weight: 500;
    color: var(--ui-ink-2);
    text-transform: lowercase;
  }

  .slider {
    display: grid;
    grid-template-columns: 1fr 44px;
    gap: 8px;
    align-items: center;
  }

  .colour {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .colour output,
  .slider output {
    font-family: var(--ui-mono);
    font-size: 11px;
    text-align: right;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
  }

  .crop img {
    width: 100%;
    height: 100%;
    object-fit: cover;
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

  .error {
    grid-column: 1 / -1;
    color: var(--ui-ink-2);
  }
</style>
