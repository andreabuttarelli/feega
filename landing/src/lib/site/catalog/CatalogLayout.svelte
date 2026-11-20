<script lang="ts">
  import type { Snippet } from 'svelte';
  import { goto } from '$app/navigation';
  import { lower } from '../lower';
  import { NAV_GROUPS, type OutlineItem } from './outline';
  import './catalog.css';

  let { path, outline = [], children }: { path: string; outline?: readonly OutlineItem[]; children: Snippet } = $props();

  let active = $state('');

  const SPY_MARGIN = '-20% 0px -70% 0px';

  const allItems = NAV_GROUPS.flatMap((g) => g.items);

  $effect(() => {
    const targets = outline.map((o) => document.getElementById(o.id)).filter((el): el is HTMLElement => el !== null);
    const spy = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) {
          active = hit.target.id;
        }
      },
      { rootMargin: SPY_MARGIN }
    );
    targets.forEach((el) => spy.observe(el));

    return () => spy.disconnect();
  });

  const jump = (event: MouseEvent, id: string) => {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
    active = id;
  };
</script>

{#snippet nav()}
  {#each NAV_GROUPS as group (group.label)}
    <details class="group" open={group.items.some((i) => i.href === path)}>
      <summary>{lower(group.label)}</summary>
      <ul>
        {#each group.items as i (i.href)}
          <li><a href={i.href} class:current={i.href === path} aria-current={i.href === path ? 'page' : undefined}>{lower(i.label)}</a></li>
        {/each}
      </ul>
    </details>
  {/each}
{/snippet}

{#snippet toc()}
  <ul>
    {#each outline as o (o.id)}
      <li class:sub={o.depth === 3}><a href="#{o.id}" class:current={active === o.id} onclick={(e) => jump(e, o.id)}>{lower(o.text)}</a></li>
    {/each}
  </ul>
{/snippet}

<div class="catalog">
  <details class="box pages-box"><summary>{lower('All pages')}</summary>{@render nav()}</details>
  <label class="pages-select">
    <span>{lower('Pages')}</span>
    <select value={path} onchange={(e) => goto(e.currentTarget.value)}>
      {#each allItems as i (i.href)}<option value={i.href}>{lower(i.label)}</option>{/each}
    </select>
  </label>
  {#if outline.length}
    <details class="box toc-box"><summary>{lower('On this page')}</summary>{@render toc()}</details>
  {/if}

  <aside class="side left" aria-label="Pages">{@render nav()}</aside>
  <div class="main">{@render children()}</div>
  {#if outline.length}
    <aside class="side right" aria-label="On this page">
      <p class="title">{lower('On this page')}</p>
      {@render toc()}
    </aside>
  {/if}
</div>
