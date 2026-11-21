<script lang="ts">
  import type { CloudComment, CommentDraft } from '../host/cloud-api';
  import type { Pick, Source } from '../messages';
  import { draftOf, sourceOfComment, threadsOf } from './comments';

  type CommentsState = { enabled: boolean; comments: CloudComment[]; error: string };

  let { cloud, picked, composing, onsubmit, oncancel, onresolve, onselect, oncopy }: { cloud: CommentsState; picked: Pick | null; composing: boolean; onsubmit: (draft: CommentDraft) => void; oncancel: () => void; onresolve: (id: string) => void; onselect: (source: Source) => void; oncopy: (comment: CloudComment, replies: CloudComment[]) => void } = $props();

  let showResolved = $state(false);
  let text = $state('');
  let replyingTo = $state<string | null>(null);
  let replyText = $state('');

  const threads = $derived(threadsOf(cloud.comments, showResolved));
  const open = $derived(threadsOf(cloud.comments, false).length);
  const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const placeOf = (c: CloudComment) => `${c.sourceFile.split('/').pop()}:${c.sourceLine}`;

  function send() {
    const draft = draftOf(picked, text);
    if (!draft) {
      return;
    }
    onsubmit(draft);
    text = '';
  }

  function reply(root: CloudComment) {
    const draft = draftOf(null, replyText, root);
    if (!draft) {
      return;
    }
    onsubmit(draft);
    replyText = '';
    replyingTo = null;
  }

  function submitOnEnter(e: KeyboardEvent, run: () => void) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      run();
    }
  }
</script>

<div class="comments" data-testid="comments">
  {#if !cloud.enabled}
    <p class="empty" data-testid="comments-hint">Comments need a shared session. Share this project from your coding agent (feega_share) to turn them on.</p>
  {:else}
    <header>
      <span>{open} open</span>
      <button type="button" class="link" data-testid="comments-resolved-toggle" onclick={() => (showResolved = !showResolved)}>{showResolved ? 'Hide resolved' : 'Show resolved'}</button>
    </header>
    {#if cloud.error}<p class="error" role="alert" data-testid="comments-error">{cloud.error}</p>{/if}
    {#if composing && picked}
      <div class="composer" data-testid="comment-composer">
        <span class="target">&lt;{picked.tag}&gt; {picked.source.file.split('/').pop()}:{picked.source.line}</span>
        <!-- svelte-ignore a11y_autofocus -->
        <textarea bind:value={text} rows="3" placeholder="Leave a comment" aria-label="Comment" data-testid="comment-input" autofocus onkeydown={(e) => submitOnEnter(e, send)}></textarea>
        <div class="actions">
          <button type="button" class="link" onclick={oncancel}>Cancel</button>
          <button type="button" class="send" data-testid="comment-send" disabled={!text.trim()} onclick={send}>Comment</button>
        </div>
      </div>
    {/if}
    {#if !threads.length && !composing}<p class="empty">No open comments. Select an element and press C to leave one.</p>{/if}
    {#each threads as thread (thread.root.id)}
      <div class="thread" class:resolved={thread.root.resolvedAt !== null} data-testid="comment-thread">
        <button type="button" class="what" onclick={() => onselect(sourceOfComment(thread.root))}>
          <strong>{thread.root.authorName}</strong>
          <span class="meta">{placeOf(thread.root)} · {timeOf(thread.root.createdAt)}</span>
          <span class="body">{thread.root.body}</span>
        </button>
        {#each thread.replies as r (r.id)}
          <div class="reply"><strong>{r.authorName}</strong> <span class="meta">{timeOf(r.createdAt)}</span><span class="body">{r.body}</span></div>
        {/each}
        {#if replyingTo === thread.root.id}
          <textarea bind:value={replyText} rows="2" placeholder="Reply" aria-label="Reply" data-testid="reply-input" onkeydown={(e) => submitOnEnter(e, () => reply(thread.root))}></textarea>
          <div class="actions">
            <button type="button" class="link" onclick={() => (replyingTo = null)}>Cancel</button>
            <button type="button" class="send" data-testid="reply-send" disabled={!replyText.trim()} onclick={() => reply(thread.root)}>Reply</button>
          </div>
        {:else}
          <div class="actions">
            {#if thread.root.resolvedAt === null}
              <button type="button" class="link" data-testid="comment-reply" onclick={() => (replyingTo = thread.root.id)}>Reply</button>
              <button type="button" class="link" data-testid="comment-resolve" onclick={() => onresolve(thread.root.id)}>Resolve</button>
            {:else}
              <span class="meta">Resolved</span>
            {/if}
            <button type="button" class="link" data-testid="comment-copy" title="Copy the comment and its source for your coding agent" onclick={() => oncopy(thread.root, thread.replies)}>Copy for agent</button>
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .comments {
    display: flex;
    flex-direction: column;
    font-size: var(--ui-text-sm);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--ui-divider);
    color: var(--ui-text-2);
  }

  .thread,
  .composer {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--ui-divider);
  }

  .thread.resolved {
    opacity: 0.6;
  }

  .what {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 8px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ui-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .body {
    width: 100%;
    overflow-wrap: anywhere;
    color: var(--ui-text);
  }

  .reply {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 8px;
    padding-left: 10px;
    border-left: 2px solid var(--ui-divider);
  }

  .meta,
  .target {
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 6px 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    box-shadow: 0 0 0 1px var(--ui-divider);
    color: inherit;
    font: inherit;
    font-size: var(--ui-text-sm);
    resize: vertical;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
  }

  .actions .meta {
    margin-right: auto;
  }

  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--ui-accent);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .send {
    height: 24px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-accent);
    color: #fff;
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .send:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .error {
    margin: 0;
    padding: 8px 12px;
    color: #ff453a;
  }

  .empty {
    padding: 12px;
    color: var(--ui-text-2);
  }
</style>
