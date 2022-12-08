const CopyWebpackPlugin = require("copy-webpack-plugin");
const path = require("path");

const isProduction = process.env.NODE_ENV === "production";
const url = isProduction
  ? "${document.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/mpc"
  : "ws://${location.hostname}:3030/mpc";
module.exports = {
  entry: "./src/index.tsx",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /websocket-provider\.tsx?$/,
        loader: "string-replace-loader",
        options: {
          search: "ws://localhost:3030/mpc",
          replace: url,
        },
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.js",
  },
  devtool: false,
  mode: process.env.NODE_ENV || "development",
  plugins: [new CopyWebpackPlugin(["index.html", "favicon.png"])],
  devServer: {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
    liveReload: false,
  },
  experiments: {
    //syncWebAssembly: true,
    asyncWebAssembly: true,
    //topLevelAwait: true,
  },
};
