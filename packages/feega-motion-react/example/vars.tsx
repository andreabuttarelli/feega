import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FeegaMotion, type VarDecl, type VarValues } from '@feega/motion-react';

const params = new URLSearchParams(location.search);
const id = params.get('id') ?? 'your-embed-id';
const origin = params.get('origin') ?? undefined;

function App() {
  const [speed, setSpeed] = useState(1);
  const [spin, setSpin] = useState(true);
  const [label, setLabel] = useState('Hello');
  const [tint, setTint] = useState('#ffffff');
  const [schema, setSchema] = useState<VarDecl[]>([]);
  const [kept, setKept] = useState<VarValues>({});

  return (
    <main>
      <FeegaMotion id={id} origin={origin} vars={{ speed, spin, label, tint }} onReady={(info) => setSchema(info.vars)} onVarsChange={setKept} />
      <form id="controls">
        <label>
          speed <input name="speed" type="range" min="0" max="5" step="0.1" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
        </label>
        <label>
          <span>
            <input name="spin" type="checkbox" checked={spin} onChange={(e) => setSpin(e.target.checked)} /> spin
          </span>
        </label>
        <label>
          label <input name="label" type="text" value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label>
          tint <input name="tint" type="color" value={tint} onChange={(e) => setTint(e.target.value)} />
        </label>
        <pre id="echo">{schema.length ? `schema ${schema.map((v) => `${v.name}:${v.kind}`).join(' ')}\nplayer kept ${JSON.stringify(kept)}` : 'waiting for the player…'}</pre>
      </form>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
