const REQUEST_ID = 'd7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff';
const BASE = 'https://api.higgsfield.ai';

export const HF_REQUEST_ID = REQUEST_ID;

export const HF_QUEUED = {
  status: 'queued',
  request_id: REQUEST_ID,
  status_url: `${BASE}/requests/${REQUEST_ID}/status`,
  cancel_url: `${BASE}/requests/${REQUEST_ID}/cancel`
};

export const HF_IN_PROGRESS = { ...HF_QUEUED, status: 'in_progress' };

export const HF_IMAGE_DONE = { ...HF_QUEUED, status: 'completed', images: [{ url: 'https://cdn.higgsfield.ai/out/abc.png' }] };

export const HF_VIDEO_DONE = { ...HF_QUEUED, status: 'completed', video: { url: 'https://cdn.higgsfield.ai/out/abc.mp4' } };

export const HF_FAILED = { status: 'failed', request_id: REQUEST_ID, error: 'Generation failed' };

export const HF_NSFW = { status: 'nsfw', request_id: REQUEST_ID };

export const HF_UNAUTHORIZED = { detail: 'Invalid credentials' };

export const HF_ESTIMATE = { credits: '1.500', usd: '0.094' };

export const HF_CONCURRENCY_REACHED = { detail: 'Maximum number of concurrent requests (4) has been reached' };

export const HF_RESTYLE_PRESETS = {
  model: 'higgsfield/genjutsu/restyle/v1.0',
  items: [
    { id: 'c2143317-f28d-4c3c-a0b8-39bd547e08a7', name: 'Cel-Shaded CG Anime', preview_url: 'https://cdn.higgsfield.ai/restyle_presets/259d7ddb-4201-49f7-8a91-cee5bce28715.webp' },
    { id: '5b0f6a52-3d0e-4b8e-9a51-2f1c3e7d9a10', name: 'Claymation', preview_url: 'https://cdn.higgsfield.ai/restyle_presets/clay.webp' }
  ]
};

