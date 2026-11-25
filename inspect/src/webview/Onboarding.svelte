<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import X from '@lucide/svelte/icons/x';
  import { onMount } from 'svelte';
  import { AccountState, AdapterState, AgentId, OnboardingOutcome, OnboardingStep, ToHost, type AdapterRow } from '../messages';
  import type { SupportItem } from '../support';
  import { AGENT_LOGOS } from './agent-logos';
  import { LOCAL_EMPTY, LOCAL_LATER, FAQ_ANSWER, FAQ_QUESTION, MCP_COMMAND, MCP_DOCS_URL, SKILL_COMMAND, SKILL_DETAIL, SKILL_TITLE, SLIDES } from './onboarding-slides';
  import { SNACKBAR_TEXT, copyFeedback, type Feedback } from './onboarding-copy';
  import Pixel from '@feega/pixel-icons/Pixel.svelte';
  import { Detection, overviewOf } from './onboarding-agents';
  import type { AcpAgent } from '../host/ai/acp-agents';
  import SupportList from './SupportList.svelte';

  let { account, support, agents, local, adapters, onaccount, onsupport, oncopy, onlink, onstep, ondone }: { account: { state: AccountState; email?: string }; support: SupportItem[]; agents: AgentId[]; local: AcpAgent[]; adapters: AdapterRow[]; onaccount: (kind: ToHost.SignIn | ToHost.CancelSignIn) => void; onsupport: (item: SupportItem) => void; oncopy: (text: string) => void; onlink: (url: string) => void; onstep: (step: OnboardingStep) => void; ondone: (outcome: OnboardingOutcome) => void } = $props();

  const STATUS: Record<AdapterState, string> = { [AdapterState.Installing]: 'Downloading…', [AdapterState.Ready]: 'Ready', [AdapterState.Failed]: 'Could not download' };

  const MCP_KEY = 'mcp';
  const SKILL_KEY = 'skill';

  let index = $state(0);
  let feedback = $state<Feedback>({ copied: null, snackbar: false });
  let faqOpen = $state(false);
  const feel = copyFeedback((next) => (feedback = next));

  function copy(key: string, text: string) {
    oncopy(text);
    feel(key);
  }

  let dialog = $state<HTMLDivElement | null>(null);

  const slide = $derived(SLIDES[index]);
  const last = $derived(index === SLIDES.length - 1);
  const overview = $derived(overviewOf(local));
  const listing = $derived(slide.step === OnboardingStep.LocalAgents);
  const connecting = $derived(slide.step === OnboardingStep.Agents);
  const signing = $derived(slide.step === OnboardingStep.SignIn);

  function focusables() {
    return [...(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])];
  }

  function trap(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      ondone(OnboardingOutcome.Skipped);
      return;
    }
    if (e.key !== 'Tab') {
      return;
    }
    const items = focusables();
    const first = items[0];
    const end = items[items.length - 1];
    if (!dialog?.contains(document.activeElement)) {
      e.preventDefault();
      first?.focus();
      return;
    }
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      end?.focus();
    }
    if (!e.shiftKey && document.activeElement === end) {
      e.preventDefault();
      first?.focus();
    }
  }

  $effect(() => onstep(slide.step));

  onMount(() => dialog?.querySelector<HTMLElement>('[data-primary]')?.focus());
</script>

<svelte:window onkeydown={trap} />

<div class="scrim" role="presentation" data-testid="onboarding">
  <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="onb-title" aria-describedby="onb-body" tabindex="-1" bind:this={dialog}>
    <button type="button" class="close" aria-label="Close" title="Close" data-testid="onboarding-close" onclick={() => ondone(OnboardingOutcome.Skipped)}><X size={14} /></button>

    <div class="body">
      <div class="hero" data-testid="onboarding-icon"><Pixel icon={slide.icon} size={6} /></div>
      <h2 id="onb-title">{slide.title}</h2>
      <p id="onb-body">{slide.body}</p>
      {#if slide.more}<p class="more">{slide.more}</p>{/if}

      {#if listing}
        {#if overview.none}<p class="more" data-testid="onboarding-local-empty">{LOCAL_EMPTY}</p>{/if}
        <ul class="local" data-testid="onboarding-local">
          {#each overview.rows as row (row.id)}
            <li class="local-row" class:off={row.state === Detection.NotFound} data-testid="onboarding-local-{row.id}" data-state={row.state}>
              {#if row.mark.logo}
                <svg class="glyph" width="14" height="14" viewBox={row.mark.logo.viewBox} fill="currentColor" aria-hidden="true"><path d={row.mark.logo.path} /></svg>
              {:else}
                <span class="glyph initial" aria-hidden="true">{row.mark.initial}</span>
              {/if}
              <span class="local-name">{row.label}</span>
              <span class="local-state">{row.state === Detection.Detected ? 'detected' : 'not found'}</span>
            </li>
          {/each}
        </ul>
        <p class="more">{LOCAL_LATER}</p>
      {/if}

      {#if connecting}
        <ul class="agents" data-testid="onboarding-agents">
          {#each Object.values(AgentId) as id (id)}
            {@const found = agents.includes(id)}
            <li class="agent" class:muted={!found} data-testid="onboarding-agent-{id}" data-found={found} title={AGENT_LOGOS[id].label} aria-label={AGENT_LOGOS[id].label}>
              <svg viewBox={AGENT_LOGOS[id].viewBox} width="28" height="28" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d={AGENT_LOGOS[id].path} /></svg>
              {#if found}<span class="badge"><Check size={8} strokeWidth={3} /></span>{/if}
            </li>
          {/each}
        </ul>
        <ul class="ways">
          {#each adapters as row (row.agent)}
            <li data-testid="onboarding-adapter-{row.agent}" data-state={row.state}>
              <span class="text"><span class="label">Feega downloads the {row.label} connector from npm</span><span class="detail">{STATUS[row.state]}{row.reason ? `: ${row.reason}` : ''}</span></span>
            </li>
          {/each}
          <li>
            <span class="text"><span class="label">{SKILL_TITLE}</span><span class="detail">{SKILL_DETAIL}</span></span>
            <span class="actions">
              <button type="button" class="action" class:copied={feedback.copied === SKILL_KEY} data-testid="onboarding-skill-copy" onclick={() => copy(SKILL_KEY, SKILL_COMMAND)}>
                {#if feedback.copied === SKILL_KEY}<Check size={12} strokeWidth={3} />Copied{:else}Copy command{/if}
              </button>
            </span>
          </li>
          <li>
            <span class="text"><span class="label">MCP</span><span class="detail">Your agent reads your selection</span></span>
            <span class="actions">
              <button type="button" class="ghost" data-testid="onboarding-mcp-docs" onclick={() => onlink(MCP_DOCS_URL)}>docs</button>
              <button type="button" class="action" data-testid="onboarding-mcp-copy" class:copied={feedback.copied === MCP_KEY} onclick={() => copy(MCP_KEY, MCP_COMMAND)}>
                {#if feedback.copied === MCP_KEY}<Check size={12} strokeWidth={3} />Copied{:else}Copy setup{/if}
              </button>
            </span>
          </li>
        </ul>
        <div class="faq" class:open={faqOpen}>
          <button type="button" class="question" data-testid="onboarding-faq" aria-expanded={faqOpen} onclick={() => (faqOpen = !faqOpen)}>
            <span>{FAQ_QUESTION}</span><ChevronDown size={14} />
          </button>
          <div class="answer"><p>{FAQ_ANSWER}</p></div>
        </div>
      {/if}

      {#if signing}
        <div class="account">
          {#if account.state === AccountState.SignedIn}
            <p class="signed" data-testid="onboarding-email">Signed in as {account.email}</p>
          {:else if account.state === AccountState.Waiting}
            <button type="button" class="primary" data-primary disabled>Waiting for the browser…</button>
            <button type="button" class="ghost" data-testid="onboarding-cancel" onclick={() => onaccount(ToHost.CancelSignIn)}>cancel</button>
          {:else}
            <button type="button" class="primary" data-primary data-testid="onboarding-sign-in" onclick={() => onaccount(ToHost.SignIn)}>Sign in to Feega</button>
            <button type="button" class="ghost" data-testid="onboarding-sign-in-later" onclick={() => (index += 1)}>maybe later</button>
            {#if account.state === AccountState.Cancelled}<p class="hint">Sign-in cancelled or timed out.</p>{/if}
          {/if}
        </div>
      {/if}

      {#if last}
        <div class="account">
          <SupportList done={support} onact={onsupport} />
          <button type="button" class="primary" data-primary data-testid="onboarding-finish" onclick={() => ondone(OnboardingOutcome.Finished)}>Start designing</button>
        </div>
      {/if}
    </div>

    <footer>
      <button type="button" class="ghost" data-testid="onboarding-skip" onclick={() => ondone(OnboardingOutcome.Skipped)}>skip</button>
      <div class="dots" aria-hidden="true">
        {#each SLIDES as _, at (at)}<span class="dot" class:on={at === index}></span>{/each}
      </div>
      <div class="steps">
        <button type="button" class="ghost" data-testid="onboarding-back" disabled={index === 0} onclick={() => (index -= 1)}>back</button>
        {#if !last}
          <button type="button" class="ghost next" data-testid="onboarding-next" onclick={() => (index += 1)} data-primary>next</button>
        {/if}
      </div>
    </footer>
  </div>
  {#if feedback.snackbar}<div class="snackbar" role="status" data-testid="onboarding-snackbar">{SNACKBAR_TEXT}</div>{/if}
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--ui-space-2);
    background: rgb(0 0 0 / 0.5);
  }

  .dialog {
    position: relative;
    display: flex;
    flex-direction: column;
    width: min(360px, 100%);
    max-height: 100%;
    overflow-y: auto;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel);
    box-shadow: 0 0 0 1px var(--ui-divider), 0 16px 48px rgb(0 0 0 / 0.4);
    outline: none;
  }

  .close {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    cursor: pointer;
  }

  .close:hover {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 32px 24px 16px;
    text-align: center;
  }

  .hero {
    display: flex;
    justify-content: center;
    margin-bottom: 8px;
  }

  h2 {
    margin: 0;
    color: var(--ui-text);
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.04em;
  }

  p {
    margin: 0;
    color: var(--ui-text-2);
    font-size: var(--ui-text-sm);
    line-height: 1.5;
    text-wrap: balance;
  }

  .more {
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .local {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 200px;
    margin: 12px 0 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
    text-align: left;
  }

  .local-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 28px;
    padding: 0 8px;
    border-radius: var(--ui-radius-sm);
    color: var(--ui-text);
    font-size: var(--ui-text-xs);
  }

  .local-row.off {
    color: var(--ui-text-3);
  }

  .local-name {
    flex: 1;
  }

  .local-state {
    color: var(--ui-text-3);
  }

  .local-row:not(.off) .local-state {
    color: #30d158;
  }

  .glyph {
    flex: none;
  }

  .initial {
    display: inline-grid;
    place-items: center;
    width: 14px;
    height: 14px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text-2);
    font-size: 9px;
    font-weight: 600;
  }

  .agents {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }

  .agent {
    position: relative;
    display: flex;
    color: var(--ui-text);
  }

  .agent.muted {
    opacity: 0.3;
  }

  .badge {
    position: absolute;
    right: -4px;
    bottom: -4px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 12px;
    height: 12px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-text);
    color: var(--ui-panel);
  }

  .ways {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
    font-size: var(--ui-text-xs);
    text-align: left;
  }

  .ways li {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
  }

  .label {
    color: var(--ui-text);
    font-weight: 600;
    white-space: nowrap;
  }

  .text {
    display: flex;
    flex-direction: column;
  }

  .detail {
    color: var(--ui-text-3);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    white-space: nowrap;
  }

  .action {
    height: 24px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: background 150ms ease, color 150ms ease;
  }

  .action:hover {
    filter: brightness(1.15);
  }

  .action.copied {
    background: var(--ui-text);
    color: var(--ui-panel);
  }

  .faq {
    margin-top: 8px;
    text-align: left;
  }

  .question {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 6px 0;
    border: 0;
    background: none;
    color: var(--ui-text-2);
    font: inherit;
    font-size: var(--ui-text-xs);
    text-align: left;
    cursor: pointer;
  }

  .question:hover {
    color: var(--ui-text);
  }

  .question :global(svg) {
    flex: none;
    transition: transform 200ms ease;
  }

  .faq.open .question :global(svg) {
    transform: rotate(180deg);
  }

  .answer {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 200ms ease;
  }

  .faq.open .answer {
    grid-template-rows: 1fr;
  }

  .answer p {
    overflow: hidden;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
    text-wrap: pretty;
  }

  .snackbar {
    position: absolute;
    bottom: var(--ui-space-2);
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 12px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-text);
    color: var(--ui-panel);
    font-size: var(--ui-text-xs);
    white-space: nowrap;
    animation: snack-in 200ms ease both;
  }

  @keyframes snack-in {
    from {
      opacity: 0;
      transform: translate(-50%, 8px);
    }
  }

  .account {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin-top: 12px;
  }

  .account :global(.support) {
    width: 100%;
    margin-bottom: 12px;
  }

  .signed {
    color: var(--ui-text);
  }

  .hint {
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .primary {
    width: 100%;
    height: 30px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-text);
    color: var(--ui-panel);
    font: inherit;
    font-weight: 500;
    cursor: pointer;
  }

  .primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .primary:disabled {
    opacity: 0.7;
    cursor: default;
  }

  .ghost {
    height: 26px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .ghost:hover:not(:disabled),
  .ghost:focus-visible {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .ghost:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .next:not(:disabled) {
    color: var(--ui-text);
    font-weight: 500;
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px 12px;
  }

  .dots {
    display: flex;
    gap: 6px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-divider);
  }

  .dot.on {
    background: var(--ui-text);
  }

  .steps {
    display: flex;
    gap: 2px;
  }
</style>
