<script lang="ts">
  import { lower } from '../lower';
  import InstallCta from '../InstallCta.svelte';
  import { HERO_HEADLINE } from '../home';
  import { DOWNLOAD_PATH } from '../links';
  import AsciiField from './AsciiField.svelte';
  import { FieldFit } from '../ascii-field';
  import EditorMock from '../EditorMock.svelte';
  import TerminalMock from './TerminalMock.svelte';
  import WorksWith from './WorksWith.svelte';
  import { LEAD_AGENTS, LEAD_EDITORS, type AgentChip, type LeadChip } from './works-with';

  import { MockWindow as Window } from './mock-window';
  import { HeadlineSize } from './headline-size';
  import type { Snippet } from 'svelte';

  let { headline = HERO_HEADLINE, size = HeadlineSize.Display, lead, art }: { headline?: string; size?: HeadlineSize; lead?: Snippet; art?: Snippet } = $props();

  const MOCK_WIDTH = 960;
  const NARROW_FIT_MAX = 400;
  const NARROW_VIEW = { x: 200, y: 82, width: 400 } as const;
  const NARROW_ASPECT = 0.9;

  let front = $state(Window.Editor);

  function raise(w: Window, e: KeyboardEvent | MouseEvent) {
    if (e instanceof KeyboardEvent && e.key !== 'Enter' && e.key !== ' ') {
      return;
    }
    front = w;
  }

  let fitWidth = $state(MOCK_WIDTH);
  let mockHeight = $state(0);

  const narrow = $derived(fitWidth <= NARROW_FIT_MAX);
  const scale = $derived(fitWidth / (narrow ? NARROW_VIEW.width : MOCK_WIDTH));
  const fitHeight = $derived(narrow ? fitWidth * NARROW_ASPECT : mockHeight * scale);
  const shift = $derived(narrow ? `translate(${-NARROW_VIEW.x * scale}px, ${-NARROW_VIEW.y * scale}px) ` : '');
</script>

<svelte:head>
  <link rel="preload" href="/site/fonts/instrument-serif-latin.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

{#snippet chip(c: LeadChip)}<a class="chip" href={c.item.href}><span class="icon">{@html c.item.icon}</span><b>{c.name}</b></a>{/snippet}

{#snippet agents(list: readonly AgentChip[], joiner: string)}{#each list as c, i}{#if i > 0}{i === list.length - 1 ? ` ${joiner} ` : ', '}{/if}<span class="chip"><span class="icon">{@html c.icon}</span><b>{c.name}</b></span>{/each}{/snippet}

{#snippet chips(list: readonly LeadChip[], joiner: string)}{#each list as c, i}{#if i > 0}{i === list.length - 1 ? ` ${joiner} ` : ', '}{/if}{@render chip(c)}{/each}{/snippet}

<section class="hero" id="hero">
  <a class="platforms" href={DOWNLOAD_PATH} aria-label="Available on macOS, Windows and Linux: download">
    <span>available on</span>
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" role="img"><title>macOS</title><path d="M16.37 12.62c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.78 1.3 10.33.86 1.25 1.89 2.65 3.24 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.38.82 1.4-.03 2.28-1.27 3.13-2.52.99-1.45 1.4-2.85 1.42-2.92-.03-.01-2.72-1.04-2.75-4.14zM13.8 4.98c.71-.87 1.19-2.07 1.06-3.27-1.03.04-2.27.68-3.01 1.55-.66.77-1.24 2-1.09 3.18 1.14.09 2.31-.58 3.04-1.46z"/></svg>
    <i aria-hidden="true"></i>
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" role="img"><title>Windows</title><path d="M3 5.5l7.5-1v7H3zM11.5 4.35L21 3v8.5h-9.5zM3 12.5h7.5v7L3 18.5zM11.5 12.5H21V21l-9.5-1.35z"/></svg>
    <i aria-hidden="true"></i>
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" role="img"><title>Linux</title><path d="M12 2.5c-2 0-3.4 1.8-3.4 4.3 0 1.3.2 2.3-.5 3.5-.9 1.5-2.6 3.6-2.6 6 0 .9.3 1.6.8 2.1-.4.6-1 .9-1.7 1.2-.7.3-.4 1 .3 1.2 1 .3 2.2.2 2.9.9.6.6 1.4 1.2 2.4 1.2 1 0 1.5-.5 2.3-.5s1.3.5 2.3.5c1 0 1.8-.6 2.4-1.2.7-.7 1.9-.6 2.9-.9.7-.2 1-.9.3-1.2-.7-.3-1.3-.6-1.7-1.2.5-.5.8-1.2.8-2.1 0-2.4-1.7-4.5-2.6-6-.7-1.2-.5-2.2-.5-3.5 0-2.5-1.4-4.3-3.4-4.3zm-1.4 4.3c.4 0 .7.5.7 1s-.3.9-.7.9-.7-.4-.7-.9.3-1 .7-1zm2.8 0c.4 0 .7.5.7 1s-.3.9-.7.9-.7-.4-.7-.9.3-1 .7-1zM12 9c1 0 1.9.6 1.9 1.1S13 11.4 12 11.4s-1.9-.7-1.9-1.2S11 9 12 9z"/></svg>
  </a>

  <h1 class="site-display" class:compact={size === HeadlineSize.Compact} data-agent-id="hero-title">{lower(headline)}</h1>

  <p class="lead" data-agent-id="hero-lead">
    {#if lead}
      {@render lead()}
    {:else}
      edit your running app like in figma, inside the
      {@render chips(LEAD_EDITORS, 'or')}
      you already use. works with
      {@render agents(LEAD_AGENTS, 'and')}: you design, your agent codes, same files, every change a diff.
    {/if}
  </p>

  <InstallCta id="hero-install" />

  {#if art}
    <div class="art">{@render art()}</div>
  {:else}
  <div class="fit" class:cropped={narrow} bind:clientWidth={fitWidth} style:height="{fitHeight}px">
    <div class="mock" bind:offsetHeight={mockHeight} style:transform="{shift}scale({scale})">
      <AsciiField fit={FieldFit.Box} />
      <div class="term" class:front={front === Window.Terminal} role="button" tabindex="0" aria-label="Bring the terminal to front" onclick={(e) => raise(Window.Terminal, e)} onkeydown={(e) => raise(Window.Terminal, e)}><TerminalMock /></div>
      <div class="win" class:front={front === Window.Editor} role="button" tabindex="0" aria-label="Bring the editor to front" onclick={(e) => raise(Window.Editor, e)} onkeydown={(e) => raise(Window.Editor, e)}><EditorMock /></div>
    </div>
  </div>
  {/if}

  <WorksWith />
</section>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 430px;
    margin: 0 auto;
    padding: 140px 20px 0;
    position: relative;
    text-align: center;
  }

  .platforms {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 24px;
    padding: 8px 16px;
    border-radius: 9999px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.08);
    font-size: 15px;
    color: rgba(255, 255, 255, 0.6);
    white-space: nowrap;
    text-decoration: none;
    transition: background 0.15s;
  }

  .platforms:hover {
    background: rgba(255, 255, 255, 0.14);
  }

  .platforms svg {
    color: #fff;
    flex: none;
  }

  .platforms i {
    width: 3px;
    height: 3px;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.4);
  }

  h1 {
    font-size: clamp(56px, 18vw, 84px);
    line-height: 0.95;
    text-wrap: balance;
  }

  .lead {
    margin-top: 22px;
    line-height: 1.9;
    color: rgba(255, 255, 255, 0.8);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 1px 6px;
    border-radius: var(--ui-radius-md, 6px);
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    text-decoration: none;
    vertical-align: middle;
    line-height: 1.4;
  }

  .chip:hover {
    background: rgba(255, 255, 255, 0.18);
  }

  .chip .icon {
    display: inline-flex;
    width: 18px;
    height: 18px;
  }

  .chip :global(svg) {
    width: 18px;
    height: 18px;
  }

  .hero > :global(.install) {
    margin-top: 28px;
  }


  .fit {
    width: 100%;
    max-width: var(--site-max);
    margin: 36px auto 0;
  }

  .fit.cropped {
    overflow: hidden;
    border-radius: var(--ui-radius-lg, 10px);
  }

  .art {
    width: 100%;
    max-width: var(--site-max);
    margin: 36px auto 0;
    border-radius: var(--ui-radius-lg, 10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .art :global(img) {
    display: block;
    width: 100%;
    height: auto;
  }

  .mock {
    position: relative;
    width: 960px;
    box-sizing: border-box;
    padding: 40px 40px 56px;
    transform-origin: top left;
    border-radius: var(--ui-radius-lg, 10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: #0d0d0d;
    overflow: hidden;
  }

  .mock .win {
    position: relative;
    z-index: 1;
    width: 84%;
    margin: 0 16% 110px 0;
  }

  .mock .term {
    position: absolute;
    z-index: 1;
    bottom: 40px;
    right: 40px;
    width: 58%;
    height: 440px;
  }

  .mock .win,
  .mock .term {
    cursor: pointer;
    outline: none;
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .mock .front {
    z-index: 2;
    cursor: default;
  }

  .mock .win:not(.front):hover,
  .mock .term:not(.front):hover {
    transform: translateY(-4px);
  }

  h1.compact {
    font-size: clamp(36px, 9vw, 52px);
    line-height: 1;
  }

  @media (min-width: 1200px) {
    .hero {
      max-width: var(--site-max);
      padding: 150px 20px 0;
    }

    h1 {
      font-size: 80px;
      line-height: 64px;
    }

    h1.compact {
      font-size: 60px;
      line-height: 60px;
      max-width: 1000px;
    }

    .lead {
      width: 640px;
      font-size: 16px;
    }
  }

  @media (min-width: 810px) and (max-width: 1199.98px) {
    .hero {
      max-width: none;
      padding: 150px 24px 0;
    }

    h1 {
      font-size: 80px;
      line-height: 64px;
    }

    h1.compact {
      font-size: 52px;
      line-height: 54px;
    }

    .lead {
      width: 600px;
      font-size: 16px;
    }
  }


  @media (max-width: 809.98px) {
    .lead {
      font-size: 16px;
    }
  }
</style>
