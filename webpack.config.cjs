/**
 * Webpack config for `shophub-shell-admin` (host MFE).
 *
 * Goal:
 * - Keep the admin shell minimal (single page).
 * - Use static Module Federation remotes (env-configurable) like the learner shell.
 */
const path = require('node:path');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { ModuleFederationPlugin } = require('webpack').container;

const pkg = require('./package.json');
const deps = pkg.dependencies ?? {};

function getInstalledVersion(pkgName) {
  try {
    return require(`${pkgName}/package.json`).version;
  } catch {
    return deps[pkgName];
  }
}

module.exports = (_env, argv) => {
  const isProd = argv.mode === 'production';

  // Zipy config (optional).
  // Reason: enable sourcemap-mapped stack traces in Zipy by ensuring `zipy.init(..., { releaseVer })`
  // uses the same version as your `zipy-cli --releaseVer` uploads.
  const zipySdkUrl =
    process.env.ZIPY_SDK_URL ?? 'https://storage.googleapis.com/zipy-cdn-staging/sdk/latest/zipy.min.umd.js';
  const zipyProjectKey = process.env.ZIPY_PROJECT_KEY ?? '';
  const zipyReleaseVer = process.env.ZIPY_RELEASE_VER ?? process.env.SHOPHUB_RELEASE_VER ?? pkg.version;

  // Remotes default to Netlify in production (env can override).
  // Reason: make `npm run build` outputs deployable without additional config.
  const authRemoteUrl =
    process.env.SHOPHUB_AUTH_REMOTE_URL ??
    (isProd ? 'https://shophub-auth-2.netlify.app/remoteEntry.js' : 'http://localhost:5174/remoteEntry.js');
  const catalogRemoteUrl =
    process.env.SHOPHUB_CATALOG_REMOTE_URL ??
    (isProd ? 'https://shophub-catalog-2.netlify.app/remoteEntry.js' : 'http://localhost:5175/remoteEntry.js');
  const checkoutRemoteUrl =
    process.env.SHOPHUB_CHECKOUT_REMOTE_URL ??
    (isProd ? 'https://shophub-checkout-2.netlify.app/remoteEntry.js' : 'http://localhost:5176/remoteEntry.js');
  const wishlistRemoteUrl =
    process.env.SHOPHUB_WISHLIST_REMOTE_URL ??
    (isProd ? 'https://shophub-wishlist-2.netlify.app/remoteEntry.js' : 'http://localhost:5177/remoteEntry.js');
  const accountRemoteUrl =
    process.env.SHOPHUB_ACCOUNT_REMOTE_URL ??
    (isProd ? 'https://shophub-account-2.netlify.app/remoteEntry.js' : 'http://localhost:5178/remoteEntry.js');

  const mfRemotes = {
    auth: `auth@${authRemoteUrl}`,
    catalog: `catalog@${catalogRemoteUrl}`,
    checkout: `checkout@${checkoutRemoteUrl}`,
    wishlist: `wishlist@${wishlistRemoteUrl}`,
    account: `account@${accountRemoteUrl}`,
  };

  return {
    name: 'shophub-shell-admin',
    mode: isProd ? 'production' : 'development',
    entry: path.resolve(__dirname, 'src', 'main.jsx'),
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProd ? 'assets/[name].[contenthash].js' : 'assets/[name].js',
      chunkFilename: isProd ? 'assets/[name].[contenthash].js' : 'assets/[name].js',
      assetModuleFilename: 'assets/[name].[contenthash][ext][query]',
      // IMPORTANT for Module Federation:
      // Reason: ensures chunks load correctly no matter what origin serves them (dev/prod/CDN).
      publicPath: 'auto',
      clean: true,
      uniqueName: 'shophub-shell-admin',
    },
    resolve: {
      extensions: ['.js', '.jsx', '.json'],
      modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          // Reason: preserve Vite-style extensionless imports in ESM projects (`"type": "module"`).
          resolve: { fullySpecified: false },
          use: {
            loader: 'babel-loader',
          },
        },
        {
          test: /\.css$/i,
          use: [isProd ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg|woff2?|eot|ttf|otf)$/i,
          type: 'asset',
        },
      ],
    },
    plugins: [
      new ModuleFederationPlugin({
        name: 'shophub-shell-admin',
        remotes: mfRemotes,
        // IMPORTANT: shell owns state; share runtime libs as singletons.
        shared: {
          react: { singleton: true, eager: true, requiredVersion: deps.react },
          'react-dom': { singleton: true, eager: true, requiredVersion: deps['react-dom'] },
          'react-router-dom': { singleton: true, requiredVersion: deps['react-router-dom'] },
          '@emotion/react': { singleton: true, requiredVersion: deps['@emotion/react'] },
          '@emotion/styled': { singleton: true, requiredVersion: deps['@emotion/styled'] },
          '@mui/material': {
            singleton: true,
            requiredVersion: deps['@mui/material'],
            version: getInstalledVersion('@mui/material'),
          },
          // NOTE: do not share `@mui/icons-material`.
          // Reason: keep parity with the current setup; icons are safe to duplicate.
        },
      }),

      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'index.html'),
        // These options become available to the HTML template.
        zipySdkUrl,
        zipyProjectKey,
        zipyReleaseVer,
        // IMPORTANT: ensure injected asset URLs are absolute (e.g. `/assets/main.js`),
        // otherwise deep routes would try to load `/debug/assets/main.js` and 404.
        publicPath: '/',
      }),

      new CopyWebpackPlugin({
        patterns: [{ from: 'public', to: '.', noErrorOnMissing: true }],
      }),

      ...(isProd ? [new MiniCssExtractPlugin({ filename: 'assets/[name].[contenthash].css' })] : []),
    ],
    devtool: isProd ? 'source-map' : 'eval-cheap-module-source-map',
    devServer: {
      port: 5172,
      host: 'localhost',
      historyApiFallback: true,
      static: {
        directory: path.resolve(__dirname, 'public'),
        publicPath: '/',
      },
      hot: true,
      liveReload: true,
      client: {
        overlay: true,
      },
      allowedHosts: 'all',
    },
    performance: {
      hints: false,
    },
  };
};

