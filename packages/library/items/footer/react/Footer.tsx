import './Footer.css';

export function Footer() {
  return (
    <footer className="fl-footer">
      <div className="fl-container">
        <div className="top">
          <div className="about">
            <a className="brand" href="#" aria-label="Yourbrand home"><svg className="fl-px" viewBox="0 0 5 5" aria-hidden="true"><path d="M2 0h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM2 4h1v1h-1z" /></svg><span>yourbrand</span></a>
            <p>One line on what the product is and who it is for.</p>
            <p className="status"><span></span>all systems normal</p>
          </div>
          <nav aria-label="Footer" className="cols">
            <div><h3>product</h3><ul><li><a href="#">features</a></li><li><a href="#">pricing</a></li><li><a href="#">changelog</a></li><li><a href="#">roadmap</a></li></ul></div>
            <div><h3>company</h3><ul><li><a href="#">about</a></li><li><a href="#">blog</a></li><li><a href="#">careers</a></li><li><a href="#">contact</a></li></ul></div>
            <div><h3>resources</h3><ul><li><a href="#">docs</a></li><li><a href="#">guides</a></li><li><a href="#">support</a></li><li><a href="#">status</a></li></ul></div>
          </nav>
        </div>
        <p className="word" aria-hidden="true">yourbrand</p>
        <div className="bottom">
          <p>&copy; 2026 Yourbrand</p>
          <ul><li><a href="#">privacy</a></li><li><a href="#">terms</a></li><li><a href="#">cookies</a></li></ul>
        </div>
      </div>
    </footer>
  );
}
