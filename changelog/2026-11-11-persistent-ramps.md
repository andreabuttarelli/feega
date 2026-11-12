# Engine: gradient ramps uploaded only when they change

Profiling the landings drag put `run_recording`'s `write_texture`/`write_buffer` at 2.0 s of 4.5 s
main thread. Counting bytes per command over 80 landing display lists (native, 3 passes): scene +
uniform 9.7 MB per pass (the scene itself, unavoidable), gradient ramps 12.1 MB per pass, image
atlas 0. The atlas is already persistent in vello (`ImageCache` uploads only new or dirty
images; our pictures are registered textures, copied GPU-side), so it was not changed.

The ramp texture (up to 64 × 512 texels) was re-uploaded whole by every render. Vendored patch:
`RampCache` carries a `revision` bumped whenever its data changes; `vello::Renderer` keeps the
ramp image (`render::Persistent`, next to the image atlas) and uploads it only when the revision or
size changes. After: 1.1 MB on the first pass, 0 on the next ones.
