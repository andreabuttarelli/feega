# Per-clip layer order, masks on shared tracks

Z-order is track order plus clip order inside a track (`layerOrder`). Clips
added through the API land on one shared track, which broke two things:

- `arrangeLayers` forward/backward moved a whole track step, so a clip
  jumped past every clip of a shared neighbour track. Now both the clip and
  its neighbour in the stack are split onto their own tracks (the rest of
  the shared track keeps its order, split above and below), and the clip
  lands right past that one neighbour. Front/back unchanged in effect.
- `useAsMask` ranked clips by track index, so clips on one track tied and
  were refused as "not above the mask". It now ranks by `layerOrder`; the
  renderer resolves `matteFrom` by id, so no track move is needed.

Route-level tests now cover arrange_layers, use_as_mask/release_mask,
combine_shapes, precompose/ungroup and parent_clips through
`/api/v1/motion/:node/tools`; the last three already worked.
