# Reprojector reuses its uniform buffers

Every zoom and pan frame of the WebGPU canvas went through `Reprojector::draw`, which created a
fresh uniform buffer per draw. On the web backend those buffers are freed only when the JS
garbage collector gets to them, so Safari's GPU process grew during a gesture (see the
per-draw allocation lesson in LESSONS.md).

Now the reprojector owns a fixed ring of four 32-byte uniform buffers written with
`queue.write_buffer`. Four slots, not one: two draws recorded before one submit would otherwise
both read the last write. Settled output is unchanged (same shader, same values).

Not measured yet in the browser: the zoom-phase profile and before/after table on Chromium
desktop, 4x CPU and WebKit are still to run. Filter passes keep a per-pass storage buffer, but
they already `destroy()` it after submit.
