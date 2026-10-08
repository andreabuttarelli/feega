import { peakEnvelope } from './peaks';
import { PEAKS_PER_SECOND } from './waveform';

self.onmessage = (e: MessageEvent<{ samples: Float32Array; rate: number }>) => {
  self.postMessage(peakEnvelope(e.data.samples, e.data.rate, PEAKS_PER_SECOND));
};
