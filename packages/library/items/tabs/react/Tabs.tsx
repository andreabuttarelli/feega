import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import './Tabs.css';

const tabs = [
  { label: 'Overview', body: 'Overview content.' },
  { label: 'Activity', body: 'Activity content.' },
  { label: 'Settings', body: 'Settings content.' }
];

export function Tabs() {
  const uid = useId();
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) {
      return;
    }
    const next = (active + step + tabs.length) % tabs.length;
    setActive(next);
    buttons.current[next]?.focus();
  }

  return (
    <div className="fl-tabs">
      <div className="list" role="tablist" aria-label="Sections" onKeyDown={onKeyDown}>
        {tabs.map((tab, i) => (
          <button key={tab.label} ref={(el) => { buttons.current[i] = el; }} className="tab" role="tab" type="button" id={`${uid}-tab-${i}`} aria-controls={`${uid}-panel-${i}`} aria-selected={active === i} tabIndex={active === i ? 0 : -1} onClick={() => setActive(i)}>{tab.label}</button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div key={tab.label} className="panel" role="tabpanel" id={`${uid}-panel-${i}`} aria-labelledby={`${uid}-tab-${i}`} tabIndex={0} hidden={active !== i}><p>{tab.body}</p></div>
      ))}
    </div>
  );
}
