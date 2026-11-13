<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { toc } from '$lib/stores/toc';
  import { FREE_CREDITS } from '$lib/plans';
  import { PLAN, TOP_UPS } from '$lib/credit-ladder';
  import { formatCredits } from '$lib/components/credit-amount-format';

  $effect(() => {
    toc.set([
      { title: $_('docs.credits.s6'), href: '#how-credits-work' },
      { title: $_('docs.credits.s11'), href: '#plan-and-top-ups' },
      { title: $_('docs.credits.s33'), href: '#see-also' }
    ]);
  });
</script>

<svelte:head>
  <title>{$_('docs.credits.s0')}</title>
  <meta name="description" content={$_('docs.credits.s1')} />
</svelte:head>

<div class="docs-breadcrumb"><a href={'/docs'}>{$_('docs.credits.s2')}</a><span>/</span>{$_('docs.credits.s3')}</div>

<h1>{$_('docs.credits.s4')}</h1>
<p class="docs-lead">
  {$_('docs.credits.s5')}
</p>

<h2 id="how-credits-work">{$_('docs.credits.s6')}</h2>
<p>
  {$_('docs.credits.s7')}
</p>
<p>
  {$_('docs.credits.s10')}
</p>

<h2 id="plan-and-top-ups">{$_('docs.credits.s11')}</h2>
<table>
  <thead>
    <tr>
      <th>{$_('docs.credits.s12')}</th>
      <th>{$_('docs.credits.s13')}</th>
      <th>{$_('docs.credits.s14')}</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>{$_('docs.credits.s15')}</td>
      <td>{$_('docs.credits.s16')}</td>
      <td>{formatCredits(FREE_CREDITS)}</td>
    </tr>
    <tr>
      <td>{$_('docs.credits.s17')}</td>
      <td>{$_('docs.credits.s18', { values: { price: PLAN.price } })}</td>
      <td>{$_('docs.credits.s19', { values: { credits: formatCredits(PLAN.credits) } })}</td>
    </tr>
    {#each TOP_UPS as topUp (topUp.price)}
      <tr>
        <td>{$_('docs.credits.s20')}</td>
        <td>{$_('docs.credits.s21', { values: { price: topUp.price } })}</td>
        <td>{formatCredits(topUp.credits)}</td>
      </tr>
    {/each}
  </tbody>
</table>
<p>
  {$_('docs.credits.s40')}
</p>

<hr />

<h2 id="see-also">{$_('docs.credits.s33')}</h2>
<ul>
  <li><a href={'/docs/getting-started'}>{$_('docs.credits.s36')}</a> {$_('docs.credits.s37')}</li>
</ul>
