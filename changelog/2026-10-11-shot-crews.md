# Parallel shot crews

The first cut after an approved script is built by two shot crews at
once (`shotCrews`): the acts split in halves, each crew briefed with its
acts and time range and told to leave music to the sound pass. Writes
share `session.doc`, applied one tool call at a time on the event loop,
so there is no version race inside the turn; the save keeps its
conflict retry. Crews are steered by prompt to their range, not
refused outside it.
