<script lang="ts">
  import { APP_URL } from '../links';
  import { CLOUD_FEATURES, LOCAL_FEATURES, PLAN_CREDITS } from '../home';
  import NpxChip from './NpxChip.svelte';
</script>

<section class="pricing site-wide" id="pricing">
  <h2>100% open source &amp; free.<br />Pay only for AI usage in our cloud version or use with your own agent via MCP</h2>

  <article class="plan local">
    <h3>Local version</h3>
    <div class="body">
      <div class="features">
        <p>Features</p>
        <ul>
          {#each LOCAL_FEATURES as feature (feature)}
            <li>{feature}</li>
          {/each}
        </ul>
        <p class="run"><span>Just run</span> <NpxChip /></p>
      </div>
      <div class="prices">
        <p>Pricing</p>
        <a href={APP_URL}>Free</a>
      </div>
    </div>
  </article>

  <article class="plan cloud">
    <h3>Cloud version</h3>
    <div class="usage">
      <p>Pricing for AI usage (chatbot, AI generations)</p>
      <p>100 credits = €1<br />e.g. €8/mo = 800 credits included (100-120 pictures)</p>
    </div>
    <div class="body">
      <div class="features">
        <p>Everything in local, plus:</p>
        <ul>
          {#each CLOUD_FEATURES as feature (feature)}
            <li>{feature}</li>
          {/each}
        </ul>
        <a class="try" href={APP_URL}>Try for free</a>
      </div>
      <div class="prices">
        <p>Pricing</p>
        {#each PLAN_CREDITS as credits (credits)}
          <a href={APP_URL}>{credits} / mo</a>
        {/each}
      </div>
    </div>
  </article>
</section>

<style>
  .pricing {
    padding: 100px 12px;
    color: var(--site-ink);
  }

  h2 {
    max-width: calc(75% - 17.5px);
    font-size: 24px;
    line-height: 28.8px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .plan {
    padding: 20px;
    background: #000;
  }

  .local {
    margin-top: 80px;
  }

  .cloud .body {
    margin-top: 32px;
  }

  .cloud .features {
    margin-top: 24px;
  }

  .cloud {
    margin-top: 16px;
  }

  h3 {
    font-size: 24px;
    line-height: 28.8px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .body {
    display: flex;
    flex-direction: column-reverse;
    margin-top: 20px;
  }

  .features p,
  .prices p,
  li {
    line-height: 1.4;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;
    list-style: none;
  }

  li {
    position: relative;
    padding-left: 18px;
  }

  li::before {
    content: '';
    position: absolute;
    left: 6px;
    top: 0.62em;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
  }

  .features {
    display: flex;
    flex-direction: column;
    margin-top: 20px;
  }

  .run {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 31px;
  }

  .run span {
    opacity: 0.8;
    color: #fff;
  }

  .prices {
    display: flex;
    flex-direction: column;
  }

  .local .prices p {
    margin-bottom: 9px;
  }

  .prices a + a {
    margin-top: 5.8px;
  }

  .prices a {
    width: fit-content;
    font-size: 32px;
    line-height: 44.8px;
    letter-spacing: -0.04em;
  }

  .usage {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 32px;
    padding: 16px;
    background: #222;
  }

  .try {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 174px;
    height: 43px;
    margin-top: 39px;
    border-radius: 100px;
    background: #fff;
    color: #000;
    font-family: 'IBM Plex Sans', sans-serif;
    font-variation-settings: normal;
    font-size: 18px;
    line-height: 23.4px;
    letter-spacing: -0.02em;
    font-weight: 500;
  }

  @media (min-width: 1200px) {
    .pricing {
      padding: 200px 0;
    }

    h2 {
      max-width: 777px;
      font-size: 38px;
      line-height: 45.6px;
    }

    .local {
      height: 509px;
      margin-top: 39px;
    }

    .cloud {
      margin-top: 17px;
    }

    h3 {
      font-size: 38px;
      line-height: 45.6px;
    }

    .local .body {
      height: calc(100% - 66px);
    }

    .body {
      display: grid;
      grid-template-columns: 570px 1fr;
      margin-top: 20px;
    }

    .features,
    .cloud .features {
      margin-top: 0;
    }

    .run,
    .try {
      margin-top: auto;
    }

    .prices a + a {
      margin-top: 8.1px;
    }

    .prices p,
    .local .prices p {
      margin-bottom: 9.6px;
    }

    .prices a {
      font-size: 48px;
      line-height: 67.2px;
    }

    .usage {
      display: grid;
      grid-template-columns: 504px 1fr;
      align-items: center;
      gap: 0;
      margin-top: 19px;
      padding: 16px;
    }

    .cloud .body {
      margin-top: 21px;
    }
  }

  @media (min-width: 810px) and (max-width: 1199.98px) {
    .pricing {
      padding: 150px 0;
    }

    h2 {
      max-width: 566px;
      font-size: 30px;
      line-height: 36px;
    }

    .local {
      height: 483px;
      margin-top: 40px;
    }

    h3 {
      font-size: 30px;
      line-height: 36px;
    }

    .local .body {
      height: calc(100% - 56px);
    }

    .body {
      display: grid;
      grid-template-columns: 570px 1fr;
      margin-top: 20px;
    }

    .features,
    .cloud .features {
      margin-top: 0;
    }

    .run,
    .try {
      margin-top: auto;
    }

    .prices p,
    .local .prices p {
      margin-bottom: 10.4px;
    }

    .prices a {
      font-size: 38px;
      line-height: 53.2px;
    }

    .prices a + a {
      margin-top: 8px;
    }

    .usage {
      display: grid;
      grid-template-columns: 363px 1fr;
      align-items: center;
      gap: 0;
      margin-top: 28px;
    }

    .cloud .body {
      margin-top: 11px;
    }
  }
</style>
