import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import './CommandPalette.css';

const commands = [
  { label: 'New project', group: 'Actions', keys: '⌘N' },
  { label: 'Invite people', group: 'Actions', keys: '⌘I' },
  { label: 'Open settings', group: 'Navigation', keys: '⌘,' },
  { label: 'Go to analytics', group: 'Navigation', keys: 'G A' },
  { label: 'Switch theme', group: 'Preferences', keys: '⌘T' },
  { label: 'Read the docs', group: 'Help', keys: '?' }
];

export function CommandPalette() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const shown = commands.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase()));

  function onKeyDown(event: KeyboardEvent) {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0 || shown.length === 0) {
      return;
    }
    event.preventDefault();
    setActive((active + step + shown.length) % shown.length);
  }

  return (
    <div className="fl-command-palette">
      <div className="box">
        <label className="search"><svg className="fl-px" viewBox="0 0 7 7" aria-hidden="true"><path d="M1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM0 1h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM0 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 5h1v1h-1zM6 6h1v1h-1z" /></svg><input type="text" placeholder="Type a command or search" aria-label="Command" role="combobox" aria-controls="fl-palette-list" aria-expanded="true" autoComplete="off" value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={onKeyDown} /><kbd className="esc">esc</kbd></label>
        <ul role="listbox" id="fl-palette-list" aria-label="Commands">
          {shown.map((command, i) => (
            <li key={command.label} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)}>{command.label}<small>{command.group}</small><kbd>{command.keys}</kbd></li>
          ))}
        </ul>
        <p className="none" hidden={shown.length > 0}>No results</p>
      </div>
    </div>
  );
}
