<script lang="ts">
  import { DISCIPLINES, DISCIPLINE_IMAGES } from '../home';

  let active = $state(0);

  const image = $derived(DISCIPLINE_IMAGES[active % DISCIPLINE_IMAGES.length]);
</script>

<section class="disciplines" id="autopublishing">
  <div class="site-wrap">
    <h2 class="site-title">Much more than just motion</h2>
  </div>
  <hr />

  <div class="site-wrap site-split">
    <ul>
      {#each DISCIPLINES as name, i (name)}
        <li>
          <button type="button" class:is-active={active === i} onmouseenter={() => (active = i)} onfocus={() => (active = i)}>{name}</button>
        </li>
      {/each}
    </ul>

    <p>
      Shaping concepts into cohesive visual stories where every detail - imagery, type, and motion - works together to create
      clarity and impact.
    </p>

    <img src="/site/home/{image}.webp" alt="" width="1122" height="1402" loading="lazy" />
  </div>
</section>

<style>
  .disciplines {
    padding: 100px 0;
  }

  .site-wrap {
    max-width: 430px;
    margin: 0 auto;
    padding: 0 12px;
  }

  .site-title {
    font-size: 72px;
    line-height: 0.9;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  hr {
    width: calc(min(100%, 430px) - 24px);
    margin: 24px auto 0;
    border: 0;
    border-top: 2px solid var(--site-line);
  }

  .site-split {
    display: grid;
    margin-top: 79px;
  }

  ul {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  button {
    font: inherit;
    font-size: 32px;
    line-height: 1.4;
    letter-spacing: -0.04em;
    color: inherit;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
  }

  button.is-active {
    border-bottom-color: var(--site-ink);
  }

  p {
    margin-top: 125px;
    font-size: 14px;
    line-height: 1.4;
  }

  img {
    margin-top: 64px;
    width: 100%;
    height: 540px;
    object-fit: cover;
  }

  @media (min-width: 1200px) {
    .disciplines {
      padding: 200px 0 0;
    }

    .site-wrap {
      max-width: 1500px;
      padding: 0 20px;
    }

    .site-title {
      max-width: 1160px;
      margin: 0 auto;
      padding-right: 295px;
      font-size: 112px;
    }

    hr {
      width: 100%;
      margin-top: 23px;
    }

    .site-split {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr auto;
      column-gap: 20px;
      margin-top: 32px;
    }

    ul {
      gap: 8px;
    }

    button {
      font-size: 48px;
    }

    p {
      grid-row: 2;
      width: 49.3%;
      margin-top: 0;
      font-size: 16px;
    }

    img {
      grid-column: 2;
      grid-row: 1 / 3;
      margin-top: 0;
      height: 636px;
    }
  }
</style>
