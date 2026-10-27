<script lang="ts">
  import { IMAGINE } from '../home';
</script>

<section class="imagine" id="autopublishing-2">
  <h2>If you can imagine it, you can bring it to life in Feega</h2>

  <ul>
    {#each IMAGINE as name, i (name)}
      <li style:left="{106 + i * 144}px">
        <h3>{name}</h3>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <ellipse cx="12" cy="12" rx="4" ry="9" />
          <path d="M3 12h18M5 7.5h14M5 16.5h14" />
        </svg>
      </li>
    {/each}
  </ul>
</section>

<style>
  .imagine {
    display: none;
  }

  @media (min-width: 810px) {
    .imagine {
      position: relative;
      display: block;
      overflow: hidden;
      height: 518px;
      margin: 16px 20px 0;
      border-radius: 20px;
      background: #ff5100;
      color: #080808;
    }

    h2 {
      padding-top: 58px;
      text-align: center;
      font-family: 'Instrument Serif', serif;
      font-size: 55px;
      line-height: 66px;
      letter-spacing: -0.04em;
      font-weight: 400;
    }

    ul {
      position: absolute;
      inset: 0 auto auto 50%;
      width: 1400px;
      height: 100%;
      margin-left: -700px;
      list-style: none;
    }

    li {
      position: absolute;
      top: 267px;
      width: 185px;
      height: 420px;
      padding: 18px 0 0 10px;
      border: 1px solid #343434;
      border-radius: 14px 0 0 0;
      background: #202020;
      color: #fff;
      transform: skewY(-30deg);
      transform-origin: 0 0;
      transition:
        translate 0.3s ease,
        background 0.3s ease,
        box-shadow 0.3s ease;
    }

    li:hover {
      translate: -8px -72px;
      background: #171717;
      box-shadow: -20px 20px 40px rgba(255, 81, 0, 0.4);
    }

    h3 {
      font-family: 'Instrument Serif', serif;
      font-size: 33px;
      line-height: 46px;
      font-weight: 400;
    }

    svg {
      position: absolute;
      top: 18px;
      right: 12px;
    }
  }
</style>
