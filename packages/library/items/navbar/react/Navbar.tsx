import './Navbar.css';

export function Navbar() {
  return (
    <header className="fl-navbar">
      <div className="fl-container bar">
        <a className="brand" href="#">Brand</a>
        <nav aria-label="Primary">
          <ul className="links">
            <li><a href="#">Product</a></li>
            <li><a href="#">Pricing</a></li>
            <li><a href="#">Docs</a></li>
            <li><a href="#">Blog</a></li>
          </ul>
        </nav>
        <div className="actions">
          <a className="fl-btn" href="#">Log in</a>
          <a className="fl-btn fl-btn--primary" href="#">Get started</a>
        </div>
      </div>
    </header>
  );
}
