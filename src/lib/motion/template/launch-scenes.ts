import { Device } from '$lib/motion/devices';
import { IMAGE_ZOOM } from '$lib/motion/components';
import { FontCategory, FontSource, type FontFace } from '$lib/motion/fonts/model';
import { EASE_BEZIER } from '$lib/motion/keyframes';
import { Ease } from '$lib/motion/design';
import { STYLES } from '$lib/motion/style';
import { MotionStyle } from '$lib/motion/style-model';
import { FillKind, StrokeKind } from '$lib/motion/shape/schema';
import type { Beat, Key } from '$lib/motion/template-kit';
import { FieldType } from './fields';
import { boxAspect, colour, text, type Design, type Field } from './design-kit';

const FILM = STYLES[MotionStyle.LaunchFilm];
const { ink: INK, paper: PAPER, muted: MUTED } = FILM.palette;
const ACCENT = 'brand.accent';
const FAMILY = FILM.type.family;
const { hero: HERO, line: LINE, small: SMALL } = FILM.type.sizes;
const { display: DISPLAY, text: BODY } = FILM.type.weights;
const SNAP = FILM.eases.enter;
const WHIP = FILM.eases.move;
const LINEAR = EASE_BEZIER[Ease.Linear];
const BEAT = 0.5;
const HIT = 0.25;
const PUNCH = 1.35;
const BLUR = FILM.movement.blur;
const RISE = FILM.movement.rise;

const FONTS: FontFace[] = [
  {
    family: FAMILY,
    source: FontSource.Google,
    category: FontCategory.Sans,
    weights: [BODY, DISPLAY],
    italic: false,
    axes: []
  }
];

const FULL = { x: 0.5, y: 0.5, width: 1, height: 1 };
const word = (size: number, color = PAPER) => ({
  font: FAMILY,
  weight: DISPLAY,
  size,
  color,
  tracking: -0.05,
  leading: 1
});
const label = (color = MUTED) => ({
  font: FAMILY,
  weight: BODY,
  size: SMALL,
  color,
  tracking: 0.3,
  leading: 1
});

const punch = (from = PUNCH): Record<string, Key[]> => ({
  scale: [
    [0, from, SNAP],
    [HIT, 1, LINEAR]
  ],
  blur: [
    [0, BLUR, SNAP],
    [HIT * 0.8, 0, LINEAR]
  ]
});

const riseOut: Record<string, Key[]> = {
  y: [
    [0, RISE, SNAP],
    [HIT, 0, LINEAR]
  ],
  blur: [
    [0, BLUR, SNAP],
    [HIT * 0.8, 0, LINEAR]
  ]
};

const fill = (seconds: number, color = INK): Beat => ({
  id: 'bg',
  track: 'back',
  component: 'Shape',
  at: 0,
  len: seconds,
  props: { shape: 'rect', fill: color, ...FULL }
});
const picture = (key: string, label: string, clipId: string, prop = 'assetId', box = { width: 1, height: 1 }): Field => ({
  key,
  label,
  type: FieldType.Asset,
  clipId,
  prop,
  aspect: boxAspect(box.width, box.height)
});
const amount = (key: string, label: string, clipId: string, prop: string): Field => ({
  key,
  label,
  type: FieldType.Number,
  clipId,
  prop,
  min: 0,
  max: 1
});

const BURST = ['Turn', 'clicks', 'into', 'revenue.'];
const NUMBERS = [
  ['7.2K', 'CLICKS'],
  ['165', 'LEADS'],
  ['$506', 'SALES']
];
const CLAIMS = ['Links.', 'Analytics.', 'Affiliates.', 'One place.'];
const HOLD = 2 * BEAT;
const CLAIM_HOLD = 3 * BEAT;
const CLAIM_SECONDS = (CLAIMS.length - 1) * HOLD + CLAIM_HOLD;
const BURST_SECONDS = BEAT * 4 + 1;

const LAUNCH_DESIGNS: Omit<Design, 'fonts'>[] = [
  {
    id: 'launch-word-burst',
    name: 'Launch · Word burst',
    description: 'Launch film. The claim builds one word per beat, each punching in from 135% out of a blur on its own line and staying until the line is read, the last word in the accent. The hook.',
    seconds: BURST_SECONDS,
    beats: [
      fill(BURST_SECONDS),
      ...BURST.map((w, i): Beat => ({
        id: `word_${i + 1}`,
        track: 'front',
        component: 'Title',
        at: i * BEAT,
        len: BURST_SECONDS - i * BEAT,
        props: {
          text: w,
          ...word(LINE * 1.5, i === BURST.length - 1 ? ACCENT : PAPER),
          y: 0.5 + (i - (BURST.length - 1) / 2) * 0.2,
          width: 0.92,
          height: 0.2
        },
        keys: punch(i === BURST.length - 1 ? 0.6 : PUNCH)
      }))
    ],
    fields: [...BURST.map((_, i) => text(`word_${i + 1}`, `Word ${i + 1}`, `word_${i + 1}`)), colour('accent', 'Last word colour', `word_${BURST.length}`, 'color')]
  },
  {
    id: 'launch-ui-speed-ramp',
    name: 'Launch · Speed-ramp zoom into the UI',
    description: 'Launch film. A sharp capture full frame: starts close on the headline (a match cut from the hook), pulls back to the whole page, holds a beat, then whips into one detail (focus) and keeps creeping. Slow-fast-slow.',
    seconds: 4 * BEAT,
    beats: [
      fill(4 * BEAT),
      {
        id: 'page',
        track: 'middle',
        component: 'Image',
        at: 0,
        len: 4 * BEAT,
        props: { ...FULL, fit: 'cover', zoom: 2.4, focusX: 0.5, focusY: 0.22 },
        keys: {
          zoom: [
            [0, 2.4, SNAP],
            [0.5, 1.02, WHIP],
            [0.75, 1.04, WHIP],
            [1.55, 2.2, WHIP],
            [4 * BEAT, 2.35, LINEAR]
          ],
          focusY: [
            [0, 0.22, SNAP],
            [0.5, 0.45, WHIP],
            [0.75, 0.45, WHIP],
            [1.55, 0.86, LINEAR]
          ],
          focusX: [
            [0, 0.5, WHIP],
            [0.75, 0.5, WHIP],
            [1.55, 0.36, WHIP],
            [4 * BEAT, 0.34, LINEAR]
          ]
        }
      }
    ],
    fields: [
      picture('screen', 'Desktop capture', 'page'),
      {
        key: 'zoom',
        label: 'Start zoom',
        type: FieldType.Number,
        clipId: 'page',
        prop: 'zoom',
        min: IMAGE_ZOOM.min,
        max: IMAGE_ZOOM.max
      }
    ]
  },
  {
    id: 'launch-device-fly',
    name: 'Launch · Device fly-in',
    description: 'Launch film. A laptop flies in from a 95° turn and keeps drifting closer while a huge line sits behind it. The product on a device.',
    seconds: 4 * BEAT,
    beats: [
      fill(4 * BEAT),
      {
        id: 'line',
        track: 'back',
        component: 'Title',
        at: 0,
        len: 4 * BEAT,
        props: {
          text: 'Every click.',
          ...word(LINE * 2),
          y: 0.2,
          width: 0.92,
          height: 0.28
        },
        keys: {
          scale: [
            [0, 1.2, SNAP],
            [HIT, 1, LINEAR],
            [4 * BEAT, 0.94, LINEAR]
          ],
          blur: [
            [0, BLUR, SNAP],
            [HIT, 0, LINEAR]
          ]
        }
      },
      {
        id: 'device',
        track: 'front',
        component: 'Device3D',
        at: 0,
        len: 4 * BEAT,
        props: {
          device: Device.LaptopPro,
          finish: 'black',
          shadow: false,
          x: 0.5,
          y: 0.6,
          width: 1,
          height: 0.9
        },
        keys: {
          objectRotateY: [
            [0, -95, SNAP],
            [0.9, -20, LINEAR],
            [4 * BEAT, 8, LINEAR]
          ],
          objectRotateX: [
            [0, 38, SNAP],
            [0.9, 8, LINEAR],
            [4 * BEAT, 6, LINEAR]
          ],
          dolly: [
            [0, 0.5, SNAP],
            [0.9, 1.2, LINEAR],
            [4 * BEAT, 1.5, LINEAR]
          ]
        }
      }
    ],
    fields: [
      picture('screen', 'Screen (desktop capture)', 'device', 'screen', {
        width: 16,
        height: 10
      }),
      text('line', 'Line behind', 'line'),
      {
        key: 'device',
        label: 'Device',
        type: FieldType.Select,
        clipId: 'device',
        prop: 'device',
        options: [Device.LaptopPro, Device.LaptopAir, Device.Monitor, Device.Browser]
      }
    ]
  },
  {
    id: 'launch-number-match-cut',
    name: 'Launch · Number match cut',
    description: 'Launch film. Three numbers swap every two beats in one spot, each rising out of its own box (a fast mask reveal), its label small under it; the last in the accent.',
    seconds: NUMBERS.length * HOLD,
    beats: [
      fill(NUMBERS.length * HOLD),
      ...NUMBERS.flatMap(([n, what], i): Beat[] => [
        {
          id: `number_${i + 1}`,
          track: 'front',
          component: 'Title',
          at: i * HOLD,
          len: HOLD,
          props: {
            text: n,
            ...word(0.35, i === NUMBERS.length - 1 ? ACCENT : PAPER),
            y: 0.46,
            width: 0.92,
            height: 0.42
          },
          keys: riseOut
        },
        {
          id: `label_${i + 1}`,
          track: 'middle',
          component: 'Kicker',
          at: i * HOLD,
          len: HOLD,
          props: { text: what, ...label(), y: 0.76, width: 0.6, height: 0.06 }
        }
      ])
    ],
    fields: [...NUMBERS.flatMap((_, i) => [text(`number_${i + 1}`, `Number ${i + 1}`, `number_${i + 1}`), text(`label_${i + 1}`, `Label ${i + 1}`, `label_${i + 1}`)]), colour('accent', 'Last number colour', `number_${NUMBERS.length}`, 'color')]
  },
  {
    id: 'launch-ui-tilt-zoom',
    name: 'Launch · UI tilt zoom',
    description: 'Launch film. One feature of the real UI lands tilted back 18° and straightens while it whips in on the detail and keeps pushing.',
    seconds: 2 * BEAT,
    beats: [
      fill(2 * BEAT),
      {
        id: 'screen',
        track: 'middle',
        component: 'Image',
        at: 0,
        len: 2 * BEAT,
        props: { ...FULL, fit: 'cover', zoom: 1, focusX: 0.5, focusY: 0.55 },
        keys: {
          zoom: [
            [0, 1, SNAP],
            [0.35, 1.5, WHIP],
            [2 * BEAT, 1.95, LINEAR]
          ],
          focusY: [
            [0, 0.5, SNAP],
            [0.35, 0.58, LINEAR],
            [2 * BEAT, 0.6, LINEAR]
          ]
        },
        transform: { rotateX: 18, perspective: 1600 }
      }
    ],
    fields: [picture('screen', 'Capture of the feature', 'screen'), amount('focus_x', 'Focus X', 'screen', 'focusX'), amount('focus_y', 'Focus Y', 'screen', 'focusY')]
  },
  {
    id: 'launch-beat-montage',
    name: 'Launch · Claim run',
    description: 'Launch film. The build-up before the drop: one claim every two beats in the same spot on black, each punching in and held long enough to read, the last in the accent. Put live UI (add_ui) between claims, never screenshots behind them.',
    seconds: CLAIM_SECONDS,
    beats: [
      fill(CLAIM_SECONDS),
      ...CLAIMS.map((c, i): Beat => ({
        id: `claim_${i + 1}`,
        track: 'front',
        component: 'Title',
        at: i * HOLD,
        len: i === CLAIMS.length - 1 ? CLAIM_HOLD : HOLD,
        props: {
          text: c,
          ...word(LINE * 1.8, i === CLAIMS.length - 1 ? ACCENT : PAPER),
          y: 0.5,
          width: 0.92,
          height: 0.3
        },
        keys: punch(1.25)
      }))
    ],
    fields: [...CLAIMS.map((_, i) => text(`claim_${i + 1}`, `Claim ${i + 1}`, `claim_${i + 1}`)), colour('accent', 'Last claim colour', `claim_${CLAIMS.length}`, 'color')]
  },
  {
    id: 'launch-ui-explode',
    name: 'Launch · UI explosion (peak)',
    description: 'Launch film. The wow peak, on the drop: a white flash, then every capture bursts into a tilted 3D grid that rushes at the camera and settles, the grid dims and the claim lands on top. Fill it with 8–12 captures.',
    seconds: 6 * BEAT,
    beats: [
      {
        id: 'grid',
        track: 'back',
        component: 'Composition',
        at: 0,
        len: 6 * BEAT,
        props: {
          layout: 'tilted-grid',
          camera: 'push-in',
          background: INK,
          loop: 6,
          layoutParams: {
            columns: 4,
            rows: 3,
            tiltX: 28,
            tiltY: 8,
            tiltZ: -18,
            scrollSpeed: 1.6,
            waveDepth: 2.6,
            waveSpeed: 1.4,
            cardScale: 2.2
          }
        },
        keys: {
          scale: [
            [0, 4.2, SNAP],
            [0.8, 2.4, LINEAR],
            [6 * BEAT, 2.1, LINEAR]
          ],
          rotateZ: [
            [0, 14, SNAP],
            [0.8, 0, LINEAR]
          ],
          opacity: [
            [0, 1, LINEAR],
            [BEAT, 1, SNAP],
            [BEAT * 1.6, 0.45, LINEAR]
          ]
        }
      },
      {
        id: 'flash',
        track: 'front',
        component: 'Shape',
        at: 0,
        len: 0.2,
        props: { shape: 'rect', fill: PAPER, ...FULL },
        keys: {
          opacity: [
            [0, 0.9, SNAP],
            [0.2, 0, LINEAR]
          ]
        }
      },
      {
        id: 'title',
        track: 'front',
        component: 'Title',
        at: BEAT,
        len: 5 * BEAT,
        props: {
          text: 'Turn clicks\ninto revenue.',
          ...word(LINE * 1.3),
          y: 0.5,
          width: 0.92,
          height: 0.4
        },
        keys: {
          ...riseOut,
          scale: [
            [0, 0.96, LINEAR],
            [5 * BEAT, 1.04, LINEAR]
          ]
        }
      }
    ],
    fields: [
      {
        key: 'media',
        label: 'Captures',
        type: FieldType.MediaList,
        clipId: 'grid',
        prop: 'media'
      },
      text('title', 'Claim', 'title')
    ]
  },
  {
    id: 'launch-device-orbit',
    name: 'Launch · Device orbit',
    description: 'Launch film. A phone spins in 200° and keeps turning while one huge word slides behind it. Wants a mobile capture.',
    seconds: 3 * BEAT,
    beats: [
      fill(3 * BEAT),
      {
        id: 'word',
        track: 'back',
        component: 'Title',
        at: 0,
        len: 3 * BEAT,
        props: {
          text: 'Real-time.',
          ...word(HERO),
          y: 0.5,
          width: 0.92,
          height: 0.34
        },
        keys: {
          x: [
            [0, 0.09, LINEAR],
            [3 * BEAT, -0.09, LINEAR]
          ],
          blur: [
            [0, BLUR, SNAP],
            [HIT, 0, LINEAR]
          ]
        }
      },
      {
        id: 'device',
        track: 'front',
        component: 'Device3D',
        at: 0,
        len: 3 * BEAT,
        props: {
          device: Device.PhonePro,
          finish: 'black',
          shadow: false,
          x: 0.5,
          y: 0.5,
          width: 0.5,
          height: 1
        },
        keys: {
          objectRotateY: [
            [0, 200, SNAP],
            [0.7, 25, LINEAR],
            [3 * BEAT, -20, LINEAR]
          ],
          objectRotateZ: [
            [0, -25, SNAP],
            [0.7, -4, LINEAR],
            [3 * BEAT, 0, LINEAR]
          ],
          dolly: [
            [0, 0.5, SNAP],
            [0.7, 1.05, LINEAR],
            [3 * BEAT, 1.15, LINEAR]
          ]
        }
      }
    ],
    fields: [
      picture('screen', 'Screen (mobile capture)', 'device', 'screen', {
        width: 9,
        height: 19.5
      }),
      text('word', 'Word behind', 'word')
    ]
  },
  {
    id: 'launch-logo-build',
    name: 'Launch · Logo build',
    description: 'Launch film. The close: the light opens, the original logo lands flat and intact on a beat (fade and a small scale only) with an accent shockwave around it, then the address and the claim. The logo is never altered: the build is the context.',
    seconds: 8 * BEAT,
    beats: [
      fill(8 * BEAT),
      {
        id: 'light',
        track: 'back',
        component: 'Shape',
        at: 0,
        len: 8 * BEAT,
        props: { shape: 'rect', fillKind: FillKind.Radial, fill: PAPER, fill2: INK, ...FULL, opacity: 0.16 },
        keys: {
          scale: [
            [0, 0.4, SNAP],
            [2 * BEAT, 1, LINEAR],
            [8 * BEAT, 1.1, LINEAR]
          ]
        }
      },
      {
        id: 'logo',
        track: 'middle',
        component: 'Logo',
        at: 2 * BEAT,
        len: 6 * BEAT,
        props: { x: 0.5, y: 0.42, width: 0.18, height: 0.32 },
        keys: {
          opacity: [
            [0, 0, SNAP],
            [HIT, 1, LINEAR]
          ],
          scale: [
            [0, 0.92, SNAP],
            [HIT, 1, LINEAR],
            [6 * BEAT, 1.03, LINEAR]
          ]
        }
      },
      {
        id: 'ring',
        track: 'front',
        component: 'Shape',
        at: 2 * BEAT,
        len: 0.8,
        props: {
          shape: 'ellipse',
          fill: 'transparent',
          strokeKind: StrokeKind.Solid,
          stroke: ACCENT,
          strokeWidth: 0.009,
          x: 0.5,
          y: 0.42,
          width: 0.22,
          height: 0.39
        },
        keys: {
          scale: [
            [0, 0.6, SNAP],
            [0.8, 4.2, LINEAR]
          ],
          opacity: [
            [0, 1, SNAP],
            [0.8, 0, LINEAR]
          ]
        }
      },
      {
        id: 'url',
        track: 'front',
        component: 'Title',
        at: 2.5 * BEAT,
        len: 5.5 * BEAT,
        props: {
          text: 'example.com',
          ...word(0.11),
          weight: 700,
          y: 0.8,
          width: 0.8,
          height: 0.15
        },
        keys: riseOut
      },
      {
        id: 'claim',
        track: 'front',
        component: 'Kicker',
        at: 3.5 * BEAT,
        len: 4.5 * BEAT,
        props: {
          text: 'YOUR CLAIM IN CAPS',
          ...label(),
          y: 0.89,
          width: 0.6,
          height: 0.05
        },
        keys: {
          opacity: [
            [0, 0, SNAP],
            [HIT, 1, LINEAR]
          ]
        }
      }
    ],
    fields: [
      picture('logo', 'Original logo (SVG or PNG)', 'logo', 'assetId', {
        width: 0.18,
        height: 0.32
      }),
      text('url', 'Address', 'url'),
      text('claim', 'Claim', 'claim'),
      colour('accent', 'Shockwave colour', 'ring', 'stroke')
    ]
  }
];

export const LAUNCH_SCENES: Design[] = LAUNCH_DESIGNS.map((design) => ({
  ...design,
  fonts: FONTS
}));
