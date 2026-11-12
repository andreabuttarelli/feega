<script lang="ts">
  import type { Snippet } from 'svelte';

  let { eyebrow, heading, text, media }: { eyebrow: string; heading: string; text: string; media: Snippet } = $props();
</script>

<div class="pair">
  <div class="text">
    <p class="eyebrow">{eyebrow}</p>
    <h3>{heading}</h3>
    <p class="body">{text}</p>
  </div>
  <div class="media">{@render media()}</div>
</div>

<style>
  .pair {
    display: grid;
    gap: 32px;
    color: var(--site-ink);
  }

  p,
  h3 {
    margin: 0;
  }

  .eyebrow {
    color: #ff5100;
  }

  h3 {
    margin-top: 16px;
    font-size: 22px;
    line-height: 26px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .body {
    margin-top: 12px;
    opacity: 0.7;
  }

  .media :global(:is(img, video)) {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    object-fit: cover;
  }

  @media (min-width: 810px) {
    .pair {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: center;
      gap: 40px;
    }

    h3 {
      font-size: 26px;
      line-height: 30px;
    }
  }

  @media (min-width: 1200px) {
    h3 {
      font-size: 30px;
      line-height: 36px;
    }
  }
</style>
