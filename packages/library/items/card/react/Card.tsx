import './Card.css';

export function Card() {
  return (
    <article className="fl-card">
      <div className="fl-media" role="img" aria-label="Placeholder image"></div>
      <div className="body">
        <h3>Card title</h3>
        <p>A short description of what this card links to.</p>
        <a href="#">Read more</a>
      </div>
    </article>
  );
}
