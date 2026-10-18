# ⌥-drag duplicates canvas tiles; ⌘D repeats the step

Before: ⌘D always copied at a fixed +32/+32 and a drag only moved.

- Drag released with ⌥ held: originals return to their place, `duplicate` runs with the
  drag delta (`dx`/`dy` form fields, `offset` on `duplicate_nodes` for MCP/chat parity).
- ⌘D on exactly the copies just made reuses that offset (`repeatOffset`); any other
  selection keeps the small step.
- Not done: repeating after manually moving a ⌘D copy (would need tracking moves).
