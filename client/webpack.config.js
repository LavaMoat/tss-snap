const CopyWebpackPlugin = require("copy-webpack-plugin");
const path = require("path");

const isProduction = process.env.NODE_ENV === "production";
const url = isProduction ? "/demo" : "ws://${location.hostname}:3030/demo";

module.exports = {
  entry: "./index.tsx",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /worker\.ts$/,
        loader: "string-replace-loader",
        options: {
          search: "__URL__",
          replace: url,
        },
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    fallback: {
      stream: require.resolve("stream-browserify"),
      assert: require.resolve("assert/"),
    },
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
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  experiments: {
    //syncWebAssembly: true,
    asyncWebAssembly: true,
    //topLevelAwait: true,
  },
};
