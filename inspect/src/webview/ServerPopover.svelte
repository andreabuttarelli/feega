<script lang="ts">
  import { Popover } from 'bits-ui';
  import Copy from '@lucide/svelte/icons/copy';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import { ServerAction, ServerState, type ServerInfo } from '../messages';
  import { ACTION_LABEL, actionsOf, serverLook } from './server-look';

  const MINUTE_MS = 60_000;

  let { state, reason, info, onaction, onopen }: { state: ServerState; reason: string; info: ServerInfo | null; onaction: (action: ServerAction) => void; onopen: (url: string) => void } = $props();

  const look = $derived(serverLook(state));
  const actions = $derived(actionsOf(state, info?.attached ?? false));
  const uptime = $derived(info?.startedAt ? `${Math.max(0, Math.round((Date.now() - info.startedAt) / MINUTE_MS))} min` : '');
  const error = $derived(state === ServerState.Stopped ? reason || info?.lastError || '' : '');
</script>

<Popover.Root>
  <Popover.Trigger class="server-dot" aria-label={`Dev server: ${look.label}`} title={reason || look.label} data-testid="server-dot" data-state={state}>
    <span class="dot {look.dot}"></span>
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content class="server-popover" align="start" sideOffset={8}>
      <h3>Dev server</h3>
      <p class="status"><span class="dot {look.dot}"></span>{look.label}{uptime && state === ServerState.Running ? ` · ${uptime}` : ''}</p>
      {#if info?.attached}<p class="note">Attached to a server Feega did not start.</p>{/if}
      {#if error}<pre class="error">{error}</pre>{/if}
      {#if info}
        <div class="url">
          <code>{info.url}</code>
          <button type="button" class="icon" aria-label="Copy URL" title="Copy URL" onclick={() => navigator.clipboard?.writeText(info!.url)}><Copy size={13} /></button>
          <button type="button" class="icon" aria-label="Open in browser" title="Open in browser" onclick={() => onopen(info!.url)}><ExternalLink size={13} /></button>
        </div>
        <dl>
          <dt>Framework</dt><dd>{info.framework}</dd>
          <dt>Command</dt><dd>{info.command}</dd>
          <dt>Port</dt><dd>{info.port}{info.pid ? ` · PID ${info.pid}` : ''}</dd>
        </dl>
      {/if}
      <div class="actions">
        {#each actions as action (action)}
          <button type="button" class="action" class:danger={action === ServerAction.Stop} onclick={() => onaction(action)} data-action={action}>{ACTION_LABEL[action]}</button>
        {/each}
      </div>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>

<style>
  :global(.server-dot) {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-full);
    background: none;
    cursor: pointer;
  }

  :global(.server-dot:focus-visible) {
    outline: 1px solid var(--ui-accent);
  }

  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: var(--ui-radius-full);
  }

  .grey {
    background: #8e8e93;
  }

  .amber {
    background: #ff9f0a;
  }

  .green {
    background: #30d158;
  }

  .red {
    background: #ff453a;
  }

  :global(.server-popover) {
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 300px;
    padding: 12px;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel);
    box-shadow: 0 0 0 1px var(--ui-divider), 0 12px 32px rgb(0 0 0 / 0.28);
    color: var(--ui-text);
    font-size: var(--ui-text-sm);
  }

  h3 {
    margin: 0;
    font-size: var(--ui-text-sm);
    font-weight: 600;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
  }

  .note {
    margin: 0;
    color: var(--ui-text-2);
  }

  .error {
    max-height: 96px;
    margin: 0;
    padding: 6px 8px;
    overflow: auto;
    border-radius: var(--ui-radius-sm);
    background: color-mix(in srgb, #ff453a 12%, transparent);
    color: var(--ui-text);
    font-size: var(--ui-text-xs);
    white-space: pre-wrap;
  }

  .url {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .url code {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .icon {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    cursor: pointer;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 12px;
    margin: 0;
    font-size: var(--ui-text-xs);
  }

  dt {
    color: var(--ui-text-3);
  }

  dd {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .action {
    height: 26px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .action:hover,
  .action:focus-visible {
    background: var(--ui-input-hover);
  }

  .action.danger {
    color: #ff453a;
  }
</style>
