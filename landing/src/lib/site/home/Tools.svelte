<script lang="ts">
  const DOT_ROWS = [3, 4, 5, 6, 7];
</script>

<section class="tools" id="ads">
  <div class="ruler" aria-hidden="true"></div>
  <h2>One tool for the entire creativity process</h2>

  <div class="cards">
    <article class="card gen">
      <img src="/site/home/tool-gen.webp" alt="" width="920" height="1269" loading="lazy" decoding="async" />
      <span class="focus" aria-hidden="true"></span>
      <h3>Text, image, video, 3D generation</h3>
    </article>

    <article class="card tpl">
      <div class="stack">
        <img class="a" src="/site/home/tool-tpl-a.webp" alt="" width="420" height="525" loading="lazy" decoding="async" />
        <img class="b" src="/site/home/tool-tpl-b.webp" alt="" width="320" height="400" loading="lazy" decoding="async" />
      </div>
      <h3>Graphic &amp; motion design</h3>
      <p>Hundreds of ready-to-use templates</p>
    </article>

    <article class="card agents">
      <h3>Made for humans and agents</h3>
      <div class="dots" aria-hidden="true">
        {#each DOT_ROWS as n (n)}
          <div class="row">
            {#each { length: n } as _, i (i)}
              <span></span>
            {/each}
          </div>
        {/each}
      </div>
      <p>Ready for Claude &amp; Codex, even from your phone.</p>
    </article>
  </div>
</section>

<style>
  .tools {
    padding: 80px 20px 20px;
    color: #f0eee9;
  }

  .ruler {
    height: 22px;
    margin: 0 5% 70px;
    background:
      radial-gradient(circle at 0 50%, #ff5100 3px, transparent 4px),
      radial-gradient(circle at 100% 50%, #ff5100 3px, transparent 4px),
      linear-gradient(#232323, #232323) center / 100% 1px no-repeat,
      repeating-linear-gradient(90deg, #232323 0 1px, transparent 1px 12.5%) center / 100% 100% no-repeat;
  }

  h2 {
    margin-bottom: 20px;
    font-size: 36px;
    line-height: 1;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .cards {
    display: grid;
    gap: 16px;
  }

  .card {
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
    height: 455px;
    border-radius: 20px;
    background: #171717;
  }

  h3 {
    margin: 0;
    font-size: 28px;
    line-height: 0.9;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  p {
    margin: 0;
    font-size: 16px;
    line-height: 1.2;
    letter-spacing: -0.02em;
  }

  .gen img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .gen h3 {
    position: absolute;
    left: 20px;
    max-width: 348px;
    bottom: 22px;
  }

  .focus {
    position: absolute;
    left: 21%;
    top: 7%;
    width: 58%;
    height: 49%;
    border: 2px solid #fff;
    border-radius: 20px;
  }

  .focus::after {
    content: '';
    position: absolute;
    left: calc(50% - 7px);
    top: calc(50% - 7px);
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ff5100;
  }

  .tpl {
    text-align: center;
  }

  .stack {
    position: relative;
    height: 69%;
    margin-bottom: 14px;
    background: #292929;
    overflow: hidden;
  }

  .stack img {
    position: absolute;
    width: 45%;
  }

  .stack .a {
    left: 5.7%;
    top: 8%;
  }

  .stack .b {
    left: 36.8%;
    top: 49.4%;
    width: 33%;
  }

  .tpl h3 {
    padding: 0 20px;
  }

  .tpl p {
    margin-top: 12px;
  }

  .agents {
    padding: 20px;
  }

  .dots {
    position: absolute;
    left: 0;
    right: 0;
    top: 26.3%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
  }

  .row {
    display: flex;
    gap: 5px;
  }

  .row span {
    flex: none;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: #292929;
  }

  .agents p {
    position: absolute;
    left: 20px;
    right: 20px;
    bottom: 22px;
  }

  @media (min-width: 810px) {
    .tools {
      padding-top: 100px;
    }

    .ruler {
      margin-bottom: 90px;
    }

    h2 {
      font-size: 58px;
      line-height: 58px;
      letter-spacing: -0.04em;
    }

    .cards {
      grid-template-columns: repeat(3, 1fr);
    }

    .card {
      height: 498px;
    }

    h3 {
      font-size: 44px;
    }
  }
</style>
