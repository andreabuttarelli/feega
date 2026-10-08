<script lang="ts">
  import PageTitle from '$lib/components/PageTitle.svelte';
  import { goto } from '$app/navigation';
  import Orbit from '@lucide/svelte/icons/orbit';
  import PageHead from '$lib/components/PageHead.svelte';
  import TemplatePreview from '$lib/components/compose/TemplatePreview.svelte';
  import { LAYOUTS } from '$lib/canvas/composition/index';
  import { COMPOSITION_LAYOUTS } from '$lib/motion/components';
  import { FORMATS, MOTION_FORMATS, MotionFormat } from '$lib/motion/doc';
  import { formatLastEdited } from '$lib/canvas/format-last-edited';

  let { data, form } = $props();

  let format = $state<MotionFormat>(MotionFormat.Vertical);
  const ratio = $derived(`${FORMATS[format].width} / ${FORMATS[format].height}`);
</script>

<svelte:head><title>Compositions · feega</title></svelte:head>

<div class="compose-hub">
  <PageHead title="Compositions" subtitle="Pick a template, drop in images and videos, export a looping 3D video." />
  <PageTitle text="Compositions" />

  <section class="options" aria-label="Project and format">
    <label>
      <span>Project</span>
      <select value={data.projectId} onchange={(e) => goto(`/app/compose?project=${e.currentTarget.value}`)}>
        {#each data.projects as p (p.id)}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
    </label>
    <div class="formats" role="radiogroup" aria-label="Format">
      {#each MOTION_FORMATS as f (f)}
        <button type="button" role="radio" aria-checked={format === f} class:on={format === f} onclick={() => (format = f)}>
          <span class="ratio-glyph" style={`aspect-ratio: ${FORMATS[f].width} / ${FORMATS[f].height}`}></span>
          {FORMATS[f].label}
        </button>
      {/each}
    </div>
  </section>

  {#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

  <section aria-labelledby="templates-heading">
    <h2 id="templates-heading">Templates</h2>
    <ul class="templates" data-testid="compose-templates">
      {#each COMPOSITION_LAYOUTS as layout (layout)}
        <li>
          <form method="POST" action="?/create" class="template">
            <input type="hidden" name="project" value={data.projectId} />
            <input type="hidden" name="layout" value={layout} />
            <input type="hidden" name="format" value={format} />
            <input type="hidden" name="name" value={LAYOUTS[layout].label} />
            <button type="submit" class="template-button" aria-label={`Use ${LAYOUTS[layout].label}`}>
              <span class="stage" style={`aspect-ratio: ${ratio}`}>
                <TemplatePreview {layout} pictures={data.samples} />
              </span>
              <span class="template-text">
                <span class="template-name">{LAYOUTS[layout].label}</span>
                <span class="muted">{LAYOUTS[layout].description}</span>
              </span>
            </button>
          </form>
        </li>
      {/each}
    </ul>
  </section>

  <section aria-labelledby="recent-heading">
    <h2 id="recent-heading">Your compositions</h2>
    {#if data.recent.length}
      <ul class="recent" data-testid="compose-recent">
        {#each data.recent as item (item.id)}
          <li>
            <a href={item.href} class="recent-item">
              <Orbit size={16} strokeWidth={1.6} />
              <span class="recent-name">{item.name}</span>
              <span class="muted">{LAYOUTS[item.layout].label} · {formatLastEdited(item.updatedAt)}</span>
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted">Nothing yet. Pick a template above, or open a composition node from a canvas.</p>
    {/if}
  </section>
</div>

<style>
  .compose-hub {
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
    color: var(--ui-ink);
  }

  .muted {
    font-size: 12px;
    color: var(--ui-ink-2);
  }

  .error {
    margin: 0;
    font-size: 12.5px;
    color: var(--color-destructive, #c0392b);
  }

  .options {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 16px;
    padding: 16px;
    border: 1px solid var(--ui-line);
    background: var(--ui-bg);
  }

  .options label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--ui-ink-2);
  }

  .options select {
    height: 32px;
    min-width: 200px;
    padding: 0 8px;
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font-size: 13px;
  }

  .formats {
    display: flex;
    border: 1px solid var(--ui-line-strong);
  }

  .formats button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    font-size: 12.5px;
    color: var(--ui-ink-2);
    background: var(--ui-bg);
    border-right: 1px solid var(--ui-line-strong);
    cursor: pointer;
  }

  .formats button:last-child {
    border-right: 0;
  }

  .formats button.on {
    background: var(--ui-accent-wash);
    color: var(--ui-accent);
  }

  .ratio-glyph {
    display: inline-block;
    height: 12px;
    border: 1.5px solid currentColor;
  }

  .templates {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  .template {
    margin: 0;
    height: 100%;
  }

  .template-button {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 1px solid var(--ui-line);
    background: var(--ui-bg);
    color: var(--ui-ink);
    text-align: left;
    cursor: pointer;
  }

  .template-button:hover,
  .template-button:focus-visible {
    border-color: var(--ui-ink);
  }

  .stage {
    display: block;
    width: 100%;
    max-height: 340px;
    overflow: hidden;
    background: #000;
  }

  .template-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px 12px;
  }

  .template-name {
    font-size: 13px;
    font-weight: 600;
  }

  .recent {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--ui-line);
    background: var(--ui-bg);
  }

  .recent li + li {
    border-top: 1px solid var(--ui-line);
  }

  .recent-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    color: var(--ui-ink);
    text-decoration: none;
  }

  .recent-item:hover {
    background: var(--ui-surface);
  }

  .recent-name {
    font-size: 13px;
    font-weight: 600;
  }

  @media (max-width: 640px) {
    .options select {
      min-width: 0;
      width: 100%;
    }

    .options label,
    .formats {
      flex: 1 1 100%;
    }

    .formats button {
      flex: 1;
      justify-content: center;
      padding: 0 6px;
    }

    .templates {
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }

    .stage {
      max-height: 260px;
    }
  }
</style>
