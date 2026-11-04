<script lang="ts">
  import { LEGAL_DOCS } from './legal';
  import { APP_URL, SOCIAL_LINKS } from './links';

  const legal = Object.entries(LEGAL_DOCS).map(([slug, doc]) => ({ href: `/${slug}`, label: doc.label }));
  const year = new Date().getFullYear();
</script>

<footer class="site-foot">
  <div class="top">
    <div class="ready">
      <h2>Ready?</h2>
      <a href={APP_URL}><span>Let's start now</span></a>
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
    <p class="copy"><span>© {year} Feega.</span> <span>All rights reserved.</span><br /><span>Made in Italy, by Andrea Buttarelli.</span></p>
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
    padding: 42px 12px 20px;
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
    margin-top: 150px;
  }

  .mark {
    height: 53.8cqw;
    color: #ff5100;
    font-family: 'DM Sans', sans-serif;
    font-variation-settings: normal;
    font-size: 42.474cqw;
    line-height: 51.04cqw;
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

  .copy span:not(:last-child) {
    display: block;
    color: #fff;
  }

  .copy br {
    display: none;
  }

  .legal {
    margin-top: 42px;
    opacity: 0.5;
  }

  .legal nav {
    display: flex;
    flex-wrap: wrap;
    column-gap: 12px;
    margin-top: 20px;
  }

  .notice {
    margin-top: 45px;
    font-size: 12px;
    line-height: 12px;
    opacity: 0.5;
  }

  @media (min-width: 810px) {
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

    .copy span:not(:last-child) {
      display: inline;
      color: inherit;
    }

    .copy br {
      display: inline;
    }

    .notice {
      margin-top: 24px;
    }

    .base {
      margin-top: 24px;
    }

    .mark {
      height: 51.04cqw;
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
</style>
