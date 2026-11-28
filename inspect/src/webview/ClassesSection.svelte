<script lang="ts">
  import { ToHost, type ClassInfo, type Pick, type Source } from '../messages';
  import { classesState } from './classes-state.svelte';
  import { declarationsLabel, editTarget, ruleContext, usageLabel } from './class-view';
  import { toHost } from './host';
  import { sourceText } from './page-bridge';
  import SectionHead from './SectionHead.svelte';
  import { builtInKey, isOpen } from './section-folds';

  type Props = { pick: Pick; changes: unknown; onselect: (source: Source) => void; closed: string[]; ontoggle: (key: string) => void };

  let { pick, changes, onselect, closed, ontoggle }: Props = $props();

  const key = builtInKey('Classes');

  const at = $derived(sourceText(pick.source));
  const view = $derived(classesState.view?.at === at ? classesState.view : null);
  const own = $derived(view?.element ?? []);
  const others = $derived((view?.inFile ?? []).filter((c) => !own.some((o) => o.key === c.key)));

  let viewingKey = $state<string | null>(null);
  let othersOpen = $state(false);

  const viewing = $derived([...own, ...others].find((c) => c.key === viewingKey) ?? null);

  $effect(() => {
    void changes;
    toHost({ kind: ToHost.Classes, at });
  });

  $effect(() => {
    void at;
    viewingKey = null;
  });

  const open = (file: string, line: number, col = 1) => toHost({ kind: ToHost.Open, at: { file, line, col } });
  const edit = (info: ClassInfo) => (classesState.targetKey = classesState.targetKey === info.key ? null : info.key);
</script>

{#if own.length || view?.dynamic}
  <section data-section="Classes" data-testid="classes">
    <SectionHead title="Classes" open={isOpen(closed, key)} ontoggle={() => ontoggle(key)} />
    {#if isOpen(closed, key)}
    {#each own as info (info.key)}
      <div class="item" class:on={classesState.targetKey === info.key} data-class={info.name}>
        <button type="button" class="name" data-action="class-open" aria-expanded={viewingKey === info.key} onclick={() => (viewingKey = viewingKey === info.key ? null : info.key)}>
          <code>.{info.name}</code>
          <span class="count">{usageLabel(info)}</span>
        </button>
        {#if editTarget(info)}
          <button type="button" class="edit" data-action="class-edit" aria-pressed={classesState.targetKey === info.key} onclick={() => edit(info)}>{classesState.targetKey === info.key ? 'Editing' : 'Edit'}</button>
        {/if}
      </div>
      {#if viewing?.key === info.key}
        {@render detail(info)}
      {/if}
    {/each}
    {#if view?.dynamic}
      <p class="note" data-testid="classes-dynamic">Some classes of this element are set by an expression: the counts can miss other elements.</p>
    {/if}
    {#if others.length}
      <button type="button" class="more" data-action="classes-in-file" aria-expanded={othersOpen} onclick={() => (othersOpen = !othersOpen)}>Used in this file ({others.length})</button>
      {#if othersOpen}
        {#each others as info (info.key)}
          <div class="item" data-class={info.name}>
            <button type="button" class="name" data-action="class-open" onclick={() => (viewingKey = viewingKey === info.key ? null : info.key)}>
              <code>.{info.name}</code>
              <span class="count">{usageLabel(info)}</span>
            </button>
          </div>
          {#if viewing?.key === info.key}
            {@render detail(info)}
          {/if}
        {/each}
      {/if}
    {/if}
    {/if}
  </section>
{/if}

{#snippet detail(info: ClassInfo)}
  <div class="detail" data-testid="class-view">
    <div class="sub">Rules</div>
    {#each info.rules as rule (rule.file + rule.line + rule.selector)}
      <div class="rule">
        <button type="button" class="where" onclick={() => open(rule.file, rule.line)}>{rule.file}:{rule.line}</button>
        {#if ruleContext(rule)}<span class="ctx">{ruleContext(rule)}</span>{/if}
        <code class="decls">{declarationsLabel(rule.declarations)}</code>
      </div>
    {/each}
    <div class="sub">Used in</div>
    <ul class="uses">
      {#each info.uses as use (use.file + use.line + use.col)}
        <li>
          <button type="button" class="where" data-action="use-open" onclick={() => open(use.file, use.line, use.col)}>{use.file}:{use.line}</button>
          {#if use.dynamic}<span class="badge">dynamic</span>{/if}
          <button type="button" class="where" data-action="use-select" onclick={() => onselect({ file: use.file, line: use.line, col: use.col })}>Select</button>
        </li>
      {/each}
    </ul>
    {#if info.elements > info.uses.length}<p class="note">Showing {info.uses.length} of {info.elements}.</p>{/if}
  </div>
{/snippet}

<style>
  section {
    padding: 0 0 8px;
    border-bottom: 1px solid var(--ui-divider);
    font-size: var(--ui-text-sm);
  }

  section:has(:global(> .head [aria-expanded='false'])) {
    padding: 4px 0;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 12px;
  }

  .item.on .name code {
    color: var(--ui-accent);
  }

  .name {
    display: flex;
    flex: 1;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    border: 0;
    background: none;
    padding: 4px 0;
    color: var(--ui-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .count {
    overflow: hidden;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .edit,
  .more,
  .where {
    border: 0;
    background: none;
    padding: 0;
    color: var(--ui-accent);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .more {
    padding: 4px 12px;
  }

  .detail {
    margin: 2px 12px 6px;
    padding: 6px 8px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
    font-size: var(--ui-text-xs);
  }

  .sub {
    margin: 4px 0 2px;
    color: var(--ui-text-2);
    font-weight: 600;
  }

  .rule {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 8px;
    padding: 2px 0;
  }

  .ctx,
  .badge {
    color: var(--ui-text-2);
  }

  .decls {
    flex-basis: 100%;
    color: var(--ui-text-2);
    word-break: break-word;
  }

  .uses {
    max-height: 160px;
    margin: 0;
    padding: 0;
    overflow: auto;
    list-style: none;
  }

  .uses li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
  }

  .note {
    margin: 4px 12px 0;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .detail .note {
    margin: 4px 0 0;
  }
</style>
