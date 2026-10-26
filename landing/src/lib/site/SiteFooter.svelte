<script lang="ts">
  import { LEGAL_DOCS } from './legal';
  import { APP_URL, GITHUB_URL } from './links';

  const legal = Object.entries(LEGAL_DOCS).map(([slug, doc]) => ({ href: `/${slug}`, label: doc.label }));
  const year = new Date().getFullYear();
</script>

<footer class="site-foot">
  <div class="grid">
    <div class="site-ready">
      <h2>Ready?</h2>
      <a href={APP_URL}><span>Let's start now</span></a>
    </div>

    <div class="cols">
      <div class="site-col">
        <p>( Navigate )</p>
        <a href="/">Product</a>
        <a href={APP_URL}>Sign In</a>
      </div>
      <div class="site-col">
        <p>( Socials )</p>
        <a href={GITHUB_URL}>GitHub [Star Us]</a>
      </div>
    </div>

    <p class="mark" aria-hidden="true">feega</p>

    <div class="base">
      <a class="to-top" href="#top">Back to top ↑</a>
      <p class="copy">© {year} Feega. All rights reserved.<br />Made in Italy, by Andrea Buttarelli.</p>
    </div>
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
    padding: 20px var(--site-gutter) var(--site-gutter);
  }

  .grid {
    container-type: inline-size;
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: var(--site-gutter);
    margin-top: 48px;
  }

  .site-ready {
    grid-column: 1 / -1;
    font-size: 37px;
    line-height: 1;
    letter-spacing: -0.04em;
  }

  .site-ready h2 {
    margin: 0;
    font: inherit;
    color: #fff;
  }

  .site-ready a {
    display: block;
    margin-top: 0;
  }

  .site-ready span {
    display: inline-block;
    border-bottom: 2px solid var(--site-ink);
  }

  .cols {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: subgrid;
    margin-top: 53.4px;
  }

  .site-col {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .site-col a,
  .to-top,
  .legal a {
    padding-bottom: 2px;
  }

  .site-col p {
    margin-bottom: 18px;
  }

  .mark {
    grid-column: 1 / -1;
    margin: 120px 0 0;
    font-family: 'DM Sans', sans-serif;
    font-variation-settings: normal;
    color: var(--site-accent);
    font-size: 46.5cqw;
    line-height: 36cqw;
    letter-spacing: -0.08em;
  }

  .base {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: subgrid;
    align-items: end;
    margin-top: 40px;
  }

  .to-top {
    grid-column: 2;
    grid-row: 1;
    text-align: right;
  }

  .copy {
    grid-column: 1;
    grid-row: 1;
  }

  .legal {
    margin-top: 40px;
    opacity: 0.5;
  }

  .legal nav {
    display: flex;
    flex-wrap: wrap;
    column-gap: 12px;
    margin-top: 24px;
  }

  .notice {
    margin-top: 40px;
    font-size: 12px;
    line-height: 1;
    opacity: 0.5;
  }

  @media (min-width: 1200px) {
    .site-foot {
      max-width: 1500px;
    }

    .site-ready {
      grid-column: 1;
      font-size: 58px;
    }

    .site-ready a {
      margin-top: 7px;
    }

    .cols {
      grid-column: 2;
      grid-row: 1;
      grid-template-columns: 1fr 1fr 1fr;
      column-gap: var(--site-gutter);
      margin-top: 18px;
    }

    .mark {
      grid-column: 1 / -1;
      grid-row: 2;
      margin-top: 100px;
      font-size: 43.4cqw;
      line-height: 34cqw;
      letter-spacing: -0.05em;
    }

    .base {
      grid-column: 1 / -1;
      grid-row: 3;
      margin-top: 60px;
    }

    .copy {
      white-space: nowrap;
    }

    .legal {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-top: 24px;
    }

    .legal nav {
      margin-top: 0;
    }

    .notice {
      margin-top: 24px;
    }
  }
</style>
