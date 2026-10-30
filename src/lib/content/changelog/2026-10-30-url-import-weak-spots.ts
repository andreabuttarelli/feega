import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-30',
  title: 'Better design systems from imported pages',
  items: [
    'Corner radii of an imported page are now variables: change Radius M and every layer using it follows.',
    'Call-to-action buttons on imported pages become Button components with Hover and Pressed states.',
    'Partner logos become one Logo component with variants instead of ten separate ones.',
    'Button labels nested inside a wrapper now show up as a Label property.',
    'Each component is listed once in the Components panel.',
    'Very dark colours are named Navy or Ink, very light ones Tint, and Hover shades are always clearly visible.'
  ]
} satisfies ChangelogEntry;
