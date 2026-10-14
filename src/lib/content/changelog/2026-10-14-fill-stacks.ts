import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Shapes and text take layered fills',
  items: [
    'Rectangles, ellipses, paths and text stack several fills: colour, linear or radial gradient, and pictures, each with its own opacity, blend and visibility.',
    'Every colour has its own alpha, apart from the layer opacity; + adds a layer of the type you pick.',
    'Gradients edit with stops on a bar and an angle; pictures pick from the project with fit, focus and scale.',
    'Poster photos are filled boxes: replace the picture, crop it, or lay a colour over it.',
    'The motion chat and MCP agents set fill stacks too.'
  ]
} satisfies ChangelogEntry;
