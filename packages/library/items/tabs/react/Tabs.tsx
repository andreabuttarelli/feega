import { useEffect, useRef } from 'react';
import './Tabs.css';

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

export function Tabs() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => (root.current ? mount(root.current) : undefined), []);

  return (
    <div className="fl-tabs" ref={root}>
      <div className="list" role="tablist" aria-label="Sections">
        <button className="tab" role="tab" type="button" id="fl-tab-1" aria-controls="fl-panel-1" aria-selected="true">Overview</button>
        <button className="tab" role="tab" type="button" id="fl-tab-2" aria-controls="fl-panel-2" aria-selected="false" tabIndex={-1}>Activity</button>
        <button className="tab" role="tab" type="button" id="fl-tab-3" aria-controls="fl-panel-3" aria-selected="false" tabIndex={-1}>Settings</button>
      </div>
      <div className="panel" role="tabpanel" id="fl-panel-1" aria-labelledby="fl-tab-1" tabIndex={0}><h3>Traffic is up this week</h3><p>Visits grew 12% against last week, led by the pricing page.</p></div>
      <div className="panel" role="tabpanel" id="fl-panel-2" aria-labelledby="fl-tab-2" tabIndex={0} hidden><h3>Three changes today</h3><p>Two pages published and one form edited, all by your team.</p></div>
      <div className="panel" role="tabpanel" id="fl-panel-3" aria-labelledby="fl-tab-3" tabIndex={0} hidden><h3>Workspace defaults</h3><p>Pick who can publish, the default theme and the time zone.</p></div>
    </div>
  );
}
