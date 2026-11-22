<script lang="ts">
  function mount(root: HTMLElement): () => void {
    const stop = new AbortController();
    const { signal } = stop;
    const input = root.querySelector<HTMLInputElement>('input')!;
    const items = Array.from(root.querySelectorAll<HTMLLIElement>('[role="option"]'));
    const none = root.querySelector<HTMLElement>('.none')!;
    let active = 0;

    function visible() {
      return items.filter((item) => !item.hidden);
    }

    function paint() {
      const shown = visible();
      items.forEach((item) => item.setAttribute('aria-selected', String(item === shown[active])));
      none.hidden = shown.length > 0;
    }

    input.addEventListener(
      'input',
      () => {
        const query = input.value.trim().toLowerCase();
        items.forEach((item) => {
          item.hidden = !(item.dataset.label ?? '').includes(query);
        });
        active = 0;
        paint();
      },
      { signal }
    );

    input.addEventListener(
      'keydown',
      (event) => {
        const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
        const count = visible().length;
        if (step === 0 || count === 0) {
          return;
        }
        event.preventDefault();
        active = (active + step + count) % count;
        paint();
      },
      { signal }
    );

    items.forEach((item) =>
      item.addEventListener(
        'mouseenter',
        () => {
          active = visible().indexOf(item);
          paint();
        },
        { signal }
      )
    );

    return () => stop.abort();
  }

  let root: HTMLElement;

  $effect(() => mount(root));
</script>

<div class="fl-command-palette" bind:this={root}>
  <div class="box">
    <label class="search"><svg class="fl-px" viewBox="0 0 7 7" aria-hidden="true"><path d="M1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM0 1h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM0 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 5h1v1h-1zM6 6h1v1h-1z" /></svg><input type="text" placeholder="Type a command or search" aria-label="Command" aria-controls="fl-palette-list" role="combobox" aria-expanded="true" autocomplete="off" /><kbd class="esc">esc</kbd></label>
    <ul role="listbox" id="fl-palette-list" aria-label="Commands">
      <li role="option" aria-selected="true" data-label="new project">New project<small>Actions</small><kbd>⌘N</kbd></li>
      <li role="option" aria-selected="false" data-label="invite people">Invite people<small>Actions</small><kbd>⌘I</kbd></li>
      <li role="option" aria-selected="false" data-label="open settings">Open settings<small>Navigation</small><kbd>⌘,</kbd></li>
      <li role="option" aria-selected="false" data-label="go to analytics">Go to analytics<small>Navigation</small><kbd>G A</kbd></li>
      <li role="option" aria-selected="false" data-label="switch theme">Switch theme<small>Preferences</small><kbd>⌘T</kbd></li>
      <li role="option" aria-selected="false" data-label="read the docs">Read the docs<small>Help</small><kbd>?</kbd></li>
    </ul>
    <p class="none" hidden>No results</p>
  </div>
</div>

<style>
.fl-command-palette{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-command-palette) *,:where(.fl-command-palette) *::before,:where(.fl-command-palette) *::after{box-sizing:border-box}
:where(.fl-command-palette) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-command-palette) a{color:inherit;text-decoration:none}
:where(.fl-command-palette) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-px{display:block;flex:none;width:1em;height:auto;fill:currentColor;shape-rendering:crispEdges}
.fl-command-palette{padding:var(--feega-space-6) var(--feega-gutter)}
.fl-command-palette .box{max-width:34rem;margin-inline:auto;overflow:hidden;border-radius:var(--feega-radius-lg);background:var(--feega-raised);box-shadow:var(--feega-shadow-float),inset 0 0 0 1px var(--feega-line);animation:fl-command-palette-in var(--feega-dur) var(--feega-ease)}
@keyframes fl-command-palette-in{from{opacity:0;transform:scale(0.97) translateY(8px)}}
.fl-command-palette .search{display:flex;align-items:center;gap:var(--feega-space-3);padding:0 var(--feega-space-4);border-bottom:1px solid var(--feega-line);color:var(--feega-fg-subtle)}
.fl-command-palette .search .fl-px{width:14px}
.fl-command-palette input{flex:1;min-width:0;height:52px;border:0;background:transparent;color:var(--feega-fg);font:inherit;font-size:1.0625rem;letter-spacing:var(--feega-tracking);outline:none}
.fl-command-palette input::placeholder{color:var(--feega-fg-subtle)}
.fl-command-palette .esc{padding:2px 6px;border-radius:var(--feega-radius-xs);background:var(--feega-surface);font-family:var(--feega-font-mono);font-size:11px}
.fl-command-palette ul{display:grid;max-height:18rem;margin:0;padding:6px;overflow-y:auto;list-style:none}
.fl-command-palette li{position:relative;display:flex;align-items:center;gap:var(--feega-space-3);min-height:42px;padding:0 12px;border-radius:var(--feega-radius-sm);font-size:var(--feega-text-sm);font-weight:500;cursor:pointer}
.fl-command-palette li[aria-selected="true"]{background:var(--feega-surface)}
.fl-command-palette li[aria-selected="true"]::before{content:"";position:absolute;left:3px;width:3px;height:16px;border-radius:var(--feega-radius-full);background:var(--feega-accent)}
.fl-command-palette li small{color:var(--feega-fg-subtle);font-weight:400}
.fl-command-palette li kbd{margin-left:auto;font-family:var(--feega-font-mono);font-size:11px;color:var(--feega-fg-subtle)}
.fl-command-palette .none{padding:var(--feega-space-8) var(--feega-space-4);color:var(--feega-fg-muted);font-size:var(--feega-text-sm);text-align:center}
.fl-command-palette .none[hidden]{display:none}
.fl-command-palette li[hidden]{display:none}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
