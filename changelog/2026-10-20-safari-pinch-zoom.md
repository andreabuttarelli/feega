# Safari trackpad pinch zooms the canvas

Safari sends pinch as `gesturestart/change/end` (scale + client point), not ctrl+wheel. `lockPageZoom` swallowed it for `.svelte-flow` targets and GpuFlow only listened to wheel. `watchPinch` (page-zoom.ts) maps scale ratios to zoom-at-point on the GPU canvas and the motion `ZoomStage`; skipped when the same pinch also arrived as ctrl+wheel.
