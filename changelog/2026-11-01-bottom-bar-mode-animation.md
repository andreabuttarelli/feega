# Bottom bar animates on mode change

Switching mode removed or added bar icons with a jump of the whole pill.

Each slot is now a keyed wrapper with a custom in/out transition (`slot-motion.ts`): leaving slots fade and scale to 0.85 in 120ms while their width collapses over 220ms (expo-out); entering slots grow and fade in with a 20ms stagger. Because the bar is content-sized and centred, collapsing/growing slot widths animates the pill without FLIP. `overflow: hidden` applies only during the transition, so tooltips are not clipped at rest. Reduced motion: duration 0.

Discarded: pinning the mode switch position (declined).
