import { useState } from 'react';
import './Toast.css';

const initial = [
  { id: 1, title: 'Changes saved', body: 'Your profile is up to date.', error: false },
  { id: 2, title: 'Could not publish', body: 'Check your connection and try again.', error: true }
];

export function Toast() {
  const [toasts, setToasts] = useState(initial);

  return (
    <div className="fl-toast" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <div key={toast.id} className={toast.error ? 'toast toast--error' : 'toast'} role={toast.error ? 'alert' : 'status'}>
          <span className="mark">{toast.error ? <svg className="fl-px" viewBox="0 0 6 6" aria-hidden="true"><path d="M0 0h1v1h-1zM5 0h1v1h-1zM1 1h1v1h-1zM4 1h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM1 4h1v1h-1zM4 4h1v1h-1zM0 5h1v1h-1zM5 5h1v1h-1z" /></svg> : <svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>}</span>
          <p className="text"><b>{toast.title}</b><span>{toast.body}</span></p>
          <button className="close" type="button" aria-label="Dismiss" onClick={() => setToasts(toasts.filter((t) => t.id !== toast.id))}><svg className="fl-px" viewBox="0 0 6 6" aria-hidden="true"><path d="M0 0h1v1h-1zM5 0h1v1h-1zM1 1h1v1h-1zM4 1h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM1 4h1v1h-1zM4 4h1v1h-1zM0 5h1v1h-1zM5 5h1v1h-1z" /></svg></button>
        </div>
      ))}
    </div>
  );
}
