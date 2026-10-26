import base from '../../vite.config';

export default {
  ...base,
  root: new URL('../../', import.meta.url).pathname,
  test: {
    ...base.test,
    include: ['web-docs/scripts/gen-app.gen.ts'],
    setupFiles: [],
    testTimeout: 120_000
  }
};
