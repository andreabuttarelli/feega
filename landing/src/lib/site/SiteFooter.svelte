<script lang="ts">
  import { LEGAL_DOCS } from './legal';
  import DownloadMac from './DownloadMac.svelte';
  import { APP_URL, MAC_GUIDE_URL, SOCIAL_LINKS } from './links';

  const legal = Object.entries(LEGAL_DOCS).map(([slug, doc]) => ({ href: `/${slug}`, label: doc.label }));
  const year = new Date().getFullYear();
</script>

<footer class="site-foot">
  <div class="top">
    <div class="ready">
      <h2>Ready?</h2>
      <a href={APP_URL}><span>Let's start now</span></a>
      <DownloadMac class="dl" />
      <a class="dl-guide" href={MAC_GUIDE_URL}>Unsigned app: how to open it</a>
    </div>

    <div class="col">
      <p>( Navigate )</p>
      <a href="/">Product</a>
      <a href={APP_URL}>Sign In</a>
      <a href="/blog">Compare</a>
    </div>

    <div class="col">
      <p>( Open building )</p>
      <div class="icons">
        {#each SOCIAL_LINKS as social (social.label)}
          <a href={social.href} aria-label={social.label}>{@html social.icon}</a>
        {/each}
      </div>
    </div>
  </div>

  <div class="mark-box" aria-hidden="true"><p class="mark">feega</p></div>

  <div class="base">
    <p class="copy">
      <span class="rights"><span>© {year} Feega.</span> <span>All rights reserved.</span></span>
      <span class="made"><span>Made in Italy,</span> <span>by Andrea Buttarelli.</span></span>
    </p>
    <a class="to-top" href="#top">Back to top ↑</a>
  </div>

  <div class="legal">
    <p>IT16090491008, Roma, Italy</p>
    <nav aria-label="Legal">
      {#each legal as link (link.href)}
        <a href={link.href}>{link.label}</a>
      {/each}
    </nav>
  </div>

  <p class="notice">
    feega must never be used to create illegal content, such as CSAM, non-consensual intimate imagery (NCII) or sexual
    deepfakes. feega does not use Google APIs or Google user data to generate content: Google and GitHub Sign-In data is
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
    grid-template-columns: 1fr 1fr;
    column-gap: 12px;
  }

  .ready {
    grid-column: 1 / -1;
    font-size: 37px;
    line-height: 37px;
    letter-spacing: -0.04em;
  }

  .ready :global(.dl) {
    display: block;
  }

  .ready :global(.dl svg) {
    width: 0.8em;
    height: 0.8em;
    margin-right: 8px;
  }

  .dl-guide {
    display: block;
    font-size: 14px;
    line-height: 16.8px;
  }

  .ready h2 {
    font: inherit;
    color: #fff;
  }

  .ready a {
    display: block;
    margin-top: 1px;
  }

  .ready span {
    display: inline-block;
    border-bottom: 2px solid var(--site-ink);
  }

  .col {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    margin-top: 78px;
  }

  .col p {
    margin-bottom: 18px;
  }

  .col a,
  .to-top,
  .legal a {
    padding-bottom: 2px;
  }

  .icons {
    display: flex;
    gap: 8px;
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

    .top {
      grid-template-columns: 520px 160px 1fr;
      column-gap: 20px;
    }

    .ready {
      grid-column: 1;
      font-size: 58px;
      line-height: 58px;
    }

    .ready a {
      margin-top: 8px;
    }

    .ready span {
      border-bottom-width: 3px;
    }

    .col {
      margin-top: 3px;
      gap: 7px;
    }

    .col p {
      margin-bottom: 17px;
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

    .top {
      grid-template-columns: 379px 178px 1fr;
      column-gap: 20px;
    }

    .ready {
      grid-column: 1;
      font-size: 46px;
      line-height: 46px;
    }

    .ready a {
      margin-top: 8px;
    }

    .col {
      margin-top: -1px;
    }

    .col p {
      margin-bottom: 18px;
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
</style>
