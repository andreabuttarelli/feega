# Timeline clip previews: visible waveforms, full filmstrips, client fallback

**Before.** Audio bars had a waveform `<svg>` whose path was zero-width line segments
(`M x y V y`) filled, never stroked: nothing painted. Video filmstrips used 64px tile slots
but frames drawn ~36px wide, so the strip covered about half the bar. Waveforms existed only
when the server `?/analyze` action returned an analysis.

**Now.** `wavePath` draws filled 0.8-wide bars (test pins the path). Strip frames flex to fill
the bar (`object-fit: cover`). When the server has no analysis for a sound asset the page
decodes it once in the browser (`peaks-decode.ts`: `OfflineAudioContext` at 8 kHz, envelope in
a worker), cached per asset in memory + `localStorage` (`peakStore`, try/catch, corrupt
entries ignored). Trim was already respected (`clipPeaks`, `tileFrames`); the doc has no clip
speed, so there is nothing to map.

**Discarded.** IndexedDB for peaks: entries are a few KB of rounded numbers, localStorage is
enough.
