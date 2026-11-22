
<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import Copy from '@lucide/svelte/icons/copy';
  import Share2 from '@lucide/svelte/icons/share-2';
  import X from '@lucide/svelte/icons/x';
  import type { VisitorRole } from '../../../packages/share-protocol/src/frame';
  import { ShareState, ToView, type ViewMessage } from '../messages';
  import { copyLabel, expiryLabel, otherRole, roleLabel, roleToggleLabel } from './share-view';

  type ShareView = Extract<ViewMessage, { kind: ToView.Share }>;

  const COPIED_MS = 1500;

  let { view, onstart, onstop, onkick, onrole }: { view: ShareView | null; onstart: (name: string, canEdit: boolean) => void; onstop: () => void; onkick: (userId: string) => void; onrole: (userId: string, role: VisitorRole) => void } = $props();

  let open = $state(false);
  let name = $state('');
  let canEdit = $state(false);
  let copied = $state(false);

  const state = $derived(view?.state ?? ShareState.Idle);
  const live = $derived(state === ShareState.Live);

  $effect(() => {
    if (view && !open) {
      name = view.name;
      canEdit = view.canEdit;
    }
  });

  async function copy() {
    await navigator.clipboard?.writeText(view?.url ?? '');
    copied = true;
    setTimeout(() => (copied = false), COPIED_MS);
  }

  function onkeydown(e: KeyboardEvent) {
    if (open && e.key === 'Escape') {
      e.stopPropagation();
      open = false;
    }
  }
</script>

<svelte:window {onkeydown} />

{#if view}
  <button type="button" class="share" class:live title="Share this app" aria-label="Share" data-testid="share-button" data-state={state} onclick={() => (open = true)}>
    <Share2 size={14} /><span>{live ? `${view.visitors.length} here` : 'Share'}</span>
  </button>
{/if}

{#if open && view}
  <div class="scrim" role="presentation" data-testid="share-modal" onpointerdown={(e) => e.target === e.currentTarget && (open = false)}>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <button type="button" class="close" aria-label="Close" title="Close" onclick={() => (open = false)}><X size={14} /></button>
      <h2 id="share-title">Share this app</h2>

      {#if !view.available}
        <p class="muted" data-testid="share-unavailable">Sharing works from the Feega extension and from npx feega.</p>
      {:else if live}
        <p class="muted">Anyone in your organization with the link can open it after signing in to Feega.</p>
        <div class="link">
          <input readonly value={view.url} aria-label="Share link" data-testid="share-link" onfocus={(e) => e.currentTarget.select()} />
          <button type="button" class="action" data-testid="share-copy" onclick={copy}>{#if copied}<Check size={13} />{:else}<Copy size={13} />{/if}{copyLabel(copied)}</button>
        </div>
        <dl>
          <dt>Project</dt><dd>{view.name}</dd>
          <dt>Visitors</dt><dd>{view.canEdit ? 'Can edit' : 'Can view'}</dd>
          <dt>Ends</dt><dd>{expiryLabel(view.expiresAt)}</dd>
        </dl>
        <h3>Who is here</h3>
        <ul class="people" data-testid="share-visitors">
          {#each view.visitors as person (person.userId)}
            <li><span class="who">{person.name}</span><span class="role">{roleLabel(person.role)}</span><button type="button" class="kick" data-testid="share-role" aria-label={`${roleToggleLabel(person.role)}: ${person.name}`} onclick={() => onrole(person.userId, otherRole(person.role))}>{roleToggleLabel(person.role)}</button><button type="button" class="kick" aria-label={`Remove ${person.name}`} onclick={() => onkick(person.userId)}>Remove</button></li>
          {:else}
            <li class="muted">Nobody yet</li>
          {/each}
        </ul>
        {#if view.error}<p class="error">{view.error}</p>{/if}
        <div class="row"><button type="button" class="action danger" data-testid="share-stop" onclick={() => (onstop(), (open = false))}>Stop sharing</button></div>
      {:else}
        {#if view.notice}
          <p class="notice" data-testid="share-notice">Sharing puts your dev server on the internet for the people you invite: every page, asset and file it serves is visible to them. They must sign in to Feega and belong to your organization. Nothing they do is stored on our servers, only a snapshot of the page when you stop.</p>
        {/if}
        <label class="field">Project name<input bind:value={name} data-testid="share-name" spellcheck="false" /></label>
        <label class="switch"><input type="checkbox" role="switch" bind:checked={canEdit} data-testid="share-edit-switch" /><span class="track"></span><span class="text">Visitors can edit<small>{canEdit ? 'Their changes are written to your files.' : 'Visitors can look and comment, nothing more.'}</small></span></label>
        {#if view.error}<p class="error" data-testid="share-error">{view.error}</p>{/if}
        <div class="row"><button type="button" class="action primary" data-testid="share-go" disabled={state === ShareState.Starting || !name.trim()} onclick={() => onstart(name.trim(), canEdit)}>{state === ShareState.Starting ? 'Starting' : view.notice ? 'I understand, share' : 'Share'}</button></div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .share {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: var(--ui-hit);
    padding: 0 10px;
    border: 0;
    border-radius: var(--ui-radius-md);
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
    font: inherit;
    font-size: var(--ui-text-sm);
    font-weight: 600;
    cursor: pointer;
  }

  .share.live {
    background: #30d158;
    color: #04210e;
  }

  .scrim {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 0.5);
  }

  .dialog {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: min(440px, calc(100vw - 32px));
    padding: 20px;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel);
    box-shadow: 0 0 0 1px var(--ui-divider), 0 24px 64px rgb(0 0 0 / 0.4);
    color: var(--ui-text);
    font-size: var(--ui-text-sm);
  }

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  h3 {
    margin: 4px 0 0;
    font-size: var(--ui-text-sm);
    font-weight: 600;
  }

  p {
    margin: 0;
    line-height: 1.45;
  }

  .muted {
    color: var(--ui-text-2);
  }

  .notice {
    padding: 10px 12px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
    color: var(--ui-text-2);
  }

  .error {
    color: #ff453a;
  }

  .close {
    position: absolute;
    top: 12px;
    right: 12px;
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

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    color: var(--ui-text-2);
  }

  .field input,
  .link input {
    height: 32px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
    box-shadow: inset 0 0 0 1px var(--ui-field-border);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-md);
  }

  .switch {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
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
    margin-top: 1px;
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

  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  small {
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  .link {
    display: flex;
    gap: 6px;
  }

  .link input {
    flex: 1;
    min-width: 0;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 16px;
    margin: 0;
  }

  dt {
    color: var(--ui-text-3);
  }

  dd {
    margin: 0;
  }

  .people {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .people li {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .who {
    flex: 1;
  }

  .role {
    color: var(--ui-text-2);
  }

  .kick {
    border: 0;
    background: none;
    color: var(--ui-text-2);
    font: inherit;
    cursor: pointer;
  }

  .kick:hover {
    color: #ff453a;
  }

  .row {
    display: flex;
    justify-content: flex-end;
  }

  .action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 14px;
    border: 0;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .action.primary {
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
  }

  .action.danger {
    color: #ff453a;
  }

  .action:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
