<script lang="ts">
  import { lower } from './lower';
  import { LEGAL_DOCS } from './legal';
  import DownloadMac from './DownloadMac.svelte';
  import Mark from './Mark.svelte';
  import { APP_URL, DOCS_URL, MAC_GUIDE_URL, SOCIAL_LINKS, STORY_URL } from './links';
  import { GUIDES_PATH } from './guides';
  import { PRICING_PATH } from './paths';
  import { COMPARE_PATH } from './compare';
  import { CODEBASE_PATH } from './codebase';

  const legal = Object.entries(LEGAL_DOCS).map(([slug, doc]) => ({ href: `/${slug}`, label: doc.label }));
  const year = new Date().getFullYear();
</script>

<footer class="site-foot">
  <div class="top">
    <div class="about">
      <a class="brand" href="/">
        <span class="name"><Mark size={28} />Feega</span>
        <span class="tagline">design in your codebase</span>
      </a>
      <div class="icons">
        {#each SOCIAL_LINKS as social (social.label)}
          <a href={social.href} aria-label={social.label} title={social.label}>{@html social.icon}</a>
        {/each}
      </div>
    </div>

    <nav class="col" aria-label="Product">
      <p class="head">product</p>
      <a href="/">home</a>
      <a href={PRICING_PATH}>pricing</a>
      <a href={CODEBASE_PATH}>codebase</a>
      <a href="/changelog">changelog</a>
      <span class="dl-wrap">
        <DownloadMac class="dl" />
        <a class="dl-guide" href={MAC_GUIDE_URL}>unsigned app? how to open it</a>
      </span>
      <a href={APP_URL}>sign in</a>
    </nav>

    <nav class="col" aria-label="Learn">
      <p class="head">learn</p>
      <a href={DOCS_URL}>docs</a>
      <a href={GUIDES_PATH}>guides</a>
      <a href={COMPARE_PATH}>compare</a>
      <a href={STORY_URL}>blog</a>
    </nav>

    <nav class="col" aria-label="Legal">
      <p class="head">legal</p>
      {#each legal as link (link.href)}
        <a href={link.href}>{lower(link.label)}</a>
      {/each}
    </nav>
  </div>

  <div class="mark-box" aria-hidden="true"><p class="mark">feega</p></div>

  <div class="base">
    <div class="sign">
      <Mark size={28} label="Feega" />
      <p class="copy">
        <span class="rights"><span>© {year} Feega.</span> <span>all rights reserved.</span></span>
        <span class="made"><span>made in Italy,</span> <span>by Andrea Buttarelli.</span></span>
      </p>
    </div>
    <a class="to-top" href="#top">back to top ↑</a>
  </div>

  <div class="legal">
    <p>IT16090491008, Roma, Italy</p>
  </div>

  <p class="notice">
    Feega must never be used to create illegal content, such as CSAM, non-consensual intimate imagery (NCII) or sexual
    deepfakes. Feega does not use Google APIs or Google user data to generate content: Google and GitHub sign-in data is
    used only to authenticate your account.
  </p>
</footer>

<style>
  .site-foot {
    max-width: 430px;
    margin: 0 auto;
    padding: 42px 12px 12px;
    background: #000;
  }

  .top {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 48px 20px;
  }

  .top > * {
    min-width: 0;
    overflow-wrap: break-word;
  }

  .about {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 24px;
  }

  @media (min-width: 600px) {
    .top {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (min-width: 1024px) {
    .top {
      grid-template-columns: minmax(0, 1.6fr) repeat(3, minmax(0, 1fr));
      gap: 32px;
    }

    .about {
      grid-column: auto;
    }
  }

  .brand {
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: #fff;
    text-decoration: none;
  }

  .name {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.04em;
  }

  .tagline {
    font-size: 15px;
    color: rgb(255 255 255 / 0.6);
  }

  .col :global(.dl) {
    padding-bottom: 2px;
  }

  .col :global(.dl svg) {
    width: 0.8em;
    height: 0.8em;
    margin-right: 6px;
    vertical-align: -1px;
  }

  .dl-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .col .dl-guide {
    font-size: 12px;
    line-height: 16px;
    color: rgb(255 255 255 / 0.45);
    text-wrap: balance;
  }

  .col {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .col .head {
    margin-bottom: 6px;
    font-family: 'DM Mono', monospace;
    font-size: 13px;
    line-height: 16px;
    color: rgb(255 255 255 / 0.45);
  }

  .col a,
  .to-top,
  .legal a {
    padding-bottom: 2px;
  }

  .icons {
    display: flex;
    gap: 12px;
  }

  .icons a {
    padding: 0;
  }

  .icons :global(svg) {
    display: block;
    width: 20px;
    height: 20px;
    color: var(--site-ink);
  }

  .mark-box {
    container-type: inline-size;
    margin-top: 151px;
  }

  .mark {
    height: 53.72cqw;
    color: #ff5100;
    font-family: 'DM Sans', sans-serif;
    font-variation-settings: normal;
    font-size: 42.474cqw;
    line-height: 53.72cqw;
    letter-spacing: -0.05em;
    text-align: center;
    white-space: nowrap;
  }

  .base {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 39px;
  }

  .sign {
    display: flex;
    align-items: flex-end;
    gap: 12px;
  }

  .copy {
    max-width: 177px;
  }

  .rights > span {
    display: block;
    color: #fff;
  }

  .made {
    display: block;
  }

  .legal {
    margin-top: 39px;
    opacity: 0.5;
  }

  .legal nav {
    display: flex;
    flex-wrap: wrap;
    column-gap: 12px;
    margin-top: 24px;
  }

  .notice {
    margin-top: 42px;
    font-size: 12px;
    line-height: 12px;
    opacity: 0.5;
  }

  @media (min-width: 1200px) {
    .site-foot {
      width: min(1100px, 100% - 0px);
      max-width: none;
      padding: 41px 20px 20px;
    }

    .copy {
      max-width: none;
    }

    .rights > span {
      display: inline;
      color: inherit;
    }

    .notice {
      margin-top: 24px;
    }

    .mark-box {
      margin-top: 150px;
    }

    .base {
      margin-top: 24px;
    }

    .mark {
      height: 51.04cqw;
      line-height: 51.04cqw;
    }

    .legal {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
    }

    .legal nav {
      margin-top: 0;
    }
  }

  @media (min-width: 810px) and (max-width: 1199.98px) {
    .site-foot {
      max-width: 810px;
      padding: 41px 16px 16px;
    }

    .mark-box {
      margin-top: 152px;
    }

    .mark {
      height: 51.04cqw;
      line-height: 51.04cqw;
    }

    .base {
      margin-top: 21px;
    }

    .copy {
      max-width: 379px;
    }

    .rights > span {
      color: inherit;
    }

    .made {
      font-size: 16px;
      line-height: 19.2px;
    }

    .made > span {
      display: block;
    }

    .legal {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-top: 24px;
    }

    .legal nav {
      justify-content: flex-end;
      max-width: 561px;
      margin-top: 0;
    }

    .notice {
      max-width: 745px;
      margin-top: 24px;
    }
  }

  @media (max-width: 809.98px) {
    .notice {
      font-size: 13px;
    }
  }
</style>
