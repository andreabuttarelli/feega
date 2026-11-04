<script lang="ts">
  import { APP_URL } from '../links';
  import { FEATURED_MODELS } from '../home';
</script>

<section class="providers" id="models">
  <div class="site-wide inner">
    <div class="head">
      <div class="quote">
        <h2>“Well, Idk. I already use Higgsfield.”</h2>
        <h2>Well, keep using it alongside other providers.</h2>
      </div>
      <p><span>You don't have to replace your favorite tools.</span> <span>Feega brings your creative workflow together in one place.</span></p>
    </div>

    <div class="featured">
      {#each FEATURED_MODELS as m (m.slug)}
        <a class="feature" href={APP_URL}>
          <span class="pic">
            <img src="/site/home/model-{m.slug}.webp" alt={m.name} width="1122" height="1402" loading="lazy" decoding="async" />
            <span class="veil" aria-hidden="true"></span>
          </span>
          <span class="name">{m.name}</span>
          <span>{m.maker}</span>
        </a>
      {/each}
    </div>

    <a class="try" href={APP_URL}>Try them in app</a>
  </div>
</section>

<style>
  .providers {
    background: #ff5100;
    color: #000;
  }

  .inner {
    padding: 100px 12px;
  }

  h2 {
    font-size: 50px;
    line-height: 45px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  h2 + h2 {
    margin-top: 40px;
  }

  .head p {
    margin-top: 48px;
  }

  .head p span {
    display: block;
  }

  .head p span + span {
    margin-top: 0;
  }

  .featured {
    display: grid;
    gap: 48px;
    margin-top: 80px;
  }

  .feature {
    display: flex;
    flex-direction: column;
  }

  .pic {
    position: relative;
    display: block;
    overflow: hidden;
    height: 401px;
    margin-bottom: 11px;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .veil {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.2);
    opacity: 0;
    transition: opacity 0.4s ease;
  }

  .feature:hover .veil {
    opacity: 1;
  }

  .name {
    margin-bottom: 5px;
  }

  .try {
    display: block;
    width: fit-content;
    margin: 80px 0 0 calc(50% + 6px);
    border-bottom: 2px solid var(--site-ink);
    color: var(--site-ink);
    font-size: 24px;
    line-height: 28.8px;
    letter-spacing: -0.04em;
  }

  @media (min-width: 1200px) {
    .inner {
      padding: 200px 0 150px;
    }

    .head {
      display: grid;
      grid-template-columns: 693px 1fr;
      column-gap: 20px;
      align-items: end;
    }

    h2 {
      font-size: 78px;
      line-height: 70.2px;
    }

    h2 + h2 {
      margin-top: 41px;
    }

    .head p {
      margin-top: 0;
      padding-bottom: 1px;
    }

    .featured {
      grid-template-columns: 340px 520px;
      justify-content: space-between;
      align-items: start;
      gap: 0;
      margin-top: 32px;
    }

    .pic {
      height: 442px;
      margin-bottom: 10px;
    }

    .feature:last-child .pic {
      height: 757px;
    }

    .try {
      margin: 96px 0 0 540px;
      font-size: 38px;
      line-height: 45.6px;
    }
  }

  @media (min-width: 810px) and (max-width: 1199.98px) {
    .inner {
      padding: 150px 0;
    }

    .head {
      display: grid;
      grid-template-columns: 505px 1fr;
      column-gap: 20px;
      align-items: end;
    }

    h2 {
      font-size: 62px;
      line-height: 55.8px;
    }

    .head p {
      margin-top: 0;
    }

    .head p span + span {
      margin-top: 3px;
    }

    .featured {
      grid-template-columns: 279px 379px;
      justify-content: space-between;
      align-items: start;
      gap: 0;
      margin-top: 32px;
    }

    .pic {
      height: 266px;
    }

    .feature:last-child .pic {
      height: 401px;
    }

    .try {
      margin: 80px 0 0 399px;
      font-size: 30px;
      line-height: 36px;
    }
  }
</style>
