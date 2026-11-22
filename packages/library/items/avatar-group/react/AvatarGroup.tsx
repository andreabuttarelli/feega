import './AvatarGroup.css';

export function AvatarGroup() {
  return (
    <div className="fl-avatar-group">
      <div className="stack stack--sm" aria-label="6 people">
        <span className="fl-avatar">NS</span><span className="fl-avatar">FL</span><span className="fl-avatar">AE</span><span className="fl-avatar">SP</span><span className="fl-avatar more">+2</span>
      </div>
      <div className="stack stack--md" aria-label="6 people">
        <span className="fl-avatar">NS</span><span className="fl-avatar">FL</span><span className="fl-avatar">AE</span><span className="fl-avatar">SP</span><span className="fl-avatar more">+2</span>
      </div>
      <div className="stack stack--lg" aria-label="6 people">
        <span className="fl-avatar">NS</span><span className="fl-avatar">FL</span><span className="fl-avatar">AE</span><span className="fl-avatar">SP</span><span className="fl-avatar more">+2</span>
      </div>
    </div>
  );
}
