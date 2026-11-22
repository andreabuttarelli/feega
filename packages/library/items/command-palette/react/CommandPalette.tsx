import { useEffect, useRef } from 'react';
import './CommandPalette.css';

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

export function CommandPalette() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => (root.current ? mount(root.current) : undefined), []);

  return (
    <div className="fl-command-palette" ref={root}>
      <div className="box">
        <label className="search"><svg className="fl-px" viewBox="0 0 7 7" aria-hidden="true"><path d="M1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM0 1h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM0 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 5h1v1h-1zM6 6h1v1h-1z" /></svg><input type="text" placeholder="Type a command or search" aria-label="Command" aria-controls="fl-palette-list" role="combobox" aria-expanded="true" autoComplete="off" /><kbd className="esc">esc</kbd></label>
        <ul role="listbox" id="fl-palette-list" aria-label="Commands">
          <li role="option" aria-selected="true" data-label="new project">New project<small>Actions</small><kbd>⌘N</kbd></li>
          <li role="option" aria-selected="false" data-label="invite people">Invite people<small>Actions</small><kbd>⌘I</kbd></li>
          <li role="option" aria-selected="false" data-label="open settings">Open settings<small>Navigation</small><kbd>⌘,</kbd></li>
          <li role="option" aria-selected="false" data-label="go to analytics">Go to analytics<small>Navigation</small><kbd>G A</kbd></li>
          <li role="option" aria-selected="false" data-label="switch theme">Switch theme<small>Preferences</small><kbd>⌘T</kbd></li>
          <li role="option" aria-selected="false" data-label="read the docs">Read the docs<small>Help</small><kbd>?</kbd></li>
        </ul>
        <p className="none" hidden>No results</p>
      </div>
    </div>
  );
}
