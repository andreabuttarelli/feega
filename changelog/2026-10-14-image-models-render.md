# Synced image models render on the images API

The canvas image picker offers every row of `ai_models` with catalogue `image` (OpenRouter
`/images/models`). `renderPostImage` sent a model to `POST /images` only when `image-models.ts`
had a spec for it; every other id went to `chat/completions`, which answers 404 for image models.
The recommended default (Tencent Hy Image 3.5 Preview) failed on every render.

`rendersOnImagesApi` decides the transport: a spec decides by its `openrouterImages`, an id with
no spec is a synced images-catalogue id and goes to the images API.
