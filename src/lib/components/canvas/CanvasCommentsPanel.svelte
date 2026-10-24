<script lang="ts">
  import { commentBodyError, type CommentThread } from '$lib/canvas/comment-threads';
  import { insertMention, mentionQuery, type Teammate } from '$lib/canvas/comment-mentions';
  import { commentsPanel } from '$lib/canvas/comments-panel.svelte';

  let {
    threads,
    me,
    team = [],
    pinsTo,
    onadd,
    onreply,
    onedit,
    ondelete,
    onresolve,
    onclose
  }: {
    threads: CommentThread[] | null;
    me: string;
    team?: Teammate[];
    pinsTo: string;
    onadd: (body: string) => Promise<void>;
    onreply: (threadId: string, body: string) => Promise<void>;
    onedit: (commentId: string, body: string) => Promise<void>;
    ondelete: (commentId: string) => Promise<void>;
    onresolve: (thread: CommentThread) => void;
    onclose: () => void;
  } = $props();

  let draft = $state('');
  let replies = $state<Record<string, string>>({});
  let showResolved = $state(false);

  const shown = $derived((threads ?? []).filter((t) => showResolved || !t.resolved));
  const hiddenCount = $derived((threads ?? []).filter((t) => t.resolved).length);
  let editing = $state<{ id: string; body: string } | null>(null);
  const who = (id: string) => (id === me ? 'You' : (team.find((m) => m.id === id)?.name ?? 'Teammate'));
  const suggestions = (text: string) => {
    const query = mentionQuery(text);
    return query === null ? [] : team.filter((m) => m.id !== me && m.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
  };

  async function saveEdit(e: SubmitEvent) {
    e.preventDefault();
    if (!editing || commentBodyError(editing.body)) {
      return;
    }
    await onedit(editing.id, editing.body);
    editing = null;
  }

  async function add(e: SubmitEvent) {
    e.preventDefault();
    if (commentBodyError(draft)) {
      return;
    }
    await onadd(draft);
    draft = '';
  }

  async function reply(e: SubmitEvent, thread: CommentThread) {
    e.preventDefault();
    const body = replies[thread.id] ?? '';
    if (commentBodyError(body)) {
      return;
    }
    await onreply(thread.id, body);
    replies[thread.id] = '';
  }
</script>

{#snippet picks(text: string, pick: (next: string) => void)}
  {#each suggestions(text) as m (m.id)}
    <button type="button" class="cm-pick" data-testid="mention-option" onclick={() => pick(insertMention(text, m.name))}>@{m.name}</button>
  {/each}
{/snippet}

{#snippet entry(id: string, authorId: string, body: string, editedAt: string | null, testid: string, cls: string, lead: string)}
  {#if editing?.id === id}
    <form class="cm-edit" onsubmit={saveEdit}>
      <textarea aria-label="Edit comment" rows="2" maxlength="2000" bind:value={editing.body} data-testid="comment-edit-input"></textarea>
      {@render picks(editing.body, (next) => editing && (editing.body = next))}
      <div class="cm-row">
        <button type="button" class="cm-btn" onclick={() => (editing = null)}>Cancel</button>
        <button type="submit" class="cm-btn primary" data-testid="comment-edit-save" disabled={!!commentBodyError(editing.body)}>Save</button>
      </div>
    </form>
  {:else}
    <p class={cls} data-testid={testid}>{#if lead}<strong>{lead}</strong> {/if}{body}{#if editedAt} <span class="cm-tag" data-testid="comment-edited">(edited)</span>{/if}</p>
    {#if authorId === me}
      <div class="cm-own">
        <button type="button" class="cm-link" data-testid="comment-edit" onclick={() => (editing = { id, body })}>Edit</button>
        <button type="button" class="cm-link" data-testid="comment-delete" onclick={() => ondelete(id)}>Delete</button>
      </div>
    {/if}
  {/if}
{/snippet}

<aside class="cm-panel" aria-label="Comments" data-testid="comments-panel">
  <header>
    <h3>Comments</h3>
    <button type="button" class="cm-x" aria-label="Close comments" onclick={onclose}>×</button>
  </header>

  <form class="cm-new" onsubmit={add}>
    <textarea placeholder="Add a comment" aria-label="New comment" rows="2" maxlength="2000" bind:value={draft} data-testid="comment-draft"></textarea>
    {@render picks(draft, (next) => (draft = next))}
    <div class="cm-row">
      <span class="cm-note">Pins to {pinsTo}</span>
      <button type="submit" class="cm-btn primary" data-testid="comment-add" disabled={!!commentBodyError(draft)}>Comment</button>
    </div>
  </form>

  {#if threads === null}
    <p class="cm-note">Loading…</p>
  {:else if !shown.length}
    <p class="cm-note">No comments yet</p>
  {/if}

  <ul>
    {#each shown as t (t.id)}
      <li class:active={commentsPanel.active === t.id} class:resolved={t.resolved} data-testid="comment-thread" data-thread={t.id}>
        <button type="button" class="cm-head" onclick={() => commentsPanel.focus(t.id)}>
          <span class="cm-num">{t.number}</span>
          <span class="cm-who">{who(t.authorId)}</span>
          {#if t.timeMs !== null}<span class="cm-tag" data-testid="comment-time">{(t.timeMs / 1000).toFixed(2)}s</span>{/if}
          {#if t.resolved}<span class="cm-tag">Resolved</span>{/if}
        </button>
        {@render entry(t.id, t.authorId, t.body, t.editedAt, 'comment-body', 'cm-body', '')}
        {#each t.replies as r (r.id)}
          {@render entry(r.id, r.authorId, r.body, r.editedAt, 'comment-reply', 'cm-reply', who(r.authorId))}
        {/each}
        {@render picks(replies[t.id] ?? '', (next) => (replies[t.id] = next))}
        <form class="cm-row" onsubmit={(e) => reply(e, t)}>
          <input placeholder="Reply" aria-label={`Reply to comment ${t.number}`} maxlength="2000" bind:value={replies[t.id]} data-testid="comment-reply-input" />
          <button type="submit" class="cm-btn" data-testid="comment-reply-send">Reply</button>
          <button type="button" class="cm-btn" data-testid="comment-resolve" onclick={() => onresolve(t)}>{t.resolved ? 'Reopen' : 'Resolve'}</button>
        </form>
      </li>
    {/each}
  </ul>

  {#if hiddenCount || showResolved}
    <button type="button" class="cm-link" data-testid="comment-show-resolved" onclick={() => (showResolved = !showResolved)}>
      {showResolved ? 'Hide resolved' : `Show resolved (${hiddenCount})`}
    </button>
  {/if}
</aside>

<style>
  .cm-panel { position: fixed; left: 56px; top: 60px; max-height: calc(100vh - 150px); width: 300px; z-index: 40; display: flex; flex-direction: column; gap: 10px; overflow: auto; padding: 14px; background: var(--paper, #fff); border: 1px solid var(--line, #e3e3e6); border-radius: var(--ui-radius-lg, 10px); box-shadow: 0 20px 50px -20px rgba(0, 0, 0, 0.35); }
  header { display: flex; align-items: center; justify-content: space-between; }
  h3 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.02em; }
  .cm-x { font: inherit; font-size: 18px; line-height: 1; cursor: pointer; background: none; border: 0; color: var(--ink-soft, #6e6e73); }
  .cm-new { display: flex; flex-direction: column; gap: 6px; }
  textarea, input { font: inherit; font-size: 13px; padding: 6px 8px; border: 1px solid var(--line, #e3e3e6); border-radius: var(--ui-radius-sm, 4px); resize: none; min-width: 0; }
  input { flex: 1; }
  .cm-row { display: flex; align-items: center; gap: 6px; justify-content: space-between; }
  .cm-note { margin: 0; font-size: 12px; color: var(--ink-soft, #6e6e73); }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  li { display: flex; flex-direction: column; gap: 4px; padding: 8px; border: 1px solid var(--line, #e3e3e6); border-radius: var(--ui-radius-md, 6px); }
  li.active { border-color: #0b6bff; }
  li.resolved { opacity: 0.6; }
  .cm-head { display: flex; align-items: center; gap: 6px; font: inherit; cursor: pointer; background: none; border: 0; padding: 0; text-align: left; }
  .cm-num { display: grid; place-items: center; width: 20px; height: 20px; font-size: 11px; font-weight: 600; color: var(--paper, #fff); background: var(--ink, #1d1d1f); border-radius: 9999px; }
  .cm-who { font-size: 12.5px; font-weight: 600; }
  .cm-tag { font-size: 11px; color: var(--ink-soft, #6e6e73); }
  .cm-body, .cm-reply { margin: 0; font-size: 13px; overflow-wrap: anywhere; }
  .cm-reply { padding-left: 8px; border-left: 2px solid var(--line, #e3e3e6); }
  .cm-btn { font: inherit; font-size: 12px; font-weight: 600; padding: 4px 8px; cursor: pointer; background: var(--paper-2, #f5f5f7); color: var(--ink, #1d1d1f); border: 1px solid var(--line, #e3e3e6); border-radius: var(--ui-radius-sm, 4px); }
  .cm-btn.primary { background: var(--ink, #1d1d1f); color: var(--paper, #fff); }
  .cm-btn:disabled { opacity: 0.4; cursor: default; }
  .cm-edit { display: flex; flex-direction: column; gap: 6px; }
  .cm-own { display: flex; gap: 10px; }
  .cm-pick { align-self: flex-start; font: inherit; font-size: 12px; cursor: pointer; padding: 2px 8px; background: var(--paper-2, #f5f5f7); border: 1px solid var(--line, #e3e3e6); border-radius: var(--ui-radius-sm, 4px); }
  .cm-link { align-self: flex-start; font: inherit; font-size: 12px; cursor: pointer; background: none; border: 0; padding: 0; color: var(--ink-soft, #6e6e73); text-decoration: underline; }
</style>
