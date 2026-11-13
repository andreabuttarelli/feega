<script lang="ts">
  import { PILLARS, PillarId } from './pillars';

  const READING_LINE = '-45% 0px -55% 0px';
  const BELOW_RAIL = '-62% 0px -38% 0px';
  const UNDER_BAR = '0px 0px -88% 0px';
  const DESKTOP = '(min-width: 1024px)';

  let nav: HTMLElement;
  let current = $state<PillarId>(PillarId.Code);
  let inChapters = $state(false);
  let desktop = $state(false);

  $effect(() => {
    const query = matchMedia(DESKTOP);
    const sync = () => (desktop = query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  });

  $effect(() => {
    const chapters = nav.parentElement;
    if (!chapters) {
      return;
    }

    const presence = new IntersectionObserver(([entry]) => (inChapters = entry.isIntersecting), { rootMargin: desktop ? BELOW_RAIL : UNDER_BAR });
    presence.observe(chapters);

    const reading = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((entry) => entry.isIntersecting);
        if (hit) {
          current = hit.target.id as PillarId;
        }
      },
      { rootMargin: READING_LINE }
    );
    for (const pillar of PILLARS) {
      const section = document.getElementById(pillar.id);
      if (section) {
        reading.observe(section);
      }
    }

    return () => {
      presence.disconnect();
      reading.disconnect();
    };
  });
</script>

<nav class="rail" class:shown={inChapters} aria-label="Feega in three parts" bind:this={nav}>
  <ol>
    {#each PILLARS as pillar (pillar.id)}
      <li>
        <a href="#{pillar.id}" aria-current={current === pillar.id ? 'true' : undefined}>
          <span class="number">{pillar.number}</span>
          <span>{pillar.name}</span>
        </a>
      </li>
    {/each}
  </ol>
</nav>

<style>
  .rail {
    position: fixed;
    inset: 0 0 auto;
    z-index: var(--site-z-rail);
    padding-top: var(--site-bar-top);
    border-bottom: 1px solid var(--site-line);
    background: var(--site-bg);
    opacity: 0;
    pointer-events: none;
  }

  .rail.shown,
  .rail:focus-within {
    opacity: 1;
    pointer-events: auto;
  }

  ol {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin: 0;
    padding: 0 8px;
    list-style: none;
  }

  a {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    min-height: var(--site-rail-bar);
    color: var(--site-ink);
    opacity: 0.5;
    text-decoration: none;
    box-shadow: inset 0 -2px 0 transparent;
  }

  a[aria-current] {
    opacity: 1;
    box-shadow: inset 0 -2px 0 #ff5100;
  }

  a:focus-visible {
    outline: 2px solid #ff5100;
    outline-offset: -2px;
    opacity: 1;
  }

  [aria-current] .number {
    color: #ff5100;
  }

  @media (prefers-reduced-motion: no-preference) {
    .rail,
    a {
      transition: opacity 0.2s, box-shadow 0.2s;
    }
  }

  @media (min-width: 1024px) {
    .rail {
      inset: 50% auto auto 16px;
      height: 0;
      padding: 0;
      border: 0;
      background: none;
    }

    ol {
      position: absolute;
      display: grid;
      grid-template-columns: none;
      gap: 4px;
      padding: 0;
      transform: translateY(-50%);
    }

    a {
      justify-content: start;
      min-height: 32px;
      padding: 0 12px 0 10px;
      box-shadow: inset 2px 0 0 var(--site-line);
    }

    a[aria-current] {
      box-shadow: inset 2px 0 0 #ff5100;
    }
  }
</style>
