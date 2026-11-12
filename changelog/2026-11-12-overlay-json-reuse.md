# Canvas: the overlay is serialised once per change

`SentOverlay` already serialised each overlay item (cached per item) to decide whether a part
changed; `setOverlay` then ran `JSON.stringify` on the whole part again before handing it to
the engine. `SentParts.changed` now returns each changed part with the JSON it compared, and
`CoreRaster.setOverlay` takes that string. Frame-drag profile on landings: `setOverlay` spent
~330 ms of a 4 s drag in its own stringify.
