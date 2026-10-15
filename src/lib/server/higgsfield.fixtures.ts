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
