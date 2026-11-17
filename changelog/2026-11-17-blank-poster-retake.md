# A blank poster is retaken

`MotionNode` took a frame's cover once per head revision. A capture taken before an imported
page painted came out as one flat colour, was saved, and `hasPoster` then stopped every retake:
the frame kept a blank poster, and the version diff read it as a whole-page change.

`posterDue` now also fires when the current poster is blank (`blankPoster`, checked once per
poster url with `isBlankImage`, a 64 px probe through `isBlankPixels`). A capture that comes out
blank is not saved or sent; it is retried after 2 s, at most three times per revision, so a frame
that really is one colour does not loop.
