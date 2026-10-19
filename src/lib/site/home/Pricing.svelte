<script lang="ts">
  import { APP_URL } from '../links';
  import { PLAN_CREDITS, PLAN_FEATURES } from '../home';
</script>

<section class="pricing" id="pricing">
  <div class="site-wrap">
    <h2>Pricing</h2>

    <div class="intro">
      <p class="lead">A pricing for builders who want to scale</p>
      <p>1 credit = $1<br />eg. 8/mo = 8 credits included, ~60 pictures</p>
    </div>

    <div class="plans">
      <div>
        <p class="label">Features in all plans</p>
        <ul>
          {#each PLAN_FEATURES as f (f)}
            <li>{f}</li>
          {/each}
        </ul>
        <a class="start" href={APP_URL}>Start now</a>
      </div>

      <div class="costs">
        <p class="label">Costs</p>
        {#each PLAN_CREDITS as c (c)}
          <a href={APP_URL}>{c} / mo</a>
        {/each}
      </div>
    </div>
  </div>
</section>

<style>
  .pricing {
    padding: 100px 0;
  }

  .site-wrap {
    max-width: 430px;
    margin: 0 auto;
    padding: 0 12px;
  }

  h2 {
    font-size: 50px;
    line-height: 0.9;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .lead {
    margin-top: 24px;
    font-size: 37px;
    line-height: 1;
    letter-spacing: -0.04em;
  }

  .intro p + p {
    margin-top: 48px;
  }

  .plans {
    margin-top: 80px;
    line-height: 1.4;
  }

  ul {
    list-style: none;
    padding: 0;
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  li {
    position: relative;
    padding-left: 18.3px;
  }

  li::before {
    content: '';
    position: absolute;
    left: 1px;
    top: 0.6em;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
  }

  .start {
    display: inline-block;
    margin-top: 9px;
    padding: 24px 40px;
    background: #0043fc;
    line-height: 1.2;
  }

  .costs {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    margin-top: 64px;
  }

  .costs .label {
    margin-bottom: -12px;
  }

  .costs a {
    font-size: 32px;
    line-height: 1.4;
    letter-spacing: -0.04em;
  }

  @media (min-width: 1200px) {
    .pricing {
      padding: 200px 0;
    }

    .site-wrap {
      max-width: 1500px;
      padding: 0 20px;
    }

    h2 {
      font-size: 78px;
    }

    .intro,
    .plans {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 20px;
    }

    .intro {
      align-items: center;
      margin-top: 24px;
    }

    .lead {
      margin-top: 0;
      font-size: 16px;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }

    .intro p + p {
      margin-top: 0;
    }

    .plans {
      margin-top: 33px;
    }

    .start {
      margin-top: 10px;
    }

    li {
      padding-left: 20.9px;
    }

    li::before {
      left: 3px;
      width: 5px;
      height: 5px;
    }

    .costs {
      gap: 8px;
      margin-top: 0;
    }

    .costs .label {
      margin-bottom: 2px;
    }

    .costs a {
      font-size: 48px;
    }
  }
</style>
