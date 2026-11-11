# Token write-back finds declarations by identity

`writeTokens` edited the line recorded at import (`origins[mode]`). A line
inserted above shifted every declaration below, the regex missed, and each
token reported "changed in the code" until the next Pull.

Now `located` re-parses the file and picks the declaration with the same
property name, the same mode block and the imported value; the recorded line
is only a tie-break (nearest wins, later wins on equal distance). No such
declaration means the code really changed: conflict as before. The written
origin is updated to the found line.

Duplicate property in one block: the one holding the imported value, nearest
the recorded line, is written.
