<script lang="ts">
  import { DropdownMenu } from 'bits-ui';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import CircleUser from '@lucide/svelte/icons/circle-user-round';
  import type { Contributed } from '@feega/plugin-api/host';
  import SupportList from './SupportList.svelte';
  import { AccountState, ToHost } from '../messages';
  import type { SupportItem } from '../support';
  import { groupedSettings, helpLinks, type ReportFacts, type SettingKey, type SettingValue, type Settings } from '../settings';

  let { onsettings, commands = [], oncommand = () => undefined, onplugins = () => undefined, values, facts, account, support = [], onaccount, onsupport = () => undefined, onsetting, onlink }: { onsettings?: () => void; commands?: Contributed[]; oncommand?: (plugin: string, command: string) => void; onplugins?: () => void; values: Settings | null; facts: ReportFacts | null; account: { state: AccountState; email?: string }; support?: SupportItem[]; onaccount: (kind: ToHost.SignIn | ToHost.CancelSignIn | ToHost.SignOut) => void; onsupport?: (item: SupportItem) => void; onsetting: (key: SettingKey, value: SettingValue) => void; onlink: (url: string) => void } = $props();

  const help = $derived(helpLinks(facts));
  const groups = groupedSettings();
  const typing = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') {
      e.stopPropagation();
    }
  };
</script>

{#snippet sub(label: string)}
  <DropdownMenu.SubTrigger class="dropdown-item fm-item">
    <span class="name">{label}</span>
    <ChevronRight size={12} />
  </DropdownMenu.SubTrigger>
{/snippet}

<div class="menu">
  <DropdownMenu.Root>
    <DropdownMenu.Trigger class="mark" title="Feega" data-testid="feega-menu">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="5" cy="5" r="3.2" fill="#ff5a1f" /><circle cx="11" cy="5" r="3.2" fill="#ff8a3d" /><circle cx="5" cy="11" r="3.2" fill="#ff8a3d" /><circle cx="11" cy="11" r="3.2" fill="#ff5a1f" /></svg>
      <ChevronDown size={12} />
    </DropdownMenu.Trigger>

    <DropdownMenu.Portal>
      <DropdownMenu.Content class="dropdown-menu fm-menu" sideOffset={6} align="start" aria-label="Feega">
        <div class="account">
          <CircleUser size={20} />
          {#if account.state === AccountState.SignedIn}
            <p class="email" data-testid="account-email">{account.email}</p>
            <button type="button" class="ghost" data-testid="sign-out" onclick={() => onaccount(ToHost.SignOut)}>Sign out</button>
          {:else if account.state === AccountState.Waiting}
            <p class="hint grow">Waiting for the browser…</p>
            <button type="button" class="ghost" data-testid="cancel-sign-in" onclick={() => onaccount(ToHost.CancelSignIn)}>Cancel</button>
          {:else}
            <p class="hint grow">{account.state === AccountState.Cancelled ? 'Sign-in cancelled or timed out.' : 'Optional. Everything works without an account.'}</p>
            <button type="button" class="sign-in" data-testid="sign-in" onclick={() => onaccount(ToHost.SignIn)}>Sign in</button>
          {/if}
        </div>

        <DropdownMenu.Separator class="dropdown-sep" />

        {#if onsettings}
          <DropdownMenu.Item class="dropdown-item fm-item" data-testid="open-settings" onSelect={() => onsettings()}>Settings</DropdownMenu.Item>
        {:else}
          <DropdownMenu.Sub>
            {@render sub('Settings')}
            <DropdownMenu.SubContent class="dropdown-menu fm-menu" sideOffset={4}>
              {#each groups as { group, rows } (group)}
                <DropdownMenu.Sub>
                  {@render sub(group)}
                  <DropdownMenu.SubContent class="dropdown-menu fm-menu fm-settings" sideOffset={4}>
                    {#each rows as row (row.key)}
                      {@const value = values?.[row.key] ?? row.fallback}
                      <label class="setting" title={row.hint}>
                        <span class="name" title={row.label}>{row.label}</span>
                        {#if typeof row.fallback === 'boolean'}
                          <span class="switch">
                            <input type="checkbox" role="switch" checked={Boolean(value)} aria-label={row.label} onkeydown={typing} onchange={(e) => onsetting(row.key, e.currentTarget.checked)} />
                            <span class="track"></span>
                          </span>
                        {:else if row.choices}
                          <select value={String(value)} onkeydown={typing} onchange={(e) => onsetting(row.key, e.currentTarget.value)}>
                            {#each row.choices as choice (choice.value)}<option value={choice.value}>{choice.label}</option>{/each}
                          </select>
                        {:else}
                          <input type="text" value={String(value)} placeholder="auto" onkeydown={typing} onchange={(e) => onsetting(row.key, e.currentTarget.value)} />
                        {/if}
                      </label>
                    {/each}
                  </DropdownMenu.SubContent>
                </DropdownMenu.Sub>
              {/each}
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
        {/if}

        <DropdownMenu.Sub>
          {@render sub('Plugins')}
          <DropdownMenu.SubContent class="dropdown-menu fm-menu" sideOffset={4}>
            {#each commands as command (command.plugin + command.entry.id)}
              <DropdownMenu.Item class="dropdown-item fm-item" data-testid="plugin-command" onSelect={() => oncommand(command.plugin, command.entry.id)}>{command.entry.title}</DropdownMenu.Item>
            {/each}
            <DropdownMenu.Item class="dropdown-item fm-item" data-testid="open-plugins" onSelect={() => onplugins()}>Browse plugins</DropdownMenu.Item>
          </DropdownMenu.SubContent>
        </DropdownMenu.Sub>

        <DropdownMenu.Sub>
          {@render sub('Support Feega')}
          <DropdownMenu.SubContent class="dropdown-menu fm-menu fm-support" sideOffset={4}>
            <SupportList done={support} onact={onsupport} />
          </DropdownMenu.SubContent>
        </DropdownMenu.Sub>

        <DropdownMenu.Separator class="dropdown-sep" />

        {#each help as link (link.label)}
          <DropdownMenu.Item class="dropdown-item fm-item" onSelect={() => onlink(link.url)}>{link.label}</DropdownMenu.Item>
        {/each}
        <p class="hint">Feega {facts?.version ?? ''}{facts ? ` · ${facts.framework} · ${facts.styling}` : ''}</p>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
</div>

<style>
  .menu {
    position: relative;
  }

  .menu :global(.mark) {
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

  .menu :global(.mark:hover),
  .menu :global(.mark[data-state='open']) {
    background: var(--ui-input);
  }

  :global(.fm-menu) {
    width: 280px;
    max-height: calc(100vh - 48px);
    overflow-y: auto;
    outline: none;
  }

  :global(.fm-settings) {
    width: 320px;
  }

  :global(.fm-support) {
    width: 300px;
  }

  :global(.fm-item) {
    box-sizing: border-box;
    height: 32px;
    justify-content: space-between;
  }

  .account {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
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
