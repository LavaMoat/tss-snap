const { dependencies } = require('./package.json');
const { build } = require('esbuild');
const { Generator } = require('npm-dts');

new Generator({
  entry: 'src/index.ts',
  output: 'dist/index.d.ts',
}).generate();

const shared = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  external: Object.keys(dependencies),
}

build({
  ...shared,
  outfile: 'dist/index.js',
});

build({
  ...shared,
  outfile: 'dist/index.esm.js',
  format: 'esm',
})
