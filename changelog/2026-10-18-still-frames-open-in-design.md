# Still frames open in Design

#789 hid the Design/Motion switch on still frames, but the editor still
opened in the last mode stored, Motion by default. In Motion the frame bar
is stowed, so a still frame opened with no draw tools and no way to switch
back. `startMode` in `still.ts` opens a still frame in Design; motion frames
keep the stored mode. Caught by `canvas-insert-flicker.spec.ts:92` in the
release gate.
