import { useRef } from 'react';
import './Modal.css';

export function Modal() {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <div className="fl-modal">
      <button className="fl-btn" type="button" onClick={() => dialog.current?.showModal()}>Open modal</button>
      <dialog ref={dialog} aria-label="Confirm action">
        <form method="dialog">
          <h2>Confirm action</h2>
          <p>Explain what will happen when the user confirms.</p>
          <div className="actions">
            <button className="fl-btn" value="cancel">Cancel</button>
            <button className="fl-btn fl-btn--primary" value="confirm">Confirm</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
