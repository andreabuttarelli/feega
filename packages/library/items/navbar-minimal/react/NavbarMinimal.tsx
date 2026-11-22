import './NavbarMinimal.css';

export function NavbarMinimal() {
  return (
    <header className="fl-navbar-minimal">
      <div className="fl-container bar">
        <a className="brand" href="#" aria-label="Yourbrand home"><svg className="fl-px" viewBox="0 0 5 5" aria-hidden="true"><path d="M2 0h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM2 4h1v1h-1z" /></svg><span>yourbrand</span></a>
        <a className="fl-btn fl-btn--primary fl-btn--sm" href="#">get started <svg className="fl-px" viewBox="0 0 7 5" aria-hidden="true"><path d="M4 0h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM5 3h1v1h-1zM4 4h1v1h-1z" /></svg></a>
      </div>
    </header>
  );
}
