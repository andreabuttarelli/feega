import './TopBar.css';

export function TopBar() {
  return (
    <header className="fl-top-bar">
      <h1>Projects</h1>
      <form role="search" className="search">
        <input type="search" placeholder="Search" aria-label="Search" />
      </form>
      <button className="avatar" type="button" aria-label="Open account menu">AB</button>
    </header>
  );
}
