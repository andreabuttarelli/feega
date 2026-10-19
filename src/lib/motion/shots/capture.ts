const NO_FRAME_YET = 'Unable to capture screenshot';
const MAX_ATTEMPTS = 5;

const noFrameYet = (error: unknown) => error instanceof Error && error.message.includes(NO_FRAME_YET);

export async function capturePainted<T>(shot: () => Promise<T>, painted: () => Promise<void>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await shot();
    } catch (error) {
      if (!noFrameYet(error) || attempt >= MAX_ATTEMPTS) {
        throw error;
      }
    }
    await painted();
  }
}
