<script lang="ts">
  import Diamond from '@lucide/svelte/icons/diamond';
  import type { MotionDoc } from '$lib/motion/doc';
  import { instanceOf, instanceTexts, overrideInstance } from '$lib/motion/main-component';
  import { Action, type ActionId } from '$lib/motion/actions';

  let { doc, clipId, onchange, onrun }: { doc: MotionDoc; clipId: string; onchange: (doc: MotionDoc, summary: string) => void; onrun: (id: ActionId) => void } = $props();

  const instance = $derived(instanceOf(doc, clipId));
  const texts = $derived(instanceTexts(doc, clipId));

  function retext(innerId: string, text: string) {
    const result = overrideInstance(doc, clipId, innerId, { text });
    if (result.ok) {
      onchange(result.doc, 'Overrode instance text');
    }
  }
</script>

{#if instance}
  <section class="instance" data-testid="instance-inspector">
    <header>
      <Diamond size={14} />
      <span class="name">{instance.comp.component?.name}</span>
    </header>
    {#each texts as t (t.innerId)}
      <label class="field">
        <span class:overridden={t.overridden}>{t.main}</span>
        <input type="text" value={t.value} data-testid="instance-text" onchange={(e) => retext(t.innerId, e.currentTarget.value)} />
      </label>
    {/each}
    <div class="actions">
      <button type="button" data-testid="instance-reset" disabled={!Object.keys(instance.overrides).length} onclick={() => onrun(Action.ResetInstance)}>Reset overrides</button>
      <button type="button" data-testid="instance-detach" onclick={() => onrun(Action.DetachInstance)}>Detach</button>
    </div>
  </section>
{/if}

<style>
  .instance {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    padding: var(--ui-space-3) var(--ui-space-4);
    border-bottom: 1px solid var(--ui-line);
  }

  header {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    color: #9747ff;
    font-weight: 600;
    font-size: var(--ui-type-caption);
  }

  .name {
    color: var(--ui-text);
  }

  .field {
    display: grid;
    grid-template-columns: 1fr 2fr;
    align-items: center;
    gap: var(--ui-space-2);
    font-size: var(--ui-type-caption);
    color: var(--ui-text-secondary);
  }

  .field span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .overridden {
    color: #9747ff;
  }

  input {
    min-width: 0;
    padding: 4px 6px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-surface);
    color: var(--ui-text);
    font: inherit;
  }

  .actions {
    display: flex;
    gap: var(--ui-space-2);
  }

  .actions button {
    flex: 1;
    padding: 4px 8px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text);
    font-size: var(--ui-type-caption);
    cursor: pointer;
  }
</style>
