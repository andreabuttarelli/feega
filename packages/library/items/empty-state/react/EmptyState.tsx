import './EmptyState.css';

export function EmptyState() {
  return (
    <section className="fl-empty-state">
      <span className="icon"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 13l2-8h12l2 8v6H4z" /><path d="M4 13h5l1 2h4l1-2h5" /></svg></span>
      <h2>No projects yet</h2>
      <p>Create your first project to get started.</p>
      <a className="fl-btn fl-btn--primary" href="#">New project</a>
    </section>
  );
}
