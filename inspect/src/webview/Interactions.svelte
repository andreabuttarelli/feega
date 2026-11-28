<script lang="ts">
  import { Go } from '@feega/live-edit/go-action';
  import { Opens } from '@feega/live-edit/link-edit';
  import { ToHost, type ChangeRow, type Pick } from '../messages';
  import { toHost } from './host';
  import { sourceText } from './page-bridge';
  import SectionHead from './SectionHead.svelte';
  import { builtInKey, isOpen } from './section-folds';
  import { canAddGo, clickHandler, GO_CHOICES, handlerLabel, routeChoices } from './wiring-view';
  import { wiringState } from './wiring-state.svelte';

  let { pick, changes, closed, ontoggle }: { pick: Pick; changes: ChangeRow[]; closed: string[]; ontoggle: (key: string) => void } = $props();

  const linkKey = builtInKey('Link');
  const eventsKey = builtInKey('Events');

  let go = $state<Go>(Go.Page);
  let target = $state('');

  const at = $derived(sourceText(pick.source));
  const wiring = $derived(wiringState.at === at && wiringState.instance === pick.instanceIndex ? wiringState.wiring : null);
  const link = $derived(wiring?.link ?? null);
  const choice = $derived(GO_CHOICES.find((c) => c.go === go)!);
  const suggestions = $derived(routeChoices(go, wiring?.routes ?? []));
  const linkSuggestions = $derived(wiring?.routes ?? []);
  const handled = $derived(wiring ? clickHandler(wiring) : undefined);

  $effect(() => {
    void changes;
    toHost({ kind: ToHost.Wiring, at, instance: pick.instanceIndex });
  });

  const writeHref = (value: string) => toHost({ kind: ToHost.Link, at, edit: { href: value }, instance: pick.instanceIndex });
  const writeOpens = (box: HTMLInputElement) => toHost({ kind: ToHost.Link, at, edit: { opens: box.checked ? Opens.NewTab : Opens.SameTab }, instance: pick.instanceIndex });
  const addGo = () => (toHost({ kind: ToHost.Go, at, ask: { go, target } }), (target = ''));
</script>

{#if wiring}
  <div class="wiring" data-testid="wiring">
    {#if link}
      <section data-section="Link">
        <SectionHead title="Link" open={isOpen(closed, linkKey)} ontoggle={() => ontoggle(linkKey)} />
        {#if isOpen(closed, linkKey)}
        <div class="row" data-row="link-address">
          <span class="label">{link.attr === 'to' ? 'To' : 'Address'}</span>
          <div class="control">
            <input type="text" class="text" list="feega-link-routes" value={link.value ?? ''} disabled={!link.editable} placeholder="/page or https://" aria-label="Link address" data-field="link-href" onchange={(e) => writeHref(e.currentTarget.value.trim())} />
            <datalist id="feega-link-routes">
              {#each linkSuggestions as route (route)}<option value={route}></option>{/each}
            </datalist>
          </div>
        </div>
        {#if !link.editable}
          <p class="note" data-testid="link-refused">{link.reason}{#if link.at}{' '}<button type="button" class="where" onclick={() => toHost({ kind: ToHost.Open, at: link.at! })}>{link.at.file.split('/').pop()}:{link.at.line}</button>{/if}</p>
        {/if}
        <div class="row" data-row="link-new-tab">
          <span class="label">New tab</span>
          <div class="control">
            <input type="checkbox" checked={link.newTab} disabled={!link.tabEditable} aria-label="Open in a new tab" data-field="link-new-tab" onchange={(e) => writeOpens(e.currentTarget)} />
            {#if link.newTab}<span class="note-inline">adds rel="noopener noreferrer"</span>{/if}
          </div>
        </div>
        {/if}
      </section>
    {/if}

    <section data-section="Events">
      <SectionHead title="Events" open={isOpen(closed, eventsKey)} ontoggle={() => ontoggle(eventsKey)} />
      {#if isOpen(closed, eventsKey)}
      {#each wiring.events as event (event.attribute)}
        <button type="button" class="event" data-event={event.event} title="Open in the editor" onclick={() => toHost({ kind: ToHost.Open, at: event.at })}>
          <span class="name">{event.attribute}</span>
          <span class="handler">{handlerLabel(event)}</span>
          <span class="line">{event.at.file.split('/').pop()}:{event.at.line}</span>
        </button>
      {:else}
        <p class="note">No event handlers</p>
      {/each}

      {#if canAddGo(wiring)}
        <div class="adder" data-testid="go-action">
          <div class="choices" role="radiogroup" aria-label="Action">
            {#each GO_CHOICES as c (c.go)}
              <button type="button" role="radio" aria-checked={go === c.go} class:on={go === c.go} data-go={c.go} onclick={() => (go = c.go)}>{c.label}</button>
            {/each}
          </div>
          <div class="control">
            <input type="text" class="text" list="feega-go-routes" bind:value={target} placeholder={choice.placeholder} aria-label="Action target" data-field="go-target" onkeydown={(e) => e.key === 'Enter' && addGo()} />
            <datalist id="feega-go-routes">
              {#each suggestions as route (route)}<option value={route}></option>{/each}
            </datalist>
            <button type="button" class="primary" disabled={!target.trim()} data-field="go-add" onclick={addGo}>Add</button>
          </div>
        </div>
      {:else if handled && !link}
        <p class="note">Click is handled in code: edit it there to change what it does.</p>
      {/if}
      {/if}
    </section>
  </div>
{/if}

<style>
  .wiring {
    --label-w: 72px;
    font-size: var(--ui-text-sm);
  }

  section {
    padding: 0 0 8px;
    border-bottom: 1px solid var(--ui-divider);
  }

  section:has(:global(> .head [aria-expanded='false'])) {
    padding: 4px 0;
  }

  .row {
    display: grid;
    grid-template-columns: var(--label-w) minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    min-height: 28px;
    padding: 4px 12px;
  }

  .label {
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  .control {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .text {
    flex: 1;
    min-width: 0;
    height: 28px;
    padding: 0 8px;
    border: 1px solid var(--ui-field-border);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
  }

  .text:hover:not(:disabled) {
    border-color: var(--ui-field-border-hover);
  }

  .text:disabled {
    opacity: 0.55;
  }

  input[type='checkbox'] {
    accent-color: var(--ui-accent);
  }

  .note,
  .note-inline {
    margin: 0;
    padding: 0 12px;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .note-inline {
    padding: 0;
  }

  .where {
    padding: 0;
    border: 0;
    background: none;
    color: var(--ui-text);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }

  .event {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 28px;
    padding: 4px 12px;
    border: 0;
    background: none;
    color: var(--ui-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .event:hover {
    background: var(--ui-input);
  }

  .event .name,
  .event .handler,
  .event .line {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .event .handler {
    color: var(--ui-text-2);
  }

  .event .line {
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .adder {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px 12px 0;
  }

  .choices {
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }

  .choices button {
    flex: 1;
    min-width: 0;
    height: 24px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .choices button.on {
    background: var(--ui-panel);
    color: var(--ui-text);
    box-shadow: 0 0 0 1px var(--ui-divider);
  }

  .primary {
    height: 28px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-text);
    color: var(--ui-panel);
    font: inherit;
    cursor: pointer;
  }

  .primary:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .wiring :global(button:focus-visible),
  .wiring :global(input:focus-visible) {
    outline: 2px solid var(--ui-accent);
    outline-offset: 1px;
  }
</style>
