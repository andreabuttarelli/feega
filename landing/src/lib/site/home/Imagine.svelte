<script lang="ts">
  import { APP_URL } from '../links';
  import { IMAGINE } from '../home';
</script>

<section class="imagine site-wide" id="imagine">
  <span class="arrow" aria-hidden="true"></span>
  <h2>If you can imagine it, you can bring it to life in Feega</h2>

  <ul>
    {#each IMAGINE as name (name)}
      <li>
        <a href={APP_URL}>
          <h3>{name}</h3>
          <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" overflow="visible" aria-hidden="true"><path d="M 9 18 C 13.103 18 16.687 15.225 17.716 11.253 M 9 18 C 4.897 18 1.313 15.225 0.284 11.253 M 9 18 C 11.485 18 13.5 13.97 13.5 9 C 13.5 4.03 11.485 0 9 0 M 9 18 C 6.515 18 4.5 13.97 4.5 9 C 4.5 4.03 6.515 0 9 0 M 9 0 C 12.25 -0.001 15.248 1.75 16.843 4.582 M 9 0 C 5.75 -0.001 2.752 1.75 1.157 4.582 M 16.843 4.582 C 14.666 6.468 11.881 7.504 9 7.5 C 6.002 7.5 3.26 6.4 1.157 4.582 M 16.843 4.582 C 17.604 5.93 18.002 7.452 18 9 C 18 9.778 17.901 10.533 17.716 11.253 M 17.716 11.253 C 15.049 12.731 12.049 13.505 9 13.5 C 5.951 13.505 2.951 12.731 0.284 11.253 M 0.284 11.253 C 0.095 10.517 -0.001 9.76 0 9 C 0 7.395 0.42 5.887 1.157 4.582" /></svg>
        </a>
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
      margin-top: 16px;
      padding-top: 60px;
      border-radius: 24px;
      background: #ff5100;
      color: #080808;
    }

    .arrow {
      display: block;
      width: 11px;
      height: 12px;
      margin: 0 auto;
    }

    h2 {
      text-align: center;
      font-family: 'Instrument Serif', serif;
      font-variation-settings: normal;
      font-size: 55px;
      line-height: 66px;
      letter-spacing: -0.04em;
      font-weight: 400;
    }

    ul {
      position: absolute;
      left: 0;
      top: 208px;
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 144px;
      list-style: none;
    }

    li {
      width: 144px;
      height: 430px;
      transform: rotateX(-30deg) rotateY(50deg);
      transform-origin: 72px 215px;
    }

    li:last-child {
      display: none;
    }

    a {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      width: 288px;
      height: 430px;
      padding: 15px;
      border-radius: 12px;
      background: #202020;
      color: #fff;
      transition:
        translate 0.4s cubic-bezier(0.16, 1, 0.3, 1),
        background 0.3s ease;
    }

    a:hover {
      translate: 0 -40px;
      background: #171717;
    }

    h3 {
      font-family: 'Instrument Serif', serif;
      font-variation-settings: normal;
      font-size: 33px;
      line-height: 46.2px;
      letter-spacing: normal;
      font-weight: 400;
    }

    svg {
      flex: none;
      margin-top: 4px;
    }
  }
</style>
