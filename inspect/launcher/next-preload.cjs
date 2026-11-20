const Module = require('node:module');
const { join } = require('node:path');

const LOADER = join(__dirname, 'next-loader.cjs');
const CONFIG = /[\\/]next[\\/]dist[\\/]server[\\/]config\.js$/;
const DEV_PHASE = 'phase-development-server';
const MAPPED = ['*.jsx', '*.tsx'];
const MAPPED_FILE = /\.(jsx|tsx)$/;

function withSource(config, dir) {
  const loader = { loader: LOADER, options: { root: dir } };
  const rules = Object.fromEntries(MAPPED.map((glob) => [glob, { loaders: [loader] }]));
  const webpack = config.webpack;
  return {
    ...config,
    turbopack: { ...config.turbopack, rules: { ...config.turbopack?.rules, ...rules } },
    webpack(webpackConfig, context) {
      const out = webpack ? webpack(webpackConfig, context) : webpackConfig;
      if (context.dev) {
        out.module.rules.push({ test: MAPPED_FILE, exclude: /node_modules/, enforce: 'pre', use: [loader] });
      }
      return out;
    }
  };
}

const load = Module._load;
Module._load = function feegaLoad(request, parent, isMain) {
  const out = load.apply(this, arguments);
  let file = '';
  try {
    file = Module._resolveFilename(request, parent, isMain);
  } catch {
    return out;
  }
  if (!CONFIG.test(file) || typeof out?.default !== 'function') {
    return out;
  }
  const original = out.default;
  const wrapped = async (phase, dir, ...rest) => {
    const config = await original(phase, dir, ...rest);
    return phase === DEV_PHASE ? withSource(config, dir) : config;
  };
  return new Proxy(out, { get: (target, key) => (key === 'default' ? wrapped : target[key]) });
};
