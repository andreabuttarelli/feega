import './FooterMinimal.css';

export function FooterMinimal() {
  return (
    <footer className="fl-footer-minimal">
      <div className="fl-container row">
        <span className="brand"><svg className="fl-px" viewBox="0 0 5 5" aria-hidden="true"><path d="M2 0h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM2 4h1v1h-1z" /></svg>© 2026 Yourbrand</span>
        <nav aria-label="Footer"><a href="#">privacy</a><a href="#">terms</a><a href="#">docs</a><a href="#">contact</a></nav>
        <span className="status"><i></i>all systems normal</span>
      </div>
    </footer>
  );
}
