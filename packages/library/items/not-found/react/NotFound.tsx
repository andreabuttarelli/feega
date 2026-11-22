import './NotFound.css';

export function NotFound() {
  return (
    <section className="fl-not-found fl-dots">
      <div className="inner">
        <p className="code" aria-hidden="true">404</p>
        <h1>this page wandered off</h1>
        <p className="lead">The link may be old or mistyped. Try the home page or search.</p>
        <div className="cta"><a className="fl-btn fl-btn--primary" href="#">back home</a><a className="fl-btn" href="#"><svg className="fl-px" viewBox="0 0 7 7" aria-hidden="true"><path d="M1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM0 1h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM0 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 5h1v1h-1zM6 6h1v1h-1z" /></svg> search</a></div>
      </div>
    </section>
  );
}
