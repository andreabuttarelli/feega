import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FeegaMotion, type FeegaMotionHandle } from '@feega/motion-react';

const SATURN = 'c76b6d3b-8262-4b68-ad58-3cb51a6190a9';
const params = new URLSearchParams(location.search);
const id = params.get('id') ?? SATURN;
const origin = params.get('origin') ?? undefined;

function App() {
  const player = useRef<FeegaMotionHandle>(null);
  const [status, setStatus] = useState('loading');
  const [time, setTime] = useState(0);

  return (
    <>
      <div id="status" data-status={status}>
        {status} · {time.toFixed(2)}s
      </div>
      <section className="copy">
        <h1>Scroll to orbit Saturn</h1>
      </section>
      <FeegaMotion
        ref={player}
        id={id}
        origin={origin}
        onReady={(info) => setStatus(`ready ${info.playback} ${info.duration}s`)}
        onTimeUpdate={(t) => setTime(t)}
        onEnded={() => setStatus('ended')}
        onLinkClick={(url) => window.open(url, '_blank', 'noopener')}
        onError={(message) => setStatus(`error ${message}`)}
      />
      <section className="copy">
        <p>A card that fits its box, contained:</p>
      </section>
      <div className="card">
        <FeegaMotion id={id} origin={origin} fit="contain" scrollLength={0} />
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
