# Trailer script: never skipped, tagline on one card

## The feega doc came back with no script
`write_script` refused in turn 1 (test account not yet given, #410), the agent
asked for it and ended the turn. Turn 2 received the account, built every shot
and closed: nothing sent it back to `write_script`. `Quality.NoScript` was a
warning, so the delivery gate let the turn end. It is now blocking: a launch
film with clips and no saved script cannot be delivered.

## "Make / your brand / move."
The copywriter prompt asked for "the promise split into lines". It now asks
for one sentence per line, and `applyCopy` joins a line that continues the one
before (previous without sentence end, next starting lowercase), so a
one-sentence tagline lands on one card. A multi-sentence promise still splits
at its sentence ends.
