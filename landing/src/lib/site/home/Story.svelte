<script lang="ts">
  import { GITHUB_URL, STORY_URL } from '../links';
</script>

<section class="story" id="story">
  <div class="site-full inner">
    <h2><span>Built by a designer, for designers.</span></h2>
    <p class="body">
      Feega didn’t start in a boardroom. It started with one designer, tired of paying for slow tools that were never
      built for working with AI. No VC money. No roadmap written for investors. Just a tool built by a designer, for
      designers, to make everyday work faster. And it’s open source, so it stays yours.
    </p>
    <p class="sign">— Andrea Buttarelli</p>
    <div class="links">
      <a class="site-pill" href={STORY_URL}>Read the story</a>
      <a class="star" href={GITHUB_URL}>Star on GitHub</a>
    </div>
  </div>
</section>

<style>
  .story {
    background: #f0eee9;
    color: #000;
  }

  .inner {
    padding: 96px 16px;
  }

  h2 span {
    display: inline-block;
    font-size: 50px;
    line-height: 45px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .body {
    margin-top: 32px;
    color: rgba(0, 0, 0, 0.72);
    font-size: 24px;
    line-height: 28.8px;
    letter-spacing: -0.04em;
  }

  .sign {
    margin-top: 32px;
  }

  .links {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 13px;
    margin-top: 31px;
  }

  .links a {
    height: 45px;
  }

  .links .site-pill {
    width: 258px;
  }

  .star {
    display: inline-flex;
    align-items: center;
    padding: 0 45px;
    border: 2px solid #080808;
    border-radius: 100px;
    color: #080808;
    font-family: 'IBM Plex Sans', sans-serif;
    font-variation-settings: normal;
    font-size: 18px;
    line-height: 23.4px;
    letter-spacing: -0.02em;
    font-weight: 400;
    transition:
      background 0.3s ease,
      color 0.3s ease;
  }

  .star:hover {
    background: #080808;
    color: #f0eee9;
  }

  @media (min-width: 810px) {
    .inner {
      padding: 160px 0;
    }

    h2 span {
      font-size: 78px;
      line-height: 70.2px;
    }

    .body {
      margin-top: 33px;
      font-size: 38px;
      line-height: 45.6px;
    }

    .links {
      flex-direction: row;
      gap: 12px;
      margin-top: 32px;
    }
  }
</style>
