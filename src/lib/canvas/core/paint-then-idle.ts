type Later = (job: () => void) => unknown;

export const paintThenIdle = (afterPaint: Later, idle: Later) => (job: () => void) => afterPaint(() => idle(job));
