<script lang="ts">
  import IconButton from './IconButton.svelte';
  import { Action } from '$lib/motion/actions';
  import X from '@lucide/svelte/icons/x';
  import { deserialize } from '$app/forms';
  import MotionPreview from './MotionPreview.svelte';
  import { newMotionDoc, MotionFormat, type MotionDoc } from '$lib/motion/doc';
  import { FIELD_TYPE_LABEL } from '$lib/motion/template/field-model';
  import { BUILTIN_PREFIX } from '$lib/motion/template/builtins';
  import { insertTemplate, type TemplateEntry } from '$lib/motion/template/library';

  let {
    templates,
    doc,
    selectedComp,
    frame,
    editorUrl,
    compose,
    oninsert,
    onsaved,
    onremoved,
    onclose
  }: {
    templates: TemplateEntry[];
    doc: MotionDoc;
    selectedComp: string | null;
    frame: number;
    editorUrl: string;
    compose: (doc: MotionDoc) => string;
    oninsert: (entry: TemplateEntry) => void;
    onsaved: (entry: TemplateEntry) => void;
    onremoved: (id: string) => void;
    onclose: () => void;
  } = $props();

  let chosen = $state<string | null>(null);
  let name = $state('');
  let description = $state('');
  let error = $state('');
  let previewFrame = $state(0);

  const entry = $derived(templates.find((t) => t.id === chosen) ?? templates[0] ?? null);
  const sample = $derived.by(() => {
    if (!entry) {
      return null;
    }
    let n = 0;
    const blank = { ...newMotionDoc(MotionFormat.Landscape), width: doc.width, height: doc.height, fps: doc.fps, durationInFrames: entry.template.doc.durationInFrames };
    const placed = insertTemplate(blank, entry, { from: 0, newId: () => `preview${++n}` });
    return placed.ok ? placed.doc : null;
  });

  async function save() {
    const form = new FormData();
    form.set('doc', JSON.stringify(doc));
    form.set('compId', selectedComp ?? '');
    form.set('name', name);
    form.set('description', description);
    form.set('posterFrame', String(frame));
    const res = await fetch(`${editorUrl}?/saveTemplate`, { method: 'POST', body: form, headers: { 'x-sveltekit-action': 'true' } });
    const result = deserialize(await res.text());
    if (result.type !== 'success') {
      error = String((result.type === 'failure' ? result.data?.error : null) ?? 'The template could not be saved.');
      return;
    }
    error = '';
    name = '';
    onsaved((result.data as { entry: TemplateEntry }).entry);
  }

  async function remove(id: string) {
    const form = new FormData();
    form.set('id', id);
    const res = await fetch(`${editorUrl}?/deleteTemplate`, { method: 'POST', body: form, headers: { 'x-sveltekit-action': 'true' } });
    if (deserialize(await res.text()).type === 'success') {
      onremoved(id);
    }
  }
</script>

<div class="scrim" role="presentation" onclick={onclose}></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label="Templates" data-testid="template-library">
  <header><span>Templates</span><IconButton action={Action.Close} onclick={onclose} /></header>

  <div class="split">
    <ul class="list">
      {#each templates as t (t.id)}
        <li>
          <button type="button" class:on={entry?.id === t.id} onclick={() => (chosen = t.id)}>{t.template.name}</button>
          {#if !t.id.startsWith(BUILTIN_PREFIX)}<button type="button" class="remove" aria-label="Delete template" onclick={() => remove(t.id)}><X size={12} /></button>{/if}
        </li>
      {/each}
    </ul>

    {#if entry}
      <div class="detail">
        {#if sample}
          <div class="preview"><MotionPreview html={compose(sample)} width={sample.width} height={sample.height} fps={sample.fps} bind:frame={previewFrame} /></div>
        {/if}
        <p>{entry.template.description}</p>
        <p class="fields">{entry.template.doc.fields.map((f) => `${f.label} · ${FIELD_TYPE_LABEL[f.type]}`).join(' — ')}</p>
        <button type="button" class="primary" data-testid="insert-template" onclick={() => oninsert(entry)}>Insert at playhead</button>
      </div>
    {/if}
  </div>

  <section class="save">
    <h3>Save {selectedComp ? 'the selected precomp' : 'this video'} as a template</h3>
    <input placeholder="Name" bind:value={name} maxlength="60" />
    <input placeholder="Description" bind:value={description} maxlength="200" />
    <button type="button" disabled={!name.trim()} onclick={save}>Save to library</button>
    {#if error}<p class="error">{error}</p>{/if}
  </section>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgb(0 0 0 / 0.4);
  }

  .dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(820px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    overflow: auto;
    z-index: 41;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--ui-bg);
    color: var(--ui-ink);
    border: 1px solid var(--ui-line);
  }

  header {
    display: flex;
    justify-content: space-between;
  }

  .split {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 12px;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 420px;
    overflow: auto;
  }

  .list li {
    display: flex;
  }

  .list button {
    flex: 1;
    text-align: left;
    padding: 4px 6px;
    background: none;
    border: 0;
    color: inherit;
  }

  .list button.on {
    background: var(--ui-surface);
  }

  .list .remove {
    flex: 0;
  }

  .detail {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .preview {
    aspect-ratio: 16 / 9;
  }

  .fields {
    font-size: 11px;
    color: var(--ui-ink-2);
  }

  .save {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .save h3 {
    width: 100%;
    margin: 0;
    font-size: 12px;
  }

  .error {
    color: var(--ui-ink-2);
  }

  @media (max-width: 640px) {
    .split {
      grid-template-columns: 1fr;
    }
  }
</style>
