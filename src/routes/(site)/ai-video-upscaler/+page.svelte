<script lang="ts">
  import '$lib/site/landing/landing.css';
  import { UPSCALER, upscalerJsonLd } from '$lib/site/landing/upscaler';

  const MIDDLE = 50;

  let split = $state(MIDDLE);
  let before = $state<HTMLVideoElement>();
  let after = $state<HTMLVideoElement>();

  function play() {
    before?.play();
    after?.play();
  }
</script>

<svelte:head>
  <title>{UPSCALER.title}</title>
  <meta name="description" content={UPSCALER.description} />
  <meta property="og:title" content={UPSCALER.title} />
  <meta property="og:description" content={UPSCALER.description} />
  <meta name="twitter:title" content={UPSCALER.title} />
  <meta name="twitter:description" content={UPSCALER.description} />
  {@html upscalerJsonLd()}
</svelte:head>

{#snippet button()}
  <a class="landing-cta" href={UPSCALER.cta.href} target="_blank" rel="noopener">{UPSCALER.cta.label}</a>
{/snippet}

<article class="landing">
  <h1>AI Video Upscaler</h1>
  <p class="intro">
    feega upscales a video clip to 2× or 4K with FLUX Video Upscale. Upload an MP4 of up to 20 seconds, see the output size and
    the price before you run it, then compare before and after and download the sharper clip.
  </p>
  {@render button()}
  <p class="fine">MP4 · up to 20 s · up to 1440p in · 4K out · from 25 credits per second</p>

  <section>
    <h2>Real example: 480p upscaled 2×</h2>
    <figure class="compare" aria-label="Before and after: a 480p animated forest clip and the same clip upscaled 2× by FLUX Video Upscale">
      <video bind:this={after} src={UPSCALER.media.after} poster={UPSCALER.media.poster} muted loop playsinline preload="none" aria-label="After: upscaled 2x to 1708×960"></video>
      <video
        bind:this={before}
        class="before"
        style:clip-path="inset(0 {100 - split}% 0 0)"
        src={UPSCALER.media.before}
        poster={UPSCALER.media.poster}
        muted
        loop
        playsinline
        preload="none"
        aria-label="Before: original 854×480"
      ></video>
      <span class="tag">Before · 480p</span>
      <span class="tag right">After · 2×</span>
      <div class="divider" style:left="{split}%"></div>
      <input type="range" min="0" max="100" bind:value={split} aria-label="Move the divider between before and after" />
      <button type="button" onclick={play}>▶ Play example</button>
    </figure>
    <p class="fine caption">
      Real output: 854×480 → 1708×960 (2×, Precise), 46 credits. Drag the divider to compare. Big Buck Bunny © Blender Foundation,
      <a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>.
    </p>
    {@render button()}
  </section>

  <section>
    <h2>How it works</h2>
    <ol>
      <li>Upload an MP4 or pick a video already in your project.</li>
      <li>Choose 2× or 4K and Precise or Creative. The page shows the output size and the price.</li>
      <li>Run it. In a few minutes compare before and after with the slider and download.</li>
    </ol>
  </section>

  <section>
    <h2>Specs and price</h2>
    <dl class="specs">
      {#each UPSCALER.specs as [term, value] (term)}
        <div><dt>{term}</dt><dd>{value}</dd></div>
      {/each}
    </dl>
  </section>

  <section>
    <h2>What it is good at</h2>
    <div class="body">
      <p>Short clips for social media, ads and product videos that were exported too small or compressed too hard.</p>
      <p>AI-generated clips: generate fast at a lower resolution, then upscale only the take you keep.</p>
      <p>
        The upscaler does not change the duration or the framing: it inherits both from the source clip. Clips longer than 20 seconds
        need to be cut first.
      </p>
    </div>
  </section>

  <section>
    <h2>Compared with other upscalers</h2>
    <div class="table">
      {#each UPSCALER.comparison as row (row[0])}
        <div class="tr">
          {#each row as cell, i (i)}
            <span>{cell}</span>
          {/each}
        </div>
      {/each}
    </div>
    <p class="after-table">For long films, denoising or frame-rate conversion, a desktop tool like Topaz is the better fit.</p>
  </section>

  <section>
    <h2>Questions</h2>
    <div class="body">
      {#each UPSCALER.faq as [q, a] (q)}
        <h3>{q}</h3>
        <p>{a}</p>
      {/each}
    </div>
    {@render button()}
  </section>

  <section>
    <h2>More on feega</h2>
    <div class="body">
      {#each UPSCALER.more as [href, label] (href)}
        <p><a {href}>{label}</a></p>
      {/each}
    </div>
  </section>
</article>

<style>
  .compare {
    position: relative;
    overflow: hidden;
    aspect-ratio: 920 / 518;
    background: #000;
  }

  .compare video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .tag {
    position: absolute;
    top: 12px;
    left: 12px;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    line-height: 1.2;
    font-weight: 500;
    font-variation-settings: normal;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .tag.right {
    left: auto;
    right: 12px;
  }

  .divider {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: #fff;
  }

  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: ew-resize;
  }

  button {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 12px 20px;
    background: #ff4400;
    color: #000;
    border: 0;
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    line-height: 1;
    font-weight: 600;
    letter-spacing: normal;
    cursor: pointer;
  }

  .caption {
    margin-top: 19px;
  }

  ol {
    list-style: decimal inside;
    padding: 0;
  }

  .specs > div,
  .tr {
    display: grid;
    column-gap: 16px;
    padding: 12px 0;
    box-shadow: inset 0 1px var(--site-line);
  }

  .specs > div {
    grid-template-columns: 110px 1fr;
  }

  dd {
    margin: 0;
  }

  .table {
    overflow-x: auto;
  }

  .tr {
    grid-template-columns: 100px repeat(4, 149px);
    width: max-content;
  }

  .after-table {
    margin-top: 20px;
  }

  @media (min-width: 1200px) {
    .tr {
      grid-template-columns: 100px repeat(4, 1fr);
      width: auto;
    }
  }
</style>
