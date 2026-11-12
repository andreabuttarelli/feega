<script lang="ts">
  import { CODEBASE, STEPS } from '.';
  import IsoLoop from './IsoLoop.svelte';
  import IsoGlyph from './IsoGlyph.svelte';
  import Frameworks from './Frameworks.svelte';
  import AsciiField from '../home/AsciiField.svelte';
  import { FieldFit } from '../ascii-field';

  let { level = 'h2' }: { level?: 'h1' | 'h2' } = $props();
</script>

<div class="story">
  <div class="intro">
    <div class="text">
      <p class="eyebrow">{CODEBASE.eyebrow}</p>
      <svelte:element this={level} class="heading">{CODEBASE.heading}</svelte:element>
      <p class="lead">{CODEBASE.lead}</p>
      <div class="actions">
        <a class="site-pill start" href={CODEBASE.start.href}>{CODEBASE.start.label}</a>
        <a class="docs" href={CODEBASE.docs.href}><span>{CODEBASE.docs.label}</span> →</a>
      </div>
    </div>

    <div class="art">
      <div class="box"><AsciiField fit={FieldFit.Box} /></div>
      <div class="scene"><IsoLoop /></div>
    </div>
  </div>

  <ol class="steps">
    {#each STEPS as step (step.glyph)}
      <li>
        <div class="glyph"><IsoGlyph glyph={step.glyph} /></div>
        <div>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </div>
      </li>
    {/each}
  </ol>

  <div class="logos">
    <Frameworks />
  </div>
</div>

<style>
  .story {
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

  .docs span {
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

  .box > :global(.field) {
    opacity: 0.7;
  }

  .scene {
    position: relative;
  }

  .steps {
    display: grid;
    gap: 28px;
    margin: 72px 0 0;
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

  .logos {
    margin-top: 72px;
    padding-top: 32px;
    border-top: 1px solid var(--site-line);
  }

  @media (min-width: 810px) {
    .heading {
      font-size: 40px;
      line-height: 42px;
    }

    .steps {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 32px;
      margin-top: 88px;
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

    .heading {
      font-size: 46px;
      line-height: 46px;
    }

    .art {
      max-width: 620px;
      margin-right: 0;
    }

    h3 {
      font-size: 20px;
      line-height: 24px;
    }
  }
</style>
