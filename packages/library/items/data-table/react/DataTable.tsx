import './DataTable.css';

export function DataTable() {
  return (
    <section className="fl-data-table">
      <header className="head">
        <div><h2>Members</h2><p>24 people in this workspace.</p></div>
        <div className="tools">
          <label className="search"><svg className="fl-px" viewBox="0 0 7 7" aria-hidden="true"><path d="M1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM0 1h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM0 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 5h1v1h-1zM6 6h1v1h-1z" /></svg><input type="search" placeholder="Filter members" aria-label="Filter members" /></label>
          <button className="fl-btn fl-btn--sm fl-btn--ink" type="button"><svg className="fl-px" viewBox="0 0 6 6" aria-hidden="true"><path d="M2 0h1v1h-1zM3 0h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>Invite</button>
        </div>
      </header>
      <div className="scroll">
        <table>
          <thead>
            <tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Last active</th><th scope="col"><span className="sr">Actions</span></th></tr>
          </thead>
          <tbody>
            <tr><td><span className="who"><span className="fl-avatar" aria-hidden="true">SE</span><span><b>Sam Example</b><small>sam@example.com</small></span></span></td><td>Owner</td><td><span className="fl-badge fl-badge--success">Active</span></td><td className="mono">2 min ago</td><td><button className="more" type="button" aria-label="Actions for Sam Example"><svg className="fl-px" viewBox="0 0 5 1" aria-hidden="true"><path d="M0 0h1v1h-1zM2 0h1v1h-1zM4 0h1v1h-1z" /></svg></button></td></tr>
            <tr><td><span className="who"><span className="fl-avatar" aria-hidden="true">RS</span><span><b>Robin Sample</b><small>robin@example.com</small></span></span></td><td>Admin</td><td><span className="fl-badge fl-badge--success">Active</span></td><td className="mono">1 h ago</td><td><button className="more" type="button" aria-label="Actions for Robin Sample"><svg className="fl-px" viewBox="0 0 5 1" aria-hidden="true"><path d="M0 0h1v1h-1zM2 0h1v1h-1zM4 0h1v1h-1z" /></svg></button></td></tr>
            <tr><td><span className="who"><span className="fl-avatar" aria-hidden="true">KP</span><span><b>Kai Placeholder</b><small>kai@example.com</small></span></span></td><td>Editor</td><td><span className="fl-badge">Invited</span></td><td className="mono">never</td><td><button className="more" type="button" aria-label="Actions for Kai Placeholder"><svg className="fl-px" viewBox="0 0 5 1" aria-hidden="true"><path d="M0 0h1v1h-1zM2 0h1v1h-1zM4 0h1v1h-1z" /></svg></button></td></tr>
            <tr><td><span className="who"><span className="fl-avatar" aria-hidden="true">AD</span><span><b>Alex Demo</b><small>alex@example.com</small></span></span></td><td>Viewer</td><td><span className="fl-badge fl-badge--danger">Suspended</span></td><td className="mono">12 days ago</td><td><button className="more" type="button" aria-label="Actions for Alex Demo"><svg className="fl-px" viewBox="0 0 5 1" aria-hidden="true"><path d="M0 0h1v1h-1zM2 0h1v1h-1zM4 0h1v1h-1z" /></svg></button></td></tr>
          </tbody>
        </table>
      </div>
      <footer className="foot">
        <p>Showing 1–4 of 24</p>
        <div><button className="fl-btn fl-btn--sm" type="button" disabled>Previous</button><button className="fl-btn fl-btn--sm" type="button">Next</button></div>
      </footer>
    </section>
  );
}
