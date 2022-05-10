const { dependencies } = require('./package.json');
const { build } = require('esbuild');

const shared = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  external: Object.keys(dependencies),
};

build({
  ...shared,
  outfile: 'dist/index.js',
});

build({
  ...shared,
  outfile: 'dist/index.esm.js',
  format: 'esm',
});
