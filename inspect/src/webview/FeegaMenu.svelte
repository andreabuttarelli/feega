<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import CircleUser from '@lucide/svelte/icons/circle-user-round';
  import { tick } from 'svelte';
  import type { Contributed } from '@feega/plugin-api/host';
  import SupportList from './SupportList.svelte';
  import { AccountState, ToHost } from '../messages';
  import type { SupportItem } from '../support';
  import { groupedSettings, helpLinks, type ReportFacts, type SettingKey, type SettingValue, type Settings } from '../settings';

  let { commands = [], oncommand = () => undefined, onplugins = () => undefined, values, facts, account, support = [], onaccount, onsupport = () => undefined, onsetting, onlink }: { commands?: Contributed[]; oncommand?: (plugin: string, command: string) => void; onplugins?: () => void; values: Settings | null; facts: ReportFacts | null; account: { state: AccountState; email?: string }; support?: SupportItem[]; onaccount: (kind: ToHost.SignIn | ToHost.CancelSignIn | ToHost.SignOut) => void; onsupport?: (item: SupportItem) => void; onsetting: (key: SettingKey, value: SettingValue) => void; onlink: (url: string) => void } = $props();

  let open = $state(false);
  let trigger = $state<HTMLButtonElement | null>(null);
  let panel = $state<HTMLDivElement | null>(null);

  async function toggle() {
    open = !open;
    if (open) {
      await tick();
      panel?.focus();
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

  const help = $derived(helpLinks(facts));
  const groups = groupedSettings();
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
          <div class="account">
            <CircleUser size={20} />
            <p class="email" data-testid="account-email">{account.email}</p>
            <button type="button" class="ghost" data-testid="sign-out" onclick={() => onaccount(ToHost.SignOut)}>Sign out</button>
          </div>
        {:else if account.state === AccountState.Waiting}
          <div class="account">
            <CircleUser size={20} />
            <p class="hint grow">Waiting for the browser…</p>
            <button type="button" class="ghost" data-testid="cancel-sign-in" onclick={() => onaccount(ToHost.CancelSignIn)}>Cancel</button>
          </div>
        {:else}
          <div class="account">
            <CircleUser size={20} />
            <p class="hint grow">{account.state === AccountState.Cancelled ? 'Sign-in cancelled or timed out.' : 'Optional. Everything works without an account.'}</p>
            <button type="button" class="sign-in" data-testid="sign-in" onclick={() => onaccount(ToHost.SignIn)}>Sign in</button>
          </div>
        {/if}
      </section>

      <section>
        <h3>Settings</h3>
        {#each groups as { group, rows } (group)}
          <h4>{group}</h4>
          {#each rows as row (row.key)}
            {@const value = values?.[row.key] ?? row.fallback}
            <label class="setting" title={row.hint}>
              <span class="name" title={row.label}>{row.label}</span>
              {#if typeof row.fallback === 'boolean'}
                <span class="switch">
                  <input type="checkbox" role="switch" checked={Boolean(value)} aria-label={row.label} onchange={(e) => onsetting(row.key, e.currentTarget.checked)} />
                  <span class="track"></span>
                </span>
              {:else if row.choices}
                <select value={String(value)} onchange={(e) => onsetting(row.key, e.currentTarget.value)}>
                  {#each row.choices as choice (choice.value)}<option value={choice.value}>{choice.label}</option>{/each}
                </select>
              {:else}
                <input type="text" value={String(value)} placeholder="auto" onchange={(e) => onsetting(row.key, e.currentTarget.value)} />
              {/if}
            </label>
          {/each}
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
        <button type="button" class="row" data-testid="open-plugins" onclick={() => (onplugins(), close())}>Browse plugins</button>
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
    width: 320px;
    max-height: calc(100vh - 48px);
    overflow-y: auto;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel);
    box-shadow: 0 0 0 1px var(--ui-divider), 0 12px 32px rgb(0 0 0 / 0.28);
    outline: none;
  }

  section {
    display: flex;
    flex-direction: column;
    padding: 0 var(--ui-space-2) var(--ui-space-2);
    border-bottom: 1px solid var(--ui-divider);
  }

  section:last-child {
    border-bottom: 0;
  }

  h3 {
    position: sticky;
    top: 0;
    z-index: 1;
    margin: 0 -8px 2px;
    padding: 8px 16px 4px;
    background: var(--ui-panel);
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
    font-weight: 600;
  }

  h4 {
    margin: 8px 8px 2px;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
    font-weight: 500;
  }

  .account {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    padding: 0 8px;
    color: var(--ui-text-2);
  }

  .sign-in,
  .ghost {
    flex: none;
    height: 24px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    font: inherit;
    font-size: var(--ui-text-sm);
    font-weight: 500;
    cursor: pointer;
  }

  .sign-in {
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
  }

  .sign-in:hover {
    filter: brightness(1.1);
  }

  .ghost {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 32px;
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

  .setting {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ui-space-2);
    height: 32px;
    padding: 0 8px;
    font-size: var(--ui-text-sm);
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .setting select,
  .setting input[type='text'] {
    flex: none;
    box-sizing: border-box;
    width: 128px;
    height: 24px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-sm);
  }

  .setting select:focus-visible,
  .setting input[type='text']:focus-visible {
    outline: 2px solid var(--ui-accent);
    outline-offset: 0;
  }

  .switch {
    display: flex;
    flex: none;
  }

  .switch input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .track {
    position: relative;
    flex: none;
    width: 30px;
    height: 18px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-line-strong);
    transition: background var(--ui-dur-fast);
  }

  .track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-thumb);
    transition: transform var(--ui-dur-fast);
  }

  .switch input:checked + .track {
    background: var(--ui-accent);
  }

  .switch input:checked + .track::after {
    transform: translateX(12px);
  }

  .switch input:focus-visible + .track {
    outline: 2px solid var(--ui-accent);
  }

  .email {
    flex: 1;
    min-width: 0;
    margin: 0;
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

  .hint.grow {
    flex: 1;
    margin: 0;
  }
</style>
