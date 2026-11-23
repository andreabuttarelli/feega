<script lang="ts">
  import Glyph from './Glyph.svelte';
  import { Key, type DemoState } from '../demo/script';
  import { Target } from '../demo/scripts';
  import './mock.css';

  let { demo }: { demo: DemoState } = $props();

  const TABS = ['Sections', 'Components', 'App'];
  const THEMES = ['Light', 'Dark'];
  const CARDS = ['Announcement Bar', 'Bento Feature Grid', 'Blog Cards', 'Changelog Timeline'];
</script>

<div class="gm library" data-mock="library">
  <header class="head-bar"><span>Library</span><span class="icon"><Glyph name="close" size={13} /></span></header>

  <div class="tools">
    <span class="search">Search</span>
    <span class="themes">{#each THEMES as theme, i (theme)}<span class:on={i === 0}>{theme}</span>{/each}</span>
  </div>

  <div class="tabs" data-t={Target.LibraryTabs}>{#each TABS as tab, i (tab)}<span class:on={i === 0}>{tab}</span>{/each}</div>

  <div class="grid">
    {#each CARDS as name, i (name)}
      <div class="card" class:lit={demo[Key.Card] === String(i)}>
        <div class="thumb" data-t={i === 0 ? Target.CardThumb : undefined}>
          {#if i === 0}
            <div class="announce"><b>NEW</b><span>Version 2.0 is out, with dark mode and faster loads</span><u>read more</u></div>
          {:else if i === 1}
            <div class="bento">
              <small>FEATURES</small>
              <h4>everything in one place</h4>
              <div class="cells">
                <div class="cell big"><div class="mini"><i></i><i></i><i></i></div><strong>edit where it runs</strong><span>Click anything on the live page and</span></div>
                <div class="cell"><em>instant</em><span>Changes show before you let go of your mouse.</span><i class="bar"></i></div>
                <div class="cell"><em>private</em></div>
              </div>
            </div>
          {:else if i === 2}
            <div class="blog">
              <h4>from the blog</h4>
              <div class="posts"><div class="post"><i></i><b>Shipping slower</b></div><div class="post"><i></i><b>Why tokens</b></div><div class="post"><i></i><b>Design in code</b></div></div>
            </div>
          {:else}
            <div class="blog">
              <h4>changelog</h4>
              <div class="line"><b>2.0</b><span>Dark mode and faster loads</span></div>
              <div class="line"><b>1.9</b><span>Library panel</span></div>
              <div class="line"><b>1.8</b><span>Breakpoint switcher</span></div>
            </div>
          {/if}
        </div>
        <div class="meta"><span class="name">{name}</span><span class="insert" data-t={i === 0 ? Target.CardInsert : undefined}>Insert</span></div>
      </div>
    {/each}
  </div>
</div>

<style>
  .announce {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 17px;
    background: #fbfaf7;
    box-shadow: inset 0 -1px 0 #ece9e2;
    color: #1a1a1a;
    font-size: 6.5px;
  }

  .announce b {
    padding: 1px 3px;
    border-radius: 3px;
    background: #ff5100;
    color: #ffffff;
    font-size: 5px;
  }

  .announce u {
    color: #ff5100;
    text-decoration: none;
  }

  .bento,
  .blog {
    height: 100%;
    padding: 18px 12px 0;
    background: #f7f5f0;
    color: #141414;
  }

  small {
    display: block;
    color: #ff5100;
    font-size: 5px;
    letter-spacing: 0.06em;
  }

  h4 {
    margin: 6px 0 8px;
    font-size: 17px;
    font-weight: 500;
    letter-spacing: -0.045em;
  }

  .cells {
    display: grid;
    grid-template-columns: 1.7fr 1fr;
    grid-template-rows: auto auto;
    gap: 6px;
  }

  .cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 6px;
    border-radius: 6px;
    background: #ebe8e0;
    font-size: 6px;
  }

  .cell.big {
    grid-row: span 2;
    height: 100px;
    justify-content: flex-end;
  }

  .cell em {
    font-size: 7px;
    font-style: normal;
    font-weight: 600;
  }

  .cell strong {
    font-size: 7px;
  }

  .bar {
    display: block;
    height: 3px;
    border-radius: 2px;
    background: #ff5100;
  }

  .mini {
    display: grid;
    gap: 3px;
    margin: 0 auto 10px;
    width: 70px;
    padding: 6px;
    border-radius: 4px;
    background: #ffffff;
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.12);
  }

  .mini i {
    display: block;
    height: 4px;
    border-radius: 1px;
    background: #1a1a1a;
  }

  .mini i + i {
    background: #e6e3dc;
  }

  .posts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .post {
    display: grid;
    gap: 4px;
    font-size: 6px;
  }

  .post i {
    display: block;
    height: 50px;
    border-radius: 4px;
    background: linear-gradient(135deg, #e7a46a, #b4532a);
  }

  .line {
    display: flex;
    gap: 8px;
    padding: 5px 0;
    border-bottom: 1px solid #e6e3dc;
    font-size: 7px;
  }

  .name {
    white-space: nowrap;
  }
</style>
