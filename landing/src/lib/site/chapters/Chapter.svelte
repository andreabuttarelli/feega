<script lang="ts" generics="G extends string">
  import type { Snippet } from 'svelte';
  import { Side, type ChapterCopy, type Step } from '.';
  import AsciiField from '../home/AsciiField.svelte';
  import { FieldFit } from '../ascii-field';

  type Props = {
    copy: ChapterCopy;
    steps: readonly Step<G>[];
    side?: Side;
    number?: string;
    level?: 'h1' | 'h2';
    art: Snippet;
    glyph: Snippet<[G]>;
    footer?: Snippet;
  };

  let { copy, steps, side = Side.Right, number, level = 'h2', art, glyph, footer }: Props = $props();
</script>

<div class="chapter" data-side={side}>
  <div class="intro">
    <div class="text">
      <p class="eyebrow">
        {#if number}<span class="number">{number}</span>{/if}
        {copy.eyebrow}
      </p>
      <svelte:element this={level} class="heading">{copy.heading}</svelte:element>
      <p class="lead">{copy.lead}</p>
      <div class="actions">
        <a class="site-pill start" href={copy.start.href}>{copy.start.label}</a>
        <a class="more" href={copy.more.href}><span>{copy.more.label}</span> →</a>
      </div>
    </div>

    <div class="art">
      <div class="box"><AsciiField fit={FieldFit.Box} /></div>
      <div class="scene">{@render art()}</div>
    </div>
  </div>

  <ol class="steps">
    {#each steps as step (step.glyph)}
      <li>
        <div class="glyph">{@render glyph(step.glyph)}</div>
        <div>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </div>
      </li>
    {/each}
  </ol>

  {#if footer}
    <div class="footer">{@render footer()}</div>
  {/if}
</div>

<style>
  .chapter {
    position: relative;
    z-index: var(--site-z-chapter);
    color: var(--site-ink);
  }

  p,
  h3,
  .heading {
    margin: 0;
  }

  .intro {
    display: grid;
    gap: 56px;
  }

  .eyebrow {
    color: #ff5100;
  }

  .number {
    display: block;
    margin-bottom: 20px;
    color: var(--site-ink);
    font-size: 64px;
    line-height: 0.85;
    letter-spacing: -0.06em;
  }

  .heading {
    margin-top: 16px;
    font-size: 34px;
    line-height: 36px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .lead {
    margin-top: 16px;
    opacity: 0.7;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px 28px;
    margin-top: 32px;
  }

  .start {
    width: auto;
    padding: 0 28px;
  }

  .more span {
    border-bottom: 1px solid var(--site-ink);
  }

  .art {
    position: relative;
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
  }

  .box {
    position: absolute;
    top: 30%;
    right: 6%;
    bottom: 0;
    left: 22%;
    overflow: hidden;
    border-radius: 12px;
    background: #0d0d0d;
  }

  [data-side='left'] .box {
    right: 22%;
    left: 6%;
  }

  .box > :global(.field) {
    opacity: 0.7;
  }

  .scene {
    position: relative;
  }

  .steps {
    display: grid;
    gap: 28px;
    margin: 48px 0 0;
    padding: 0;
    list-style: none;
  }

  .steps li {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    align-items: center;
    gap: 20px;
  }

  h3 {
    font-size: 18px;
    line-height: 21.6px;
    letter-spacing: -0.03em;
    font-weight: 400;
  }

  .steps p {
    margin-top: 6px;
    opacity: 0.6;
  }

  .footer {
    margin-top: 48px;
    padding-top: 32px;
    border-top: 1px solid var(--site-line);
  }

  @media (min-width: 810px) {
    .heading {
      font-size: 40px;
      line-height: 42px;
    }

    .number {
      font-size: 80px;
    }

    .steps {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 32px;
      margin-top: 64px;
    }

    .footer {
      margin-top: 64px;
    }

    .steps li {
      grid-template-columns: none;
      align-items: start;
    }

    .glyph {
      width: 150px;
    }
  }

  @media (min-width: 1200px) {
    .intro {
      grid-template-columns: 440px minmax(0, 1fr);
      align-items: center;
      gap: 40px;
    }

    [data-side='left'] .intro {
      grid-template-columns: minmax(0, 1fr) 440px;
    }

    [data-side='left'] .text {
      order: 1;
    }

    .heading {
      font-size: 46px;
      line-height: 46px;
    }

    .art {
      max-width: 620px;
      margin-right: 0;
    }

    [data-side='left'] .art {
      margin-right: auto;
      margin-left: 0;
    }

    h3 {
      font-size: 20px;
      line-height: 24px;
    }
  }
</style>
