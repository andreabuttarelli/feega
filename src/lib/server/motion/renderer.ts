import { env } from '$env/dynamic/private';

export type RenderJob = { html: string; width: number; height: number; fps: number; durationInFrames: number };

export type RenderStart = { ok: true; renderId: string } | { ok: false; error: string };

export type MotionRenderer = {
  configured: boolean;
  start: (job: RenderJob) => Promise<RenderStart>;
};

export const RENDER_NOT_CONFIGURED = 'rendering_not_configured';

export const LAMBDA_ENV = [
  'HYPERFRAMES_LAMBDA_REGION',
  'HYPERFRAMES_LAMBDA_BUCKET',
  'HYPERFRAMES_LAMBDA_STATE_MACHINE_ARN',
  'HYPERFRAMES_AWS_ACCESS_KEY_ID',
  'HYPERFRAMES_AWS_SECRET_ACCESS_KEY'
] as const;

type LambdaEnv = Record<(typeof LAMBDA_ENV)[number], string>;

function lambdaEnv(source: Record<string, string | undefined>): LambdaEnv | null {
  const values = LAMBDA_ENV.map((key) => [key, source[key]?.trim() ?? ''] as const);
  return values.every(([, v]) => v) ? (Object.fromEntries(values) as LambdaEnv) : null;
}

const notConfigured: MotionRenderer = {
  configured: false,
  start: async () => ({ ok: false, error: RENDER_NOT_CONFIGURED })
};

const LAMBDA_SDK = '@hyperframes/aws-lambda';

type LambdaSdk = { renderToLambda: (input: Record<string, unknown>) => Promise<{ renderId: string }> };

function lambdaRenderer(config: LambdaEnv): MotionRenderer {
  return {
    configured: true,
    start: async (job) => {
      const sdk = (await import(/* @vite-ignore */ LAMBDA_SDK).catch(() => null)) as LambdaSdk | null;
      if (!sdk) {
        return { ok: false, error: RENDER_NOT_CONFIGURED };
      }
      const { renderId } = await sdk.renderToLambda({
        region: config.HYPERFRAMES_LAMBDA_REGION,
        bucketName: config.HYPERFRAMES_LAMBDA_BUCKET,
        stateMachineArn: config.HYPERFRAMES_LAMBDA_STATE_MACHINE_ARN,
        credentials: { accessKeyId: config.HYPERFRAMES_AWS_ACCESS_KEY_ID, secretAccessKey: config.HYPERFRAMES_AWS_SECRET_ACCESS_KEY },
        project: { files: { 'index.html': job.html } },
        config: { fps: job.fps, width: job.width, height: job.height, format: 'mp4' }
      });
      return { ok: true, renderId };
    }
  };
}

export function motionRenderer(source: Record<string, string | undefined> = env): MotionRenderer {
  const config = lambdaEnv(source);
  return config ? lambdaRenderer(config) : notConfigured;
}
