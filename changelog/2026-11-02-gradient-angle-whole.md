# Gradient handles write whole degrees

Dragging a linear (or angular) gradient handle on the canvas stored the raw `atan2`
result, e.g. `26.56505117707799`. The Angle field in the fill popover (`step="1"`,
`w-16`) showed it cut to "26,56", which read as a comma decimal. `degreesOf` in
`gradient-handles.ts` now rounds to a whole degree, the same step the field types in.

Rejected: rounding only in the field. The stored value would still disagree with what
the panel shows, and an agent reading the doc would get the long float.
