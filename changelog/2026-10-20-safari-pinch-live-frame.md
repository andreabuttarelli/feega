# Safari pinch over a live frame

The live-frame bridge now posts `gesturestart/change/end` (scale, point) from the iframe; `FrameLiveControls` re-dispatches them as bubbling events on the frame's parent, where `watchPinch` (GpuFlow) zooms at the point.
