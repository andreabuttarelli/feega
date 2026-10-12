export const MEDIA_LIST = String.raw`
const VIDEO_MARK = 'video:';
const LINK = /^(https?:|data:|blob:|\/)/;

const picked = (item) => ({ src: item.src, video: item.kind === 'video' });

const mediaList = (raw) => Array.isArray(raw) ? raw.map(picked).filter((m) => m.src) : String(raw || '').split(',').map((s) => s.trim()).filter(Boolean).map((item) => {
  const video = item.startsWith(VIDEO_MARK);
  const id = video ? item.slice(VIDEO_MARK.length).trim() : item;
  const src = LINK.test(id) ? id : assets[id];
  return src ? { src, video } : null;
}).filter(Boolean);

const seekVideo = (video, t) => {
  if (!video || !(video.duration > 0)) {
    return;
  }
  const at = t % video.duration;
  if (Math.abs(video.currentTime - at) > 0.5 / fps) {
    video.currentTime = at;
  }
};
`;
