<script lang="ts">
  import FeegaMark from '$lib/components/FeegaMark.svelte';
  import Wordmark from '$lib/components/app/Wordmark.svelte';

  let { data } = $props();

  const endedOn = $derived(new Date(data.endedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }));
</script>

<svelte:head>
  <title>{data.projectName} - Feega</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="page">
  <header>
    <a class="lockup" href="/" aria-label="feega"><FeegaMark size={24} /><Wordmark /></a>
    <div class="title">
      <h1>{data.projectName}</h1>
      <p>Session ended {endedOn}. Read only.</p>
    </div>
  </header>

  <div class="body">
    <section class="snapshot">
      {#if data.snapshot}
        <iframe title="Snapshot of {data.projectName}" src="/s/{data.sid}/snapshot/index.html" sandbox=""></iframe>
      {:else}
        <p class="empty">No snapshot was saved for this session.</p>
      {/if}
    </section>

    <aside class="comments">
      <h2>Comments</h2>
      {#if data.comments.length === 0}
        <p class="empty">No comments.</p>
      {:else}
        <ul>
          {#each data.comments as comment (comment.id)}
            <li class:resolved={comment.resolvedAt} class:reply={comment.parentId}>
              <div class="meta">
                <strong>{comment.authorName}</strong>
                {#if comment.resolvedAt}<span class="tag">resolved</span>{/if}
              </div>
              <p>{comment.body}</p>
              <code>{comment.sourceFile}:{comment.sourceLine}</code>
            </li>
          {/each}
        </ul>
      {/if}
    </aside>
  </div>
</main>

<style>
  .page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-4);
    padding: var(--ui-space-4);
    box-sizing: border-box;
    background: var(--ui-app);
    color: var(--ui-text);
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--ui-space-6);
    flex-wrap: wrap;
  }
  .lockup {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    text-decoration: none;
    line-height: 1;
    --wordmark-size: 22px;
  }
  h1 {
    margin: 0;
    font-size: var(--ui-text-xl, 20px);
    font-weight: var(--ui-weight-medium);
  }
  .title p {
    margin: 2px 0 0;
    font-size: 13px;
    color: var(--ui-text-tertiary);
  }
  .body {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: var(--ui-space-4);
    min-height: 0;
  }
  .snapshot {
    min-height: 60dvh;
    background: var(--ui-panel);
    border-radius: var(--ui-radius-lg);
    box-shadow: var(--ui-shadow-raised);
    overflow: hidden;
    display: flex;
  }
  iframe {
    flex: 1;
    width: 100%;
    border: 0;
    background: white;
  }
  .comments {
    padding: var(--ui-space-4);
    background: var(--ui-panel);
    border-radius: var(--ui-radius-lg);
    box-shadow: var(--ui-shadow-raised);
    overflow-y: auto;
  }
  h2 {
    margin: 0 0 var(--ui-space-3);
    font-size: 13px;
    font-weight: var(--ui-weight-medium);
    color: var(--ui-text-tertiary);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3);
  }
  li p {
    margin: 4px 0;
    font-size: 14px;
    line-height: 1.4;
  }
  li.reply {
    margin-left: var(--ui-space-4);
  }
  li.resolved {
    opacity: 0.6;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    font-size: 13px;
  }
  .tag {
    color: var(--ui-text-tertiary);
  }
  code {
    font-size: 12px;
    color: var(--ui-text-secondary);
    word-break: break-all;
  }
  .empty {
    margin: auto;
    padding: var(--ui-space-4);
    font-size: 14px;
    color: var(--ui-text-tertiary);
  }
  @media (max-width: 800px) {
    .body {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
