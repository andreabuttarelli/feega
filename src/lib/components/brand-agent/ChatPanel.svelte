<script lang="ts">
  import { BILLING_PATH } from '$lib/billing-path';
  import { tick, untrack } from 'svelte';
  import { _, json } from 'svelte-i18n';
  import { page } from '$app/stores';
  import { nearBottom } from '$lib/chat-scroll';
  import { chatEndpoint } from './chat-endpoint';
  import { keepDraft, keptDraft } from './chat-draft';
  import { chatSession, type ChatSession, type StreamData } from './chat-session.svelte';
  import { nextFollow, type Follow, type FollowEvent } from './chat-follow';
  import { FAILURES, keyboardInset, speakerStarts } from './chat-view';
  import ChatComposer from './ChatComposer.svelte';
  import ChatMessage from './ChatMessage.svelte';
  import ScriptBrief from './ScriptBrief.svelte';
  import { BRIEF_AUTO_GO_S, GO_MESSAGE, pendingBrief } from '$lib/motion/script-brief';
  import ChatModelPicker from './ChatModelPicker.svelte';
  import { chatModelPrefs } from './chat-model-prefs.svelte';
  import { PrefillMode, type ChatPrefill } from './chat-prefill';

  let {
    projectId = '',
    motionNodeId = '',
    reload = 0,
    context,
    onturnend,
    ondata,
    prefill = null,
    onbusy
  }: { projectId?: string; motionNodeId?: string; reload?: number; context?: () => Record<string, unknown>; onturnend?: () => void; ondata?: (part: StreamData) => void; prefill?: ChatPrefill | null; onbusy?: (busy: boolean) => void } = $props();

  let draft = $state('');

  let queued = $state<string | null>(null);

  $effect(() => {
    if (!prefill) {
      return;
    }
    if (prefill.mode === PrefillMode.Send) {
      queued = prefill.text;
      return;
    }
    draft = prefill.text;
  });
  let follow = $state<Follow>('following');
  let scroller = $state<HTMLDivElement | null>(null);
  let root = $state<HTMLDivElement | null>(null);
  let kbInset = $state(0);

  const routeProjectId = $derived($page.params.projectId ?? '');
  const scopeProjectId = $derived(projectId || routeProjectId);
  const endpoint = $derived(chatEndpoint({ projectId: scopeProjectId, motionNodeId }));
  const session = $derived<ChatSession | null>(endpoint ? chatSession(endpoint) : null);
  const models = chatModelPrefs();

  $effect(() => {
    void models.load();
  });

  $effect(() => {
    if (!session) {
      return;
    }
    session.context = () => ({ ...(context?.() ?? {}), ...models.turnFields() });
    session.onTurnEnd = onturnend ?? null;
    session.onData = ondata ?? null;
  });
  const messages = $derived(session?.messages ?? []);
  const sending = $derived(session?.sending ?? false);
  const reconnecting = $derived(session?.reconnecting ?? false);
  const busy = $derived(sending || reconnecting);
  const loading = $derived(session?.loading ?? false);

  $effect(() => {
    onbusy?.(busy);
  });
  const failed = $derived(session?.failed ?? '');
  const failedDetail = $derived(session?.failedDetail ?? '');
  const starts = $derived(speakerStarts(messages));
  const failure = $derived(failed ? FAILURES[failed] : null);
  const copyKey = $derived(motionNodeId ? 'chat.panel.motion' : 'chat.panel');
  const suggestions = $derived(($json(`${copyKey}.suggestions`) as string[] | undefined) ?? []);
  const brief = $derived(motionNodeId && !busy ? pendingBrief(messages) : null);
  let editingBrief = $state(false);
  const showEmpty = $derived(!loading && failed !== 'load' && !messages.length);

  $effect(() => {
    if (!queued || loading || !session) {
      return;
    }
    const text = queued;
    queued = null;
    untrack(() => send(text));
  });

  function on(event: FollowEvent) {
    follow = nextFollow(follow, event);
  }

  async function toEnd(behavior: ScrollBehavior = 'auto') {
    await tick();
    if (!scroller || follow !== 'following') {
      return;
    }
    scroller.scrollTo({ top: scroller.scrollHeight, behavior });
  }

  function jump() {
    on({ kind: 'jumped' });
    void toEnd('smooth');
  }

  $effect(() => {
    void reload;
    if (!session) {
      return;
    }
    const current = session;
    untrack(() => {
      on({ kind: 'jumped' });
      void current.load();
    });
  });

  $effect(() => {
    void session?.revision;
    void toEnd();
  });

  $effect(() => {
    const kept = endpoint;
    if (!kept) {
      return;
    }
    untrack(() => {
      draft = draft || keptDraft(kept);
    });
  });

  $effect(() => {
    if (!endpoint) {
      return;
    }
    keepDraft(endpoint, draft);
  });

  $effect(() => {
    const current = session;
    if (!current) {
      return;
    }
    const back = () => {
      if (document.visibilityState === 'visible') {
        current.resume();
      }
    };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('pageshow', back);
    window.addEventListener('online', back);
    return () => {
      document.removeEventListener('visibilitychange', back);
      window.removeEventListener('pageshow', back);
      window.removeEventListener('online', back);
    };
  });

  $effect(() => {
    const vv = window.visualViewport;
    if (!vv || !root) {
      return;
    }
    const el = root;
    const measure = () => {
      const reservedBelow = window.innerHeight - el.getBoundingClientRect().bottom;
      kbInset = keyboardInset({ innerHeight: window.innerHeight, viewportHeight: vv.height, offsetTop: vv.offsetTop, reservedBelow });
      void toEnd();
    };
    vv.addEventListener('resize', measure);
    vv.addEventListener('scroll', measure);
    return () => {
      vv.removeEventListener('resize', measure);
      vv.removeEventListener('scroll', measure);
    };
  });

  function send(text: string) {
    if (!text || !session || busy) {
      return;
    }
    draft = '';
    on({ kind: 'sent' });
    editingBrief = false;
    void session.send(text, 'append-user');
  }

  function editBrief() {
    editingBrief = true;
    root?.querySelector('textarea')?.focus();
  }

  function retry() {
    session?.retry();
  }

  function suggest(text: string) {
    send(text);
  }

  function stop() {
    session?.stop();
  }
</script>

<div class="panel" bind:this={root} style={`--kb-inset: ${kbInset}px;`}>
  {#if !endpoint}
    <p class="center muted">{$_('chat.panel.noScope')}</p>
  {:else}
    <div
      class="scroll"
      bind:this={scroller}
      onscroll={() => on({ kind: 'scrolled', atBottom: nearBottom(scroller) })}
      role="log"
      aria-label={$_('chat.panel.log')}
      aria-live="polite"
      aria-busy={busy}
    >
      <div class="column">
        {#if loading}
          <div class="skeleton" aria-hidden="true">
            <span class="s-user"></span>
            <span class="s-line w90"></span>
            <span class="s-line w70"></span>
            <span class="s-line w80"></span>
            <span class="s-user short"></span>
            <span class="s-line w60"></span>
          </div>
        {:else if showEmpty}
          <section class="empty">
            <span class="empty-mark" aria-hidden="true"></span>
            <h2>{$_(`${copyKey}.emptyTitle`)}</h2>
            <p>{$_(`${copyKey}.emptyBody`)}</p>
            <ul class="suggestions">
              {#each suggestions as text (text)}
                <li>
                  <button type="button" onclick={() => suggest(text)}>
                    <span>{text}</span>
                    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M5 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>
                  </button>
                </li>
              {/each}
            </ul>
          </section>
        {/if}

        {#each messages as message, i (i)}
          <ChatMessage
            role={message.role}
            content={message.content}
            projectId={scopeProjectId}
            pending={message.pending}
            at={message.at}
            tools={message.tools}
            reasoning={message.reasoning}
            live={message.live}
            first={starts[i]}
          />
        {/each}

        {#if brief}
          {#key brief}
            <ScriptBrief {brief} seconds={BRIEF_AUTO_GO_S} held={editingBrief || !!draft.trim()} ongo={() => send(GO_MESSAGE)} onedit={editBrief} />
          {/key}
        {/if}
      </div>
    </div>

    <div class="dock">
      {#if follow === 'reading' && messages.length}
        <button type="button" class="jump" onclick={jump}>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>
          {$_('chat.panel.jump')}
        </button>
      {/if}

      {#if reconnecting}
        <p class="reconnecting" role="status">{$_('chat.panel.reconnecting')}</p>
      {/if}

      {#if failure}
        <div class="banner" role="alert">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 4.5v4.5M8 11v1" stroke="currentColor" stroke-width="1.8" /><rect x="1.5" y="1.5" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" /></svg>
          <span class="banner-text">{failure.action === 'rephrase' && failedDetail ? failedDetail : $_(failure.messageKey)}</span>
          {#if failure.action === 'credits'}
            <a class="banner-act" href={BILLING_PATH}>{$_('chat.panel.buyCredits')}</a>
          {:else if failure.action === 'retry'}
            <button type="button" class="banner-act" onclick={retry}>{$_('chat.panel.retry')}</button>
          {/if}
        </div>
      {/if}

      <ChatComposer
        bind:value={draft}
        {busy}
        enabled={!loading}
        onsend={() => send(draft.trim())}
        onstop={stop}
      >
        {#snippet controls()}
          {#if models.choice && models.groups.length}
            <ChatModelPicker groups={models.groups} choice={models.choice} onchoose={(next) => void models.choose(next)} />
          {/if}
        {/snippet}
      </ChatComposer>
      <span class="sr-only" aria-live="polite">{sending ? $_('chat.panel.responding') : ''}</span>
    </div>
  {/if}
</div>

<style>
  .panel {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    padding-bottom: var(--kb-inset, 0px);
    font-family: 'DM Sans', var(--font-sans, system-ui), sans-serif;
    --chat-font: 14px;
    --chat-action: 32px;
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }
  .column {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 720px;
    min-height: 100%;
    margin: 0 auto;
    padding: 4px 16px 20px;
  }

  .center {
    margin: auto;
    padding: 24px;
    text-align: center;
  }
  .muted {
    color: var(--ink-soft, #6e6e73);
    font-size: 13px;
  }

  .empty {
    margin: auto 0;
    padding: 24px 0;
  }
  .empty-mark {
    display: block;
    width: 14px;
    height: 14px;
    margin-bottom: 14px;
    background: var(--accent, #c485fe);
  }
  .empty h2 {
    margin: 0 0 6px;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--ink, #1d1d1f);
  }
  .empty p {
    margin: 0 0 18px;
    font-size: 13.5px;
    line-height: 1.55;
    color: var(--ink-soft, #6e6e73);
  }
  .suggestions {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--chat-gap, 0);
    border: 1px solid var(--line, #ededef);
    background: var(--paper, #fff);
  }
  .suggestions li + li {
    border-top: 1px solid var(--line, #ededef);
  }
  .suggestions button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    min-height: 44px;
    padding: 10px 12px;
    border: 0;
    background: var(--chat-field, transparent);
    font: inherit;
    font-size: 13.5px;
    line-height: 1.4;
    text-align: left;
    color: var(--ink, #1d1d1f);
    cursor: pointer;
    transition: background 0.12s ease;
  }
  .suggestions button svg {
    flex: 0 0 auto;
    color: var(--ink-faint, #86868b);
  }
  .suggestions button:hover {
    background: var(--paper-3, #f4f4f4);
  }
  .suggestions button:focus-visible {
    outline: 2px solid var(--accent, #c485fe);
    outline-offset: -2px;
  }

  .dock {
    position: relative;
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 752px;
    margin: 0 auto;
    padding: 0 16px 16px;
  }

  .jump {
    position: absolute;
    top: -44px;
    left: 50%;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    border: 1px solid var(--line-2, #d2d2d7);
    background: var(--paper, #fff);
    color: var(--ink, #1d1d1f);
    font: inherit;
    font-size: 12.5px;
    font-weight: 500;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
    cursor: pointer;
  }
  .jump:focus-visible {
    outline: 2px solid var(--accent, #c485fe);
    outline-offset: 2px;
  }

  .reconnecting {
    margin: 0;
    font-size: 12.5px;
    color: var(--ink-soft, #6e6e73);
  }

  .banner {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 6px 6px 6px 10px;
    border: 1px solid color-mix(in srgb, var(--danger, #c0392b) 35%, transparent);
    background: color-mix(in srgb, var(--danger, #c0392b) 7%, var(--paper, #fff));
    color: var(--danger, #c0392b);
    font-size: 13px;
  }
  .banner-text {
    flex: 1;
    color: var(--ink, #1d1d1f);
  }
  .banner-act {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    height: 30px;
    padding: 0 12px;
    border: 1px solid var(--line-2, #d2d2d7);
    background: var(--paper, #fff);
    color: var(--ink, #1d1d1f);
    font: inherit;
    font-size: 12.5px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }
  .banner-act:focus-visible {
    outline: 2px solid var(--accent, #c485fe);
    outline-offset: 2px;
  }

  .skeleton {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 16px;
  }
  .skeleton span {
    display: block;
    height: 12px;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--ink) 5%, var(--paper)) 0%,
      color-mix(in srgb, var(--ink) 10%, var(--paper)) 45%,
      color-mix(in srgb, var(--ink) 5%, var(--paper)) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.35s ease-in-out infinite;
  }
  .skeleton .s-user {
    align-self: flex-end;
    width: 55%;
    height: 36px;
    margin: 8px 0 4px;
  }
  .skeleton .s-user.short {
    width: 38%;
  }
  .w90 {
    width: 90%;
  }
  .w80 {
    width: 80%;
  }
  .w70 {
    width: 70%;
  }
  .w60 {
    width: 60%;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  @keyframes shimmer {
    from {
      background-position: 200% 0;
    }
    to {
      background-position: -200% 0;
    }
  }

  @media (max-width: 767px) {
    .panel {
      --chat-font: 15px;
      --chat-action: 44px;
    }
    .dock {
      padding: 0 12px 12px;
    }
    .column {
      padding: 4px 12px 16px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton span {
      animation: none;
    }
  }
</style>
