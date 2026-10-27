# Video frames show their text on the canvas

A closed video frame rests on a frame picked by `restFrame`, which weighed only clip opacity. Text fades in (Text) or rises (Title) from time 0, so the pick was frame 0, where the text paints nothing: a lone Text frame drew blank, and frames with shapes lost their text. `shownOpacity` now multiplies in the text's own fade/rise, so the rest frame lands once the text is in. Frames with a `still` are unaffected. The old test that pinned "text rests at 0" encoded the bug and now uses a shape.
