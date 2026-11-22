<script lang="ts">
  function mount(root: HTMLElement): () => void {
    const stop = new AbortController();
    const { signal } = stop;
    const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const panels = Array.from(root.querySelectorAll<HTMLElement>('[role="tabpanel"]'));

    function select(index: number) {
      tabs.forEach((tab, i) => {
        tab.setAttribute('aria-selected', String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
        panels[i].hidden = i !== index;
      });
      tabs[index].focus();
    }

    tabs.forEach((tab, i) => tab.addEventListener('click', () => select(i), { signal }));
    root.querySelector('[role="tablist"]')?.addEventListener(
      'keydown',
      (event) => {
        const key = (event as KeyboardEvent).key;
        const step = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
        if (step === 0) {
          return;
        }
        select((tabs.indexOf(document.activeElement as HTMLButtonElement) + step + tabs.length) % tabs.length);
      },
      { signal }
    );

    return () => stop.abort();
  }

  let root: HTMLElement;

  $effect(() => mount(root));
</script>

<div class="fl-tabs" bind:this={root}>
  <div class="list" role="tablist" aria-label="Sections">
    <button class="tab" role="tab" type="button" id="fl-tab-1" aria-controls="fl-panel-1" aria-selected="true">Overview</button>
    <button class="tab" role="tab" type="button" id="fl-tab-2" aria-controls="fl-panel-2" aria-selected="false" tabindex="-1">Activity</button>
    <button class="tab" role="tab" type="button" id="fl-tab-3" aria-controls="fl-panel-3" aria-selected="false" tabindex="-1">Settings</button>
  </div>
  <div class="panel" role="tabpanel" id="fl-panel-1" aria-labelledby="fl-tab-1" tabindex="0"><h3>Traffic is up this week</h3><p>Visits grew 12% against last week, led by the pricing page.</p></div>
  <div class="panel" role="tabpanel" id="fl-panel-2" aria-labelledby="fl-tab-2" tabindex="0" hidden><h3>Three changes today</h3><p>Two pages published and one form edited, all by your team.</p></div>
  <div class="panel" role="tabpanel" id="fl-panel-3" aria-labelledby="fl-tab-3" tabindex="0" hidden><h3>Workspace defaults</h3><p>Pick who can publish, the default theme and the time zone.</p></div>
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
