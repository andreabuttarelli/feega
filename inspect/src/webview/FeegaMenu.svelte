<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { tick } from 'svelte';
  import type { Contributed } from '@feega/plugin-api/host';
  import PluginManager from './PluginManager.svelte';
  import SupportList from './SupportList.svelte';
  import type { Row } from './plugin-manager';
  import { AccountState, ToHost } from '../messages';
  import type { SupportItem } from '../support';
  import { LINKS, SETTINGS, issueUrl, type ReportFacts, type SettingKey, type SettingValue, type Settings } from '../settings';

  let { commands = [], oncommand = () => undefined, rows = [], problems = [], canInstall = false, onenable = () => undefined, onremove = () => undefined, oninstall = () => undefined, values, facts, account, support = [], onaccount, onsupport = () => undefined, onsetting, onlink }: { commands?: Contributed[]; oncommand?: (plugin: string, command: string) => void; rows?: Row[]; problems?: string[]; canInstall?: boolean; onenable?: (id: string, enabled: boolean) => void; onremove?: (id: string) => void; oninstall?: (source: string) => void; values: Settings | null; facts: ReportFacts | null; account: { state: AccountState; email?: string }; support?: SupportItem[]; onaccount: (kind: ToHost.SignIn | ToHost.CancelSignIn | ToHost.SignOut) => void; onsupport?: (item: SupportItem) => void; onsetting: (key: SettingKey, value: SettingValue) => void; onlink: (url: string) => void } = $props();

  let open = $state(false);
  let trigger = $state<HTMLButtonElement | null>(null);
  let panel = $state<HTMLDivElement | null>(null);

  async function toggle() {
    open = !open;
    if (open) {
      await tick();
      panel?.querySelector<HTMLElement>('button:not(:disabled), input, select')?.focus();
    }
  }

  function close() {
    open = false;
    trigger?.focus();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  }

  const help = $derived([
    { label: 'Documentation', url: LINKS.docs },
    { label: "What's new", url: LINKS.changelog },
    { label: 'Report a problem', url: facts ? issueUrl(facts) : LINKS.issues }
  ]);
</script>

<div class="menu">
  <button type="button" class="mark" bind:this={trigger} aria-haspopup="dialog" aria-expanded={open} title="Feega" onclick={toggle} data-testid="feega-menu">
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="5" cy="5" r="3.2" fill="#ff5a1f" /><circle cx="11" cy="5" r="3.2" fill="#ff8a3d" /><circle cx="5" cy="11" r="3.2" fill="#ff8a3d" /><circle cx="11" cy="11" r="3.2" fill="#ff5a1f" /></svg>
    <ChevronDown size={12} />
  </button>

  {#if open}
    <div class="scrim" role="presentation" onclick={close}></div>
    <div class="popover" role="dialog" aria-label="Feega" tabindex="-1" bind:this={panel} onkeydown={onKey}>
      <section>
        <h3>Account</h3>
        {#if account.state === AccountState.SignedIn}
          <p class="email" data-testid="account-email">{account.email}</p>
          <button type="button" class="row" data-testid="sign-out" onclick={() => onaccount(ToHost.SignOut)}>Sign out</button>
        {:else if account.state === AccountState.Waiting}
          <button type="button" class="row" data-testid="cancel-sign-in" onclick={() => onaccount(ToHost.CancelSignIn)}>Waiting for the browser… <span class="soon">cancel</span></button>
        {:else}
          <button type="button" class="sign-in" data-testid="sign-in" onclick={() => onaccount(ToHost.SignIn)}>Sign in to Feega</button>
          {#if account.state === AccountState.Cancelled}<p class="hint">Sign-in cancelled or timed out.</p>{/if}
        {/if}
        <p class="hint">Optional. Everything works without an account.</p>
      </section>

      <section>
        <h3>Settings</h3>
        {#each SETTINGS as row (row.key)}
          {@const value = values?.[row.key] ?? row.fallback}
          <label class="setting" title={row.hint}>
            <span>{row.label}</span>
            {#if typeof row.fallback === 'boolean'}
              <input type="checkbox" checked={Boolean(value)} onchange={(e) => onsetting(row.key, e.currentTarget.checked)} />
            {:else if row.choices}
              <select value={String(value)} onchange={(e) => onsetting(row.key, e.currentTarget.value)}>
                {#each row.choices as choice (choice.value)}<option value={choice.value}>{choice.label}</option>{/each}
              </select>
            {:else}
              <input type="text" value={String(value)} placeholder="auto" onchange={(e) => onsetting(row.key, e.currentTarget.value)} />
            {/if}
          </label>
        {/each}
      </section>

      <section>
        <h3>Support Feega</h3>
        <SupportList done={support} onact={onsupport} />
      </section>

      <section>
        <h3>Plugins</h3>
        {#each commands as command (command.plugin + command.entry.id)}
          <button type="button" class="row" data-testid="plugin-command" onclick={() => (oncommand(command.plugin, command.entry.id), close())}>{command.entry.title}</button>
        {/each}
        <PluginManager {rows} {problems} {canInstall} {onenable} {onremove} {oninstall} />
      </section>

      <section>
        <h3>Help</h3>
        {#each help as link (link.label)}
          <button type="button" class="row" onclick={() => onlink(link.url)}>{link.label}</button>
        {/each}
        <p class="hint">Feega {facts?.version ?? ''}{facts ? ` · ${facts.framework} · ${facts.styling}` : ''}</p>
      </section>
    </div>
  {/if}
</div>

<style>
  .menu {
    position: relative;
  }

  .mark {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 28px;
    padding: 0 6px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    cursor: pointer;
  }

  .mark:hover,
  .mark[aria-expanded='true'] {
    background: var(--ui-input);
  }

  .scrim {
    position: fixed;
    inset: 0;
    z-index: 10;
  }

  .popover {
    position: absolute;
    top: 34px;
    left: 0;
    z-index: 11;
    display: flex;
    flex-direction: column;
    width: 280px;
    max-height: 70vh;
    overflow-y: auto;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel);
    box-shadow: 0 0 0 1px var(--ui-divider), 0 12px 32px rgb(0 0 0 / 0.28);
    outline: none;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--ui-space-2);
    border-bottom: 1px solid var(--ui-divider);
  }

  section:last-child {
    border-bottom: 0;
  }

  h3 {
    margin: 4px 8px;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
    font-weight: 500;
  }

  .sign-in {
    width: 100%;
    height: 28px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-text);
    color: var(--ui-panel);
    font: inherit;
    font-weight: 500;
    cursor: pointer;
  }

  .sign-in:hover {
    filter: brightness(1.1);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-sm);
    text-align: left;
    cursor: pointer;
  }

  .row:hover:not(:disabled),
  .row:focus-visible {
    background: var(--ui-input);
  }

  .row:disabled {
    color: var(--ui-text-2);
    cursor: default;
  }

  .soon {
    padding: 0 6px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-input);
    font-size: var(--ui-text-xs);
  }

  .setting {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ui-space-2);
    min-height: 28px;
    padding: 0 8px;
    font-size: var(--ui-text-sm);
  }

  .setting select,
  .setting input[type='text'] {
    width: 120px;
    height: 24px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-sm);
  }

  .email {
    margin: 2px 8px;
    overflow: hidden;
    color: var(--ui-text);
    font-size: var(--ui-text-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hint {
    margin: 2px 8px 4px;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }
</style>
