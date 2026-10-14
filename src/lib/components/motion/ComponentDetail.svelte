<script lang="ts">
  import type { AssetKind } from '$lib/motion/components';
  import { FORMATS } from '$lib/motion/doc';
  import { Action } from '$lib/motion/actions';
  import { interactiveOf } from '$lib/motion/interactive/settings';
  import { ADD_TARGET, AddTarget, Edits, STARTER_FORMATS, draftToAdd, type CatalogueItem, type StarterFormat } from '$lib/motion/template/catalogue';
  import { carryEdits, keyFieldsOf, setTemplateValues, templateFields, type Instance, type TemplateFieldValue } from '$lib/motion/template/library';
  import { FieldLayout, splitFields } from '$lib/motion/template/key-fields';
  import ComponentPreview from './ComponentPreview.svelte';
  import FieldForm from './FieldForm.svelte';
  import IconButton from './IconButton.svelte';
  import MotionPreview from './MotionPreview.svelte';

  type Asset = { id: string; kind: AssetKind; label: string; previewUrl: string };

  let {
    item,
    format: initial,
    draftOf,
    compose,
    assets,
    target = AddTarget.Video,
    onadd,
    onclose
  }: {
    item: CatalogueItem;
    format: StarterFormat;
    draftOf: (id: string, format: StarterFormat) => Instance | null;
    compose: ((doc: Instance['doc']) => string) | null;
    assets: Asset[];
    target?: AddTarget;
    onadd: (sounds: boolean, draft: Instance | null) => void;
    onclose: () => void;
  } = $props();

  const LANDSCAPE = 16 / 9;

  let format = $state<StarterFormat>(initial);
  let draft = $state<Instance | null>(draftOf(item.id, initial));
  let touched = $state(false);
  let sounds = $state(true);
  let playing = $state(true);
  let frame = $state(0);

  const fields = $derived(draft ? templateFields(draft.doc, draft.clipId) : []);
  const split = $derived(draft ? splitFields(fields, keyFieldsOf(draft.doc, draft.clipId)) : { key: [], advanced: [] });
  const vars = $derived(draft ? interactiveOf(draft.doc).vars : []);
  const live = $derived(Boolean(compose && draft && (touched || format !== item.format)));
  const ratio = $derived(live && draft ? draft.doc.width / draft.doc.height : LANDSCAPE);

  const setValue = (f: TemplateFieldValue, raw: string) => (draft ? setTemplateValues(draft.doc, draft.clipId, { [f.key]: raw }) : { ok: false as const, error: 'nothing to edit' });

  function edited(doc: Instance['doc']) {
    if (draft) {
      draft = { ...draft, doc };
      touched = true;
    }
  }

  function reformat(next: StarterFormat) {
    const fresh = draftOf(item.id, next);
    if (!fresh || !draft) {
      return;
    }
    const carried = carryEdits(draft, fresh);
    draft = carried.ok ? { ...fresh, doc: carried.doc } : fresh;
    format = next;
  }
</script>

<aside class="detail" aria-label={item.name} data-testid="component-detail">
  <div class="top">
    <h3>{item.name}</h3>
    <IconButton action={Action.Close} label="Close" data-testid="close-detail" onclick={onclose} />
  </div>

  <div class="stage" style:aspect-ratio={ratio} style:width={`min(100%, calc(46dvh * ${ratio}))`} data-testid="detail-preview">
    {#if live && compose && draft}
      <MotionPreview html={compose(draft.doc)} width={draft.doc.width} height={draft.doc.height} fps={draft.doc.fps} bind:frame bind:playing loop muted />
    {:else}
      <ComponentPreview preview={item.preview} name={item.name} live />
    {/if}
  </div>

  <div class="formats" role="radiogroup" aria-label="Preview format">
    {#each STARTER_FORMATS as f (f)}
      <button type="button" role="radio" aria-checked={format === f} class:on={format === f} data-format={FORMATS[f].label} onclick={() => reformat(f)}>{FORMATS[f].label}</button>
    {/each}
  </div>

  {#if item.description}<p class="about">{item.description}</p>{/if}

  {#if draft && split.key.length}
    <section class="key" data-testid="key-fields">
      <FieldForm doc={draft.doc} fields={split.key} {assets} {setValue} onchange={edited} layout={FieldLayout.Flat} />
    </section>
  {/if}

  {#if draft && (split.advanced.length || vars.length)}
    <details class="advanced" data-testid="advanced-fields">
      <summary>Advanced</summary>
      {#if split.advanced.length}<FieldForm doc={draft.doc} fields={split.advanced} {assets} {setValue} onchange={edited} />{/if}
      <dl class="developer" data-testid="developer-info">
        <dt>Template</dt>
        <dd>{item.id}</dd>
        {#if vars.length}
          <dt>Runtime variables</dt>
          <dd>{vars.map((v) => v.name).join(', ')}</dd>
        {/if}
      </dl>
    </details>
  {/if}

  <footer class="add">
    {#if ADD_TARGET[target].sounds}
      <label class="sounds"><input type="checkbox" bind:checked={sounds} data-testid="add-sounds" /> Add sounds</label>
    {/if}
    <button type="button" class="primary" data-testid="insert-component" onclick={() => onadd(sounds, draftToAdd(draft, touched ? Edits.Some : Edits.None, format, initial))}>{ADD_TARGET[target].label}</button>
  </footer>
</aside>

<style>
  .detail {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    overflow: auto;
    padding: 16px;
    background: var(--ui-bg);
    border-left: 1px solid var(--ui-line);
  }

  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  h3 {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.04em;
    text-transform: lowercase;
  }

  .stage {
    container-type: size;
    display: grid;
    place-items: center;
    flex: none;
    margin: 0 auto;
    background: #0a0a0a;
  }

  .stage > :global(.preview) {
    width: 100%;
  }

  .about {
    margin: 0;
    color: var(--ui-ink-2);
    font-size: 13px;
  }

  .formats {
    display: flex;
    gap: 6px;
  }

  .formats button {
    height: 28px;
    padding: 0 12px;
    border: 1px solid var(--ui-line);
    border-radius: 9999px;
    background: none;
    color: var(--ui-ink-2);
    font: inherit;
    font-size: 12px;
  }

  .formats button.on {
    background: var(--ui-ink);
    border-color: var(--ui-ink);
    color: var(--ui-bg);
  }

  .key {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .add {
    position: sticky;
    bottom: -16px;
    display: flex;
    align-items: center;
    gap: 12px;
    margin: auto -16px -16px;
    padding: 12px 16px 16px;
    background: var(--ui-bg);
    border-top: 1px solid var(--ui-line);
  }

  .sounds {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }

  .primary {
    flex: 1;
    height: 40px;
    border: 0;
    border-radius: 9999px;
    background: var(--ui-ink);
    color: var(--ui-bg);
    font: inherit;
    font-size: 14px;
    font-weight: 500;
  }

  .advanced {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-top: 1px solid var(--ui-line);
    padding-top: 10px;
  }

  summary {
    cursor: pointer;
    font-size: 12px;
    color: var(--ui-ink-2);
  }

  .developer {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    margin: 12px 0 0;
    font-size: 11px;
    color: var(--ui-ink-2);
  }

  .developer dd {
    margin: 0;
    font-family: ui-monospace, monospace;
    word-break: break-all;
  }
</style>
