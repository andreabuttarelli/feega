import './Footer.css';

export function Footer() {
  return (
    <footer className="fl-footer">
      <div className="fl-container">
        <div className="top">
          <div className="about">
            <a className="brand" href="#">Brand</a>
            <p>A one-line description of what you make.</p>
          </div>
          <nav aria-label="Product"><h2>Product</h2><ul><li><a href="#">Features</a></li><li><a href="#">Pricing</a></li><li><a href="#">Changelog</a></li></ul></nav>
          <nav aria-label="Company"><h2>Company</h2><ul><li><a href="#">About</a></li><li><a href="#">Blog</a></li><li><a href="#">Contact</a></li></ul></nav>
          <nav aria-label="Legal"><h2>Legal</h2><ul><li><a href="#">Privacy</a></li><li><a href="#">Terms</a></li></ul></nav>
        </div>
        <p className="legal">Brand. All rights reserved.</p>
      </div>
    </footer>
  );
}
