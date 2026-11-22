<script lang="ts">
  const tabs = [
    { label: 'Overview', title: 'Traffic is up this week', body: 'Visits grew 12% against last week, led by the pricing page.' },
    { label: 'Activity', title: 'Three changes today', body: 'Two pages published and one form edited, all by your team.' },
    { label: 'Settings', title: 'Workspace defaults', body: 'Pick who can publish, the default theme and the time zone.' }
  ];

  let active = $state(0);
  let buttons: HTMLButtonElement[] = [];

  function onkeydown(event: KeyboardEvent) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) {
      return;
    }
    active = (active + step + tabs.length) % tabs.length;
    buttons[active].focus();
  }
</script>

<div class="fl-tabs">
  <div class="list" role="tablist" aria-label="Sections" tabindex="-1" {onkeydown}>
    {#each tabs as tab, i}
      <button class="tab" role="tab" type="button" id="fl-tab-{i}" aria-controls="fl-panel-{i}" aria-selected={active === i} tabindex={active === i ? 0 : -1} bind:this={buttons[i]} onclick={() => (active = i)}>{tab.label}</button>
    {/each}
  </div>
  {#each tabs as tab, i}
    <div class="panel" role="tabpanel" id="fl-panel-{i}" aria-labelledby="fl-tab-{i}" tabindex="0" hidden={active !== i}><h3>{tab.title}</h3><p>{tab.body}</p></div>
  {/each}
</div>

<style>
.fl-tabs{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-tabs) *,:where(.fl-tabs) *::before,:where(.fl-tabs) *::after{box-sizing:border-box}
:where(.fl-tabs) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-tabs) a{color:inherit;text-decoration:none}
:where(.fl-tabs) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-tabs{padding:var(--feega-space-6) var(--feega-gutter)}
.fl-tabs .list{display:inline-flex;gap:2px;max-width:100%;padding:4px;overflow-x:auto;border-radius:var(--feega-radius-full);background:var(--feega-surface)}
.fl-tabs .tab{min-height:34px;padding:0 var(--feega-space-4);border:0;border-radius:var(--feega-radius-full);background:transparent;color:var(--feega-fg-muted);font:inherit;font-size:var(--feega-text-sm);font-weight:500;letter-spacing:var(--feega-tracking);white-space:nowrap;cursor:pointer;transition:background-color var(--feega-dur) var(--feega-ease),color var(--feega-dur-fast) var(--feega-ease),box-shadow var(--feega-dur) var(--feega-ease)}
.fl-tabs .tab:hover{color:var(--feega-fg)}
.fl-tabs .tab[aria-selected="true"]{background:var(--feega-raised);color:var(--feega-fg);box-shadow:var(--feega-shadow)}
.fl-tabs .panel{display:grid;gap:var(--feega-space-2);max-width:36rem;padding:var(--feega-space-6) var(--feega-space-2);animation:fl-tabs-in var(--feega-dur) var(--feega-ease)}
.fl-tabs .panel[hidden]{display:none}
.fl-tabs .panel h3{font-size:var(--feega-text-xl);font-weight:500;letter-spacing:-0.04em}
.fl-tabs .panel p{color:var(--feega-fg-muted)}
@keyframes fl-tabs-in{from{opacity:0;transform:translateY(6px)}}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
