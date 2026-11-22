import './EmptyState.css';

export function EmptyState() {
  return (
    <section className="fl-empty-state">
      <div className="box fl-dots">
        <div className="art"><svg className="fl-px" viewBox="0 0 10 8" aria-hidden="true"><path d="M1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM6 0h1v1h-1zM7 0h1v1h-1zM8 0h1v1h-1zM1 1h1v1h-1zM8 1h1v1h-1zM0 2h1v1h-1zM9 2h1v1h-1zM0 3h1v1h-1zM9 3h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM8 4h1v1h-1zM9 4h1v1h-1zM0 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM9 5h1v1h-1zM0 6h1v1h-1zM9 6h1v1h-1zM0 7h1v1h-1zM1 7h1v1h-1zM2 7h1v1h-1zM3 7h1v1h-1zM4 7h1v1h-1zM5 7h1v1h-1zM6 7h1v1h-1zM7 7h1v1h-1zM8 7h1v1h-1zM9 7h1v1h-1z" /></svg></div>
        <h2>no projects yet</h2>
        <p>Projects keep your pages, assets and people together. Start one from scratch or import what you have.</p>
        <div className="cta">
          <a className="fl-btn fl-btn--primary" href="#">New project</a>
          <a className="fl-btn" href="#">Import</a>
        </div>
      </div>
    </section>
  );
}
