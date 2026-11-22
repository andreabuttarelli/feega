import './SidebarLayout.css';

export function SidebarLayout() {
  return (
    <div className="fl-sidebar-layout">
      <aside className="side">
        <a className="brand" href="#"><svg className="fl-px" viewBox="0 0 5 5" aria-hidden="true"><path d="M2 0h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM2 4h1v1h-1z" /></svg><span>yourbrand</span></a>
        <label className="search"><svg className="fl-px" viewBox="0 0 7 7" aria-hidden="true"><path d="M1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM0 1h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM0 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 5h1v1h-1zM6 6h1v1h-1z" /></svg><input type="search" placeholder="Search" aria-label="Search" /><kbd>⌘K</kbd></label>
        <nav aria-label="Main">
          <ul>
            <li><a href="#" aria-current="page"><svg className="fl-px" viewBox="0 0 8 7" aria-hidden="true"><path d="M3 0h1v1h-1zM4 0h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM4 1h1v1h-1zM5 1h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM6 3h1v1h-1zM7 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1z" /></svg>Overview</a></li>
            <li><a href="#"><svg className="fl-px" viewBox="0 0 7 7" aria-hidden="true"><path d="M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM6 0h1v1h-1zM0 1h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM4 1h1v1h-1zM5 1h1v1h-1zM6 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM4 5h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM0 6h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM4 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1z" /></svg>Projects</a></li>
            <li><a href="#"><svg className="fl-px" viewBox="0 0 8 7" aria-hidden="true"><path d="M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM6 0h1v1h-1zM7 0h1v1h-1zM0 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM5 2h1v1h-1zM7 2h1v1h-1zM0 3h1v1h-1zM7 3h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM1 6h1v1h-1z" /></svg>Inbox<span className="count">3</span></a></li>
            <li><a href="#"><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M6 0h1v1h-1zM7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM6 2h1v1h-1zM7 2h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM6 3h1v1h-1zM7 3h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM6 5h1v1h-1zM7 5h1v1h-1z" /></svg>Analytics</a></li>
            <li><a href="#"><svg className="fl-px" viewBox="0 0 8 8" aria-hidden="true"><path d="M2 0h1v1h-1zM5 0h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM4 1h1v1h-1zM5 1h1v1h-1zM6 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM6 2h1v1h-1zM7 2h1v1h-1zM1 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM6 3h1v1h-1zM1 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM6 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM6 5h1v1h-1zM7 5h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM3 6h1v1h-1zM4 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1zM2 7h1v1h-1zM5 7h1v1h-1z" /></svg>Settings</a></li>
          </ul>
        </nav>
        <div className="me"><span className="fl-avatar" aria-hidden="true">NS</span><span><b>Name Surname</b><small>name@example.com</small></span></div>
      </aside>
      <main className="main">
        <header className="head">
          <h1>overview</h1>
          <a className="new" href="#"><svg className="fl-px" viewBox="0 0 6 6" aria-hidden="true"><path d="M2 0h1v1h-1zM3 0h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg>New project</a>
        </header>
        <ul className="stats">
          <li><span>Visitors</span><b>8,204</b><em className="fl-badge fl-badge--success">+12%</em></li>
          <li><span>Signups</span><b>312</b><em className="fl-badge fl-badge--success">+4%</em></li>
          <li><span>Churn</span><b>1.8%</b><em className="fl-badge fl-badge--danger">+0.3%</em></li>
        </ul>
        <div className="slot">Your page content goes here</div>
      </main>
    </div>
  );
}
