# Canvas: an image tier change does not fetch frame sources again

Crossing the 0.75 zoom asset tier rebuilt each imaged frame with the new image URLs, and the
rebuild asked the server for the frame source again: the source reader keeps only 8 documents,
so on a canvas with more frames the source was gone. On the user's canvas five frames were asked
again, arrived 350 ms later and landed one by one up to 1.75 s after the zoom. Sources are now
memoised per frame and revision for the canvas (`memoSources`); only a new revision fetches.

Not changed here: the rebuild itself (new image URLs) still runs per frame.
