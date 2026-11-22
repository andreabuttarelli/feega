import './FooterNewsletter.css';

export function FooterNewsletter() {
  return (
    <footer className="fl-footer-newsletter">
      <div className="fl-container grid">
        <form className="news" action="#">
          <a className="brand" href="#" aria-label="Yourbrand home"><svg className="fl-px" viewBox="0 0 5 5" aria-hidden="true"><path d="M2 0h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM2 4h1v1h-1z" /></svg><span>yourbrand</span></a>
          <label className="fl-field" htmlFor="fl-footer-email">get the monthly update
            <span className="row"><input className="fl-input" id="fl-footer-email" type="email" placeholder="you@example.com" autoComplete="email" required /><button className="fl-btn fl-btn--primary" type="submit">subscribe</button></span>
          </label>
          <small>One email a month. Unsubscribe in one click.</small>
        </form>
        <nav className="cols" aria-label="Footer">
          <div><p>product</p><ul><li><a href="#">features</a></li><li><a href="#">pricing</a></li><li><a href="#">changelog</a></li></ul></div>
          <div><p>company</p><ul><li><a href="#">about</a></li><li><a href="#">careers</a></li><li><a href="#">contact</a></li></ul></div>
          <div><p>resources</p><ul><li><a href="#">docs</a></li><li><a href="#">guides</a></li><li><a href="#">status</a></li></ul></div>
        </nav>
      </div>
      <div className="fl-container legal"><span>© 2026 Yourbrand</span><span><a href="#">privacy</a><a href="#">terms</a><a href="#">cookies</a></span></div>
    </footer>
  );
}
