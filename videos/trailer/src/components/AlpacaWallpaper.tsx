type Alpaca = { x: number; y: number; size: number; wool: string; shade: string; face: string; flip: boolean; shades: boolean };

const ALPACAS: Alpaca[] = [
  { x: 330, y: 700, size: 1.15, wool: "#f6ead2", shade: "#e6d3ad", face: "#efdcb8", flip: false, shades: false },
  { x: 760, y: 640, size: 0.8, wool: "#a8714a", shade: "#8c5a38", face: "#c48d62", flip: true, shades: false },
  { x: 1290, y: 675, size: 1.3, wool: "#ffffff", shade: "#e9e6f0", face: "#f4efe8", flip: true, shades: true },
  { x: 1660, y: 620, size: 0.72, wool: "#d9b98f", shade: "#c19d70", face: "#e5c8a0", flip: false, shades: false },
];

const Puff = ({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) => <circle cx={cx} cy={cy} r={r} fill={fill} />;

const AlpacaFigure = ({ a }: { a: Alpaca }) => (
  <g transform={`translate(${a.x} ${a.y}) scale(${a.flip ? -a.size : a.size} ${a.size})`}>
    <ellipse cx="0" cy="118" rx="95" ry="12" fill="rgba(60,90,60,0.18)" />
    {[-55, -25, 25, 55].map((lx) => (
      <rect key={lx} x={lx - 9} y="40" width="18" height="78" rx="9" fill={a.shade} />
    ))}
    {[-70, -40, -10, 20, 50, 75].map((px, i) => (
      <Puff key={px} cx={px} cy={i % 2 ? 0 : 10} r={34} fill={a.wool} />
    ))}
    <ellipse cx="0" cy="18" rx="90" ry="40" fill={a.wool} />
    <rect x="48" y="-110" width="40" height="130" rx="20" fill={a.wool} />
    {[-118, -96, -74].map((py) => (
      <Puff key={py} cx={68} cy={py} r={24} fill={a.wool} />
    ))}
    <ellipse cx="78" cy="-120" rx="34" ry="30" fill={a.face} />
    <ellipse cx="100" cy="-108" rx="20" ry="15" fill={a.wool} />
    <ellipse cx="54" cy="-156" rx="8" ry="18" fill={a.shade} transform="rotate(-18 54 -156)" />
    <ellipse cx="96" cy="-156" rx="8" ry="18" fill={a.shade} transform="rotate(18 96 -156)" />
    <Puff cx={74} cy={-150} r={16} fill={a.wool} />
    {a.shades ? (
      <g>
        <rect x="58" y="-132" width="22" height="14" rx="6" fill="#1b1b24" />
        <rect x="86" y="-132" width="22" height="14" rx="6" fill="#1b1b24" />
        <rect x="78" y="-128" width="10" height="3" fill="#1b1b24" />
        <rect x="62" y="-129" width="8" height="3" rx="1.5" fill="rgba(255,255,255,0.5)" />
      </g>
    ) : (
      <g fill="#2b2230">
        <circle cx="68" cy="-124" r="4.5" />
        <circle cx="96" cy="-124" r="4.5" />
      </g>
    )}
    <path d="M98 -104 q6 5 12 0" stroke="#6b4a3a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <circle cx="62" cy="-110" r="5" fill="#f6a8a8" opacity="0.6" />
    <Puff cx={-92} cy={-6} r={18} fill={a.wool} />
  </g>
);

export const AlpacaWallpaper = () => (
  <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#b9d4f6" />
        <stop offset="0.55" stopColor="#f5d9e6" />
        <stop offset="1" stopColor="#ffe9cf" />
      </linearGradient>
      <linearGradient id="hillFar" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#c5e3c0" />
        <stop offset="1" stopColor="#a9d3a8" />
      </linearGradient>
      <linearGradient id="hillMid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#9fd09a" />
        <stop offset="1" stopColor="#7fbd7f" />
      </linearGradient>
      <linearGradient id="hillNear" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#86c27f" />
        <stop offset="1" stopColor="#5f9f62" />
      </linearGradient>
    </defs>
    <rect width="1920" height="1080" fill="url(#sky)" />
    <circle cx="1520" cy="230" r="90" fill="#fff4d6" opacity="0.9" />
    {[
      [300, 200, 1],
      [980, 150, 0.8],
      [1700, 360, 0.7],
    ].map(([cx, cy, s]) => (
      <g key={cx} transform={`translate(${cx} ${cy}) scale(${s})`} fill="#ffffff" opacity="0.85">
        <ellipse cx="0" cy="0" rx="90" ry="34" />
        <ellipse cx="-40" cy="-20" rx="50" ry="36" />
        <ellipse cx="35" cy="-28" rx="55" ry="42" />
      </g>
    ))}
    <path d="M0 560 C 300 470 600 520 900 480 S 1500 430 1920 520 V1080 H0z" fill="url(#hillFar)" />
    <path d="M0 680 C 350 590 700 650 1050 610 S 1600 560 1920 640 V1080 H0z" fill="url(#hillMid)" />
    {ALPACAS.map((a) => (
      <AlpacaFigure key={a.x} a={a} />
    ))}
    <path d="M0 840 C 400 780 800 830 1200 800 S 1700 770 1920 820 V1080 H0z" fill="url(#hillNear)" />
  </svg>
);
