# Auto layout strokes: old documents keep their layout

#1227. `strokesIncluded` defaulted to true in the schema, so every saved auto layout without the
field started counting inside strokes as padding and children moved.

- Schema default is now false: a missing field means the old behaviour.
- New containers get true explicitly (`NEW_AUTO_LAYOUT`, used by `setAutoLayout` when the clip has
  no auto layout yet, so wrap, add and the agent tool all agree). An existing container keeps its
  own value.
- Discarded: a migration rewriting stored docs; the default flip is enough and reversible.
