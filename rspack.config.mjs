import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default {
  context: path.join(root, "src"),
  mode: "production",
  cache: false,
  entry: { index: "./index.js", other: "./other.js" },
  output: {
    path: path.join(root, "dist"),
    filename: "[name].js",
    cssFilename: "[name].[contenthash].css",
    cssChunkFilename: "[name].[contenthash].chunk.css",
    publicPath: "/assets/",
    chunkLoadingGlobal: "reproChunks",
  },
  module: { rules: [{ test: /\.css$/, type: "css" }] },
  optimization: {
    minimize: false,
    runtimeChunk: true,
    splitChunks: { chunks: "all", minSize: 0 },
  },
};
