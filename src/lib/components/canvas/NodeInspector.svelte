<script lang="ts">
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import X from '@lucide/svelte/icons/x';
  import { AppliesAt, FieldKind, inputValueOf, parseFieldInput, commitHandleField, type FieldSpec, type InspectorView } from '$lib/canvas/node-inspector';
  import { syncBlockedReason } from '$lib/canvas/sync-state';

  let {
    view,
    shown,
    onfield,
    onsync,
    onclose
  }: {
    view: InspectorView;
    shown: number;
    onfield: (data: Record<string, unknown>) => void;
    onsync: () => void;
    onclose: () => void;
  } = $props();

  const GROUPS = [
    { at: AppliesAt.Fetch, title: 'Source', hint: 'Applies from the next sync' },
    { at: AppliesAt.Read, title: 'Filters', hint: 'Apply now, also to select and loop' }
  ] as const;

  const running = $derived(view.sync.syncStatus === 'running');
  const blocked = $derived(syncBlockedReason(view.sync));

  function commit(field: FieldSpec, raw: string | boolean) {
    if (field.path === 'handle') {
      onfield(commitHandleField(view, String(raw)));
      return;
    }
    const value = parseFieldInput(field, raw);
    if (value === undefined) {
      return;
    }
    onfield(view.dataWith(field.path, value));
  }

  function text(field: FieldSpec): string {
    const value = inputValueOf(view.values, field.path);
    return value === null || value === undefined ? '' : String(value);
  }
</script>

<aside class="inspector" aria-label={`Settings: ${view.title}`} data-testid="node-inspector">
  <header class="inspector-head">
    <h2 class="inspector-title">{view.title}</h2>
    <button type="button" class="inspector-close" onclick={onclose} aria-label="Close settings">
      <X size={14} strokeWidth={1.8} />
    </button>
  </header>

  <div class="inspector-body">
    {#each GROUPS as group (group.at)}
      <section class="inspector-group">
        <h3 class="inspector-group-title">{group.title}</h3>
        <p class="inspector-hint">{group.hint}</p>

        {#each view.fields.filter((f) => f.appliesAt === group.at) as field (field.path)}
          <label class="inspector-field" class:is-toggle={field.kind === FieldKind.Toggle}>
            <span class="inspector-label">{field.label}</span>
            {#if field.kind === FieldKind.Select}
              <select class="inspector-input" name={field.path} value={text(field)} onchange={(e) => commit(field, e.currentTarget.value)}>
                {#each field.options ?? [] as option (option.value)}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            {:else if field.kind === FieldKind.Toggle}
              <input
                type="checkbox"
                name={field.path}
                checked={inputValueOf(view.values, field.path) === true}
                onchange={(e) => commit(field, e.currentTarget.checked)}
              />
            {:else}
              <input
                class="inspector-input"
                name={field.path}
                type={field.kind === FieldKind.Number ? 'number' : field.kind === FieldKind.Date ? 'date' : 'text'}
                min={field.kind === FieldKind.Number ? (field.required ? 1 : 0) : undefined}
                placeholder={field.placeholder ?? ''}
                value={text(field)}
                onchange={(e) => commit(field, e.currentTarget.value)}
              />
            {/if}
          </label>
        {/each}
      </section>
    {/each}
  </div>

  <footer class="inspector-sync">
    <p class="inspector-status" aria-live="polite">
      {#if running}
        Sta scaricando…
      {:else if view.sync.syncStatus === 'failed' && view.sync.syncError}
        <span class="inspector-error" role="alert">{view.sync.syncError}</span>
      {:else if view.sync.syncedAt}
        {view.syncSummary ? `${view.syncSummary} · ` : ''}{shown} di {view.sync.syncedCount} mostrati · ultima sincronizzazione {new Date(view.sync.syncedAt).toLocaleString()}
      {:else}
        Mai sincronizzato
      {/if}
    </p>
    <p class="inspector-cost">{view.syncCredits ? `Costs ${view.syncCredits} credits` : 'Syncing costs no credits'}</p>
    <button type="button" class="inspector-sync-btn" onclick={onsync} disabled={!view.canSync} title={blocked ?? 'Sync now'}>
      <RefreshCw size={13} strokeWidth={1.8} class={running ? 'is-spinning' : ''} />
      Sync now
    </button>
  </footer>
</aside>

<style>
  .inspector {
    position: absolute;
    z-index: 19;
    top: 60px;
    right: 8px;
    bottom: 8px;
    width: 300px;
    max-width: calc(100vw - 16px);
    display: flex;
    flex-direction: column;
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    box-shadow: 0 4px 18px rgb(0 0 0 / 0.1);
  }

  .inspector-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid var(--line, #e5e5e5);
  }
  .inspector-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink, #1d1d1f);
  }
  .inspector-close {
    display: inline-flex;
    padding: 4px;
    color: var(--ink-soft, #6e6e73);
    background: none;
    border: 0;
    cursor: pointer;
  }

  .inspector-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 12px 12px;
  }

  .inspector-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 10px;
  }
  .inspector-group-title {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-soft, #6e6e73);
  }
  .inspector-hint {
    margin: -6px 0 0;
    font-size: 11px;
    color: var(--ink-faint, #9a9a9e);
  }

  .inspector-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .inspector-field.is-toggle {
    flex-direction: row-reverse;
    justify-content: flex-end;
    align-items: center;
    gap: 6px;
  }
  .inspector-label {
    font-size: 11.5px;
    color: var(--ink, #1d1d1f);
  }
  .inspector-input {
    padding: 5px 7px;
    font: inherit;
    font-size: 12px;
    color: var(--ink, #1d1d1f);
    background: var(--paper-2, #f9f9f9);
    border: 1px solid var(--line-2, #d2d2d7);
  }

  .inspector-sync {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-top: 1px solid var(--line, #e5e5e5);
  }
  .inspector-status,
  .inspector-cost {
    margin: 0;
    font-size: 11px;
    color: var(--ink-soft, #6e6e73);
    word-break: break-word;
  }
  .inspector-error {
    color: var(--danger, #c0392b);
  }
  .inspector-sync-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 7px 10px;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    color: var(--paper, #fff);
    background: var(--ink, #1d1d1f);
    border: 0;
    cursor: pointer;
  }
  .inspector-sync-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .inspector-sync-btn :global(.is-spinning) {
    animation: inspector-spin 900ms linear infinite;
  }
  @keyframes inspector-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .inspector-sync-btn :global(.is-spinning) {
      animation: none;
    }
  }
</style>
