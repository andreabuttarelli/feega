import './Navbar.css';

export function Navbar() {
  return (
    <header className="fl-navbar">
      <div className="fl-container bar">
        <a className="brand" href="#" aria-label="Yourbrand home"><svg className="fl-px" viewBox="0 0 5 5" aria-hidden="true"><path d="M2 0h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM2 4h1v1h-1z" /></svg><span>yourbrand</span></a>
        <nav aria-label="Primary">
          <ul className="links">
            <li><a href="#" aria-current="page">product</a></li>
            <li><a href="#">pricing</a></li>
            <li><a href="#">docs</a></li>
            <li><a href="#">blog</a></li>
            <li><a href="#">changelog</a></li>
          </ul>
        </nav>
        <div className="actions">
          <a className="login" href="#">log in</a>
          <a className="fl-btn fl-btn--primary fl-btn--sm" href="#">get started</a>
          <details className="menu">
            <summary aria-label="Menu"><svg className="fl-px" viewBox="0 0 6 5" aria-hidden="true"><path d="M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1z" /></svg></summary>
            <ul>
              <li><a href="#">product</a></li>
              <li><a href="#">pricing</a></li>
              <li><a href="#">docs</a></li>
              <li><a href="#">blog</a></li>
              <li><a href="#">log in</a></li>
            </ul>
          </details>
        </div>
      </div>
    </header>
  );
}
