<script lang="ts">
  import { lower } from '../lower';
  import { MOTION } from '../motion';
  import { GENERATE } from '../generate';
  import MotionLoop from '../motion/MotionLoop.svelte';
  import GenerateLoop from '../generate/GenerateLoop.svelte';

  const EXTRAS = [
    { copy: MOTION, Art: MotionLoop },
    { copy: GENERATE, Art: GenerateLoop }
  ];
</script>

<section class="extras site-wide" id="extras" data-agent-id="extras">
  <h2>also on the canvas</h2>

  <div class="boxes">
    {#each EXTRAS as { copy, Art } (copy.heading)}
      <a class="box" href={copy.more.href}>
        <div class="art"><Art /></div>
        <span class="title">{lower(copy.heading)}</span>
        <p>{lower(copy.lead)}</p>
        <span class="more">{lower(copy.more.label)} →</span>
      </a>
    {/each}
  </div>
</section>

<style>
  .extras {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 64px 20px;
  }

  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: rgb(255 255 255 / 0.6);
  }

  .boxes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .box {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 18px;
    border-radius: 20px;
    background: rgb(18 18 18 / 0.72);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.07);
    color: #fff;
    text-decoration: none;
  }

  .box:hover {
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.18);
  }

  .art {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 220px;
    margin: 8px 0 12px;
  }

  .art :global(svg) {
    width: auto;
    max-width: 100%;
    max-height: 100%;
  }

  .title {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  p {
    margin: 0;
    font-size: 13px;
    line-height: 1.4;
    color: rgb(255 255 255 / 0.6);
  }

  .more {
    margin-top: auto;
    font-size: 13px;
  }

  @media (max-width: 809.98px) {
    .boxes {
      grid-template-columns: 1fr;
    }
  }
</style>
