import { Feature } from '../features';
import type { Competitor } from '../tool';

export const RIVE: Competitor = {
  name: 'Rive',
  title: 'Feega vs Rive: interactive or rendered motion',
  description: 'Rive builds interactive animations that run in apps and games; Feega makes rendered motion with an AI agent. Which one you need.',
  heading: 'Feega vs Rive',
  intro:
    'Rive is a design and animation tool whose files run live inside apps, websites and games, driven by state machines. Feega makes motion that ends as a video, a GIF or a Lottie file, on a canvas an AI agent can edit. If your animation has to react to input at runtime, Rive is the tool.',
  pricing:
    'Free plan with a splash screen on exports and three collaborative files. Paid plans are per seat and add unlimited files, libraries and hosted embeds.',
  features: {
    [Feature.DesignCanvas]: { has: true },
    [Feature.KeyframeTimeline]: { has: true },
    [Feature.AiGeneration]: { has: false },
    [Feature.AgentEditing]: { has: true, note: 'Built-in agent and CLI' },
    [Feature.FigmaImport]: { has: true, note: 'Copy as SVG and paste' },
    [Feature.LottieExport]: { has: false },
    [Feature.VideoExport]: { has: true, note: 'MP4, GIF and WebM' },
    [Feature.InteractiveRuntime]: { has: true },
    [Feature.VideoAsCode]: { has: false },
    [Feature.OpenSource]: { has: false, note: 'Runtimes are MIT, the editor is not' },
    [Feature.WorksLocally]: { has: false },
    [Feature.RealtimeCollaboration]: { has: true }
  },
  theyWin: [
    'State machines, listeners and data binding: animations that respond to taps, hovers and app state.',
    'Open-source runtimes for the web, iOS, Android, Flutter, React Native, Unity and Unreal.',
    'Small files that run in real time instead of a rendered video.'
  ],
  feegaWins: [
    'Text-to-image and text-to-video generation on the same canvas as the animation.',
    'ProRes and Lottie export for video editing and design pipelines.',
    'Open source end to end, and it runs locally from one file with no account.'
  ],
  pickThem:
    'Pick Rive if the animation lives inside a product or a game and has to react to the user at runtime.',
  pickFeega:
    'Pick Feega if the result is a video, a GIF or a Lottie file, and you want an agent and generated media in the same workflow.',
  sections: [
    {
      heading: 'Runtime versus render',
      html: '<p>A Rive file is a small program: the runtime draws it live and the state machine decides what plays next. A Feega frame is a timeline that renders to a fixed result. That makes Feega simpler to hand to an agent, and Rive the only choice of the two for interactive UI.</p>'
    }
  ],
  sources: [
    { label: 'Rive pricing', href: 'https://rive.app/pricing' },
    { label: 'Copy and paste from Figma to Rive', href: 'https://rive.app/blog/copy-and-paste-from-figma-to-rive' }
  ],
  checked: '2026-11-04'
};
