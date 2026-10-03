<script lang="ts">
  import { goto } from '$app/navigation';
  import Film from '@lucide/svelte/icons/film';
  import Plus from '@lucide/svelte/icons/plus';
  import PageHead from '$lib/components/PageHead.svelte';
  import { formatLastEdited } from '$lib/canvas/format-last-edited';

  let { data, form } = $props();
</script>

<svelte:head><title>Motion editor · feega</title></svelte:head>

<div class="motion-hub">
  <PageHead title="Motion editor" subtitle="Short videos from titles, media and 3D. Each video lives as a node on a canvas." />

  <section class="new" aria-labelledby="new-heading">
    <h2 id="new-heading">New video</h2>
    <form method="POST" action="?/create" class="new-form" data-testid="motion-new">
      <label>
        <span>Project</span>
        <select name="project" value={data.projectId} onchange={(e) => goto(`/app/motion?project=${e.currentTarget.value}`)}>
          {#each data.projects as p (p.id)}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Canvas</span>
        <select name="canvas">
          <option value="">Motion canvas (created if missing)</option>
          {#each data.canvases as c (c.id)}
            <option value={c.id}>{c.name}</option>
          {/each}
        </select>
      </label>
      <label class="grow">
        <span>Name</span>
        <input name="name" placeholder="Untitled video" maxlength="80" />
      </label>
      <button type="submit" class="primary"><Plus size={14} /> Create</button>
    </form>
    {#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
  </section>

  <section aria-labelledby="videos-heading">
    <h2 id="videos-heading">Videos</h2>
    {#if data.motions.length}
      <ul class="videos" data-testid="motion-list">
        {#each data.motions as motion (motion.id)}
          <li>
            <a href={motion.href} class="video">
              <span class="poster">
                {#if motion.poster}<img src={motion.poster} alt="" loading="lazy" />{:else}<Film size={22} strokeWidth={1.5} />{/if}
              </span>
              <span class="video-name">{motion.name}</span>
              <span class="muted">{motion.projectName} · {formatLastEdited(motion.updatedAt)}</span>
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted">No videos yet. Create one above, or add a Motion node to any canvas.</p>
    {/if}
  </section>
</div>

<style>
  .motion-hub {
    max-width: 1120px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  h2 {
    margin: 0 0 12px;
    font-size: 15px;
    font-weight: 600;
    color: var(--ink);
  }

  .muted {
    font-size: 12px;
    color: var(--ink-soft);
  }

  .new {
    padding: 16px;
    border: 1px solid var(--line);
    background: var(--paper);
  }

  .new-form {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 12px;
  }

  .new-form label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--ink-soft);
  }

  .new-form .grow {
    flex: 1 1 200px;
  }

  .new-form select,
  .new-form input {
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--line-2);
    background: var(--paper);
    color: var(--ink);
    font-size: 13px;
  }

  .primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    border: 1px solid var(--ink);
    background: var(--ink);
    color: var(--paper);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .error {
    margin: 8px 0 0;
    font-size: 12.5px;
    color: var(--color-destructive, #c0392b);
  }

  .videos {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  }

  .video {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-bottom: 10px;
    border: 1px solid var(--line);
    background: var(--paper);
    color: var(--ink);
    text-decoration: none;
  }

  .video:hover {
    border-color: var(--ink);
  }

  .poster {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 9 / 12;
    background: var(--paper-3);
    color: var(--ink-faint);
    overflow: hidden;
  }

  .poster img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .video-name,
  .video .muted {
    padding: 0 10px;
  }

  .video-name {
    font-size: 13px;
    font-weight: 600;
  }

  @media (max-width: 640px) {
    .new-form label {
      flex: 1 1 100%;
    }

    .videos {
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
  }
</style>
