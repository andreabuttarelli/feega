import { useState } from 'react';
import './Toast.css';

const initial = [
  { id: 1, text: 'Changes saved.', error: false },
  { id: 2, text: 'Could not save. Try again.', error: true }
];

export function Toast() {
  const [toasts, setToasts] = useState(initial);

  return (
    <div className="fl-toast" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <div key={toast.id} className={toast.error ? 'toast toast--error' : 'toast'} role={toast.error ? 'alert' : 'status'}>
          <p>{toast.text}</p>
          <button type="button" aria-label="Dismiss" onClick={() => setToasts(toasts.filter((t) => t.id !== toast.id))}>&times;</button>
        </div>
      ))}
    </div>
  );
}
