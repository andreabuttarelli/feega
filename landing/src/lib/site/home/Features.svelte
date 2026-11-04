<script lang="ts">
  import { tilt } from '../tilt';

  const DOT_ROWS = [3, 4, 5, 6, 7];
</script>

<section class="features site-wide" id="features">
  <svg class="ruler" viewBox="0 0 1178 44" preserveAspectRatio="none" aria-hidden="true">
    <path d="M4 21.5H1174" stroke="#202020" />
    {#each [44.5, 408.5, 772.5, 1136.5] as x (x)}
      <path d="M{x} 2V42" stroke="#262626" />
    {/each}
    {#each [226.5, 590.5, 954.5] as x (x)}
      <path d="M{x} 13V31" stroke="#262626" opacity="0.5" />
    {/each}
  </svg>

  <h2>AI-native.<br />Open source.<br />Local.<br />100% free.</h2>

  <div class="cards">
    <article class="card gen" use:tilt>
      <img src="/site/home/tool-gen.webp" alt="" width="920" height="1269" loading="lazy" decoding="async" />
      <span class="focus" aria-hidden="true"></span>
      <h3>Text, image, video, 3D generation</h3>
    </article>

    <article class="card tpl" use:tilt>
      <div class="shots">
        <img class="a" src="/site/home/tool-tpl-a.webp" alt="" width="420" height="525" loading="lazy" decoding="async" />
        <img class="b" src="/site/home/tool-tpl-b.webp" alt="" width="320" height="400" loading="lazy" decoding="async" />
      </div>
      <div class="text">
        <h3>Graphic &amp; motion design</h3>
        <p>Hundreds of ready-to-use templates</p>
      </div>
    </article>

    <article class="card agents" use:tilt>
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
  .features {
    padding: 69px 20px 0;
    color: var(--site-ink);
  }

  .ruler {
    display: block;
    width: calc(100% - 1px);
    height: auto;
    aspect-ratio: 1178 / 44;
    margin-left: 1px;
    overflow: visible;
  }

  h2 {
    margin-top: 72px;
    font-size: 37px;
    line-height: 37px;
    letter-spacing: -0.04em;
    font-weight: 400;
    text-align: center;
  }

  .cards {
    display: grid;
    gap: 15px;
    margin-top: 25px;
  }

  .card {
    position: relative;
    overflow: hidden;
    border-radius: 12px;
    background: #171717;
    transform: perspective(1500px);
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  h3 {
    font-size: 28px;
    line-height: 25.2px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  p {
    font-size: 14px;
    line-height: 16.8px;
    letter-spacing: -0.02em;
  }

  .gen {
    height: 455px;
  }

  .gen img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .focus {
    position: absolute;
    left: calc(50% - 108px);
    top: 35px;
    width: 216px;
    height: 213px;
    border: 2px solid #fff;
    border-radius: 12px;
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

  .gen h3 {
    position: absolute;
    left: 20px;
    right: 35px;
    bottom: 20px;
  }

  .tpl {
    container-type: inline-size;
  }

  .shots {
    position: relative;
    overflow: hidden;
    height: calc(63cqw + 202.3px);
    border-radius: 12px 12px 0 0;
    background: rgba(255, 255, 255, 0.08);
  }

  .shots img {
    position: absolute;
    object-fit: cover;
  }

  .shots .a {
    left: 26px;
    top: 29px;
    width: 207px;
    height: 259px;
  }

  .shots .b {
    left: 168px;
    top: 171px;
    width: calc(50.5cqw + 37.4px);
    height: auto;
    aspect-ratio: 4 / 5;
  }

  .text {
    padding: 20px;
    text-align: center;
  }

  .text p {
    margin-top: 16.6px;
    color: #fff;
  }

  .agents {
    border-radius: 24px;
  }

  .agents h3 {
    padding: 20px;
    color: #fff;
  }

  .dots {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 300px;
    margin: 10px 0;
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
    background: #262626;
  }

  .agents p {
    padding: 20px;
    color: #fff;
  }

  @media (min-width: 1200px) {
    .features {
      padding: 70px 0 0;
    }

    .ruler {
      width: 100%;
      height: 44px;
      margin-left: 0;
    }

    h2 {
      font-size: 58px;
      line-height: 58px;
    }

    .cards {
      grid-template-columns: repeat(3, 343px);
      justify-content: space-between;
      gap: 16px;
      margin-top: 26px;
    }

    .card {
      height: 557px;
    }

    h3 {
      font-size: 44px;
      line-height: 39.6px;
    }

    p {
      font-size: 16px;
      line-height: 19.2px;
    }

    .focus {
      left: 39px;
      top: 52px;
      width: 265px;
      height: 245px;
    }


    .gen h3 {
      right: 72px;
    }

    .shots {
      height: 403px;
    }

    .shots .b {
      width: 198px;
      height: 248px;
    }

    .tpl .text {
      text-align: center;
    }

    .text p {
      margin-top: 16px;
      color: var(--site-ink);
    }

    .agents h3,
    .agents p {
      color: var(--site-ink);
    }

    .card.agents {
      display: flex;
      flex-direction: column;
    }

    .agents p {
      margin-top: auto;
    }
  }

  @media (min-width: 810px) and (max-width: 1199.98px) {
    .features {
      padding: 69px 0 0;
    }

    .ruler {
      width: 723px;
      height: 27px;
      margin: 0 auto;
    }

    h2 {
      font-size: 46px;
      line-height: 46px;
    }

    .cards {
      gap: 16px;
      margin-top: 26px;
    }

    h3 {
      font-size: 35px;
      line-height: 31.5px;
    }

    .gen {
      height: 878px;
    }

    .focus {
      left: calc(50% - 251px);
      top: 24px;
      width: 502px;
      height: 456px;
    }

    .gen h3 {
      right: 137px;
    }

    .shots {
      height: 561px;
    }

    .shots .a {
      width: 359px;
      height: 449px;
    }

    .shots .b {
      left: 399px;
      width: 325px;
      height: 406px;
    }

    .text p {
      margin-top: 15px;
      color: var(--site-ink);
    }

    .agents h3,
    .agents p {
      color: var(--site-ink);
    }
  }
</style>
