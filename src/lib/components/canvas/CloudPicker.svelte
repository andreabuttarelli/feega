<script lang="ts">
  import { untrack } from 'svelte';
  import { CLOUD_PROVIDERS, CloudMode, PROVIDER_LABEL, type CloudProviderId } from '$lib/canvas/cloud-picker';

  type Entry = { id: string; name: string; folder: boolean; mime: string | null; importable: boolean };

  let {
    provider: initial,
    mode,
    projectId,
    returnTo,
    onpick,
    onclose
  }: {
    provider: CloudProviderId;
    mode: CloudMode;
    projectId: string;
    returnTo: string;
    onpick: (target: string, provider: CloudProviderId) => Promise<void>;
    onclose: () => void;
  } = $props();

  let provider = $state<CloudProviderId>(untrack(() => initial));
  let trail = $state<{ id: string | null; name: string }[]>([{ id: null, name: untrack(() => PROVIDER_LABEL[initial]) }]);
  let entries = $state<Entry[]>([]);
  let next = $state<string | null>(null);
  let problem = $state<string | null>(null);
  let busy = $state(false);

  const here = $derived(trail[trail.length - 1]);
  const connectUrl = $derived(`/api/v1/cloud/${provider}/connect?return=${encodeURIComponent(returnTo)}`);
  const shown = $derived(mode === CloudMode.Export ? entries.filter((e) => e.folder) : entries);

  async function load(cursor: string | null) {
    problem = null;
    const query = new URLSearchParams();
    if (here.id) {
      query.set('folder', here.id);
    }
    if (cursor) {
      query.set('cursor', cursor);
    }
    const res = await fetch(`/api/v1/projects/${projectId}/cloud/${provider}/files?${query}`);
    const body = (await res.json().catch(() => ({}))) as { entries?: Entry[]; next?: string | null; error?: string };
    if (!res.ok) {
      entries = [];
      next = null;
      problem = body.error ?? 'failed';
      return;
    }
    entries = cursor ? [...entries, ...(body.entries ?? [])] : (body.entries ?? []);
    next = body.next ?? null;
  }

  $effect(() => {
    void here;
    void load(null);
  });

  async function choose(target: string) {
    busy = true;
    await onpick(target, provider);
    busy = false;
  }

  function open(entry: Entry) {
    trail = [...trail, { id: entry.id, name: entry.name }];
  }

  function switchTo(next: CloudProviderId) {
    provider = next;
    trail = [{ id: null, name: PROVIDER_LABEL[next] }];
  }

  function up(index: number) {
    trail = trail.slice(0, index + 1);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onclose();
    }
  }
</script>

<svelte:window onkeydowncapture={onKey} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="scrim" onclick={onclose}></div>
<div class="picker" role="dialog" aria-label={`${PROVIDER_LABEL[provider]} files`} data-testid="cloud-picker">
  {#if mode === CloudMode.Import}
    <div class="tabs" role="tablist">
      {#each CLOUD_PROVIDERS as option (option)}
        <button type="button" role="tab" aria-selected={provider === option} data-testid={`cloud-tab-${option}`} onclick={() => switchTo(option)}>{PROVIDER_LABEL[option]}</button>
      {/each}
    </div>
  {/if}
  <header>
    <nav aria-label="Folder">
      {#each trail as step, i (i)}
        <button type="button" class="crumb" onclick={() => up(i)}>{step.name}</button>
      {/each}
    </nav>
    <button type="button" onclick={onclose}>Close</button>
  </header>

  {#if problem === 'not_connected' || problem === 'reconnect'}
    <p class="note" data-testid="cloud-connect">
      Connect {PROVIDER_LABEL[provider]} to continue.
      <a href={connectUrl} data-testid="cloud-connect-link">Connect</a>
    </p>
  {:else if problem === 'not_configured'}
    <p class="note" data-testid="cloud-unconfigured">{PROVIDER_LABEL[provider]} is not set up on this server.</p>
  {:else if problem}
    <p class="note">Could not load files.</p>
  {:else}
    <ul>
      {#each shown as entry (entry.id)}
        <li>
          {#if entry.folder}
            <button type="button" class="row" onclick={() => open(entry)}>{entry.name}/</button>
          {:else}
            <button type="button" class="row" disabled={busy || !entry.importable} data-testid="cloud-file" onclick={() => choose(entry.id)}>
              {entry.name}{#if !entry.importable} <span class="note">Not importable</span>{/if}
            </button>
          {/if}
        </li>
      {:else}
        <li class="note">Nothing here</li>
      {/each}
    </ul>
    {#if next}
      <footer>
        <button type="button" data-testid="cloud-more" onclick={() => load(next)}>Load more</button>
      </footer>
    {/if}
    {#if mode === CloudMode.Export}
      <footer>
        <button type="button" disabled={busy} data-testid="cloud-export-here" onclick={() => choose(here.id ?? '')}>Export here</button>
      </footer>
    {/if}
  {/if}
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 70;
    background: rgb(0 0 0 / 0.3);
  }

  .picker {
    position: fixed;
    top: 12vh;
    left: 50%;
    z-index: 71;
    width: min(480px, calc(100vw - 32px));
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    transform: translateX(-50%);
    border: 1px solid var(--ui-line-strong);
    border-radius: var(--ui-radius-lg);
    background: var(--ui-surface, var(--background));
    color: var(--ui-ink);
    font-size: var(--ui-text-xs);
    overflow: hidden;
  }

  header,
  footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
  }

  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  ul {
    margin: 0;
    padding: 4px;
    list-style: none;
    overflow-y: auto;
  }

  button,
  a {
    height: 28px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .row {
    display: block;
    width: 100%;
    text-align: left;
  }

  .row:hover {
    background: var(--ui-accent-wash);
  }

  .tabs {
    display: flex;
    gap: 4px;
    padding: 8px 12px 0;
  }

  .tabs [aria-selected='true'] {
    background: var(--ui-accent-wash);
  }

  .note {
    padding: 14px;
    color: var(--ui-ink-3);
  }
</style>
