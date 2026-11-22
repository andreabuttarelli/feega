import { useEffect, useRef } from 'react';
import './Toast.css';

function mount(root: HTMLElement): () => void {
  const stop = new AbortController();
  root.addEventListener(
    'click',
    (event) => (event.target as Element).closest('.close')?.closest('.toast')?.remove(),
    { signal: stop.signal }
  );
  return () => stop.abort();
}

export function Toast() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => (root.current ? mount(root.current) : undefined), []);

  return (
    <div className="fl-toast" role="region" aria-label="Notifications" ref={root}>
      <div className="toast" role="status">
        <span className="mark"><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg></span>
        <p className="text"><b>Changes saved</b><span>Your profile is up to date.</span></p>
        <button className="close" type="button" aria-label="Dismiss"><svg className="fl-px" viewBox="0 0 6 6" aria-hidden="true"><path d="M0 0h1v1h-1zM5 0h1v1h-1zM1 1h1v1h-1zM4 1h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM1 4h1v1h-1zM4 4h1v1h-1zM0 5h1v1h-1zM5 5h1v1h-1z" /></svg></button>
      </div>
      <div className="toast toast--error" role="alert">
        <span className="mark"><svg className="fl-px" viewBox="0 0 6 6" aria-hidden="true"><path d="M0 0h1v1h-1zM5 0h1v1h-1zM1 1h1v1h-1zM4 1h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM1 4h1v1h-1zM4 4h1v1h-1zM0 5h1v1h-1zM5 5h1v1h-1z" /></svg></span>
        <p className="text"><b>Could not publish</b><span>Check your connection and try again.</span></p>
        <button className="close" type="button" aria-label="Dismiss"><svg className="fl-px" viewBox="0 0 6 6" aria-hidden="true"><path d="M0 0h1v1h-1zM5 0h1v1h-1zM1 1h1v1h-1zM4 1h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM1 4h1v1h-1zM4 4h1v1h-1zM0 5h1v1h-1zM5 5h1v1h-1z" /></svg></button>
      </div>
    </div>
  );
}
