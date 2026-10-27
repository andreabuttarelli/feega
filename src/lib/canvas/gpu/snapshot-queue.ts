export const isRunning = (data: Record<string, unknown>) => data.running === true || data.status === 'running';
