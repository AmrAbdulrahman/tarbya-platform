const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');
const nodeExternals = require('webpack-node-externals');

/**
 * Runs after NxAppWebpackPlugin so its settings win:
 * - npm packages stay external and load from node_modules at runtime;
 *   only workspace libs (@tarbya/*), which ship as TypeScript source, are bundled.
 * - module concatenation is off: it can't handle the Prisma client's `export * as $Enums`.
 */
class ApiBundlePlugin {
  apply(compiler) {
    const allowlist = [/^@tarbya\//];
    compiler.options.externals = [
      nodeExternals({ allowlist }),
      nodeExternals({
        modulesDir: join(__dirname, '../../node_modules'),
        allowlist,
      }),
    ];
    compiler.options.externalsPresets = { node: true };
    compiler.options.optimization.concatenateModules = false;
  }
}

module.exports = {
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: true,
    }),
    new ApiBundlePlugin(),
  ],
};
