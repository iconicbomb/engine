import { Config } from "@remotion/cli/config";
Config.setVideoImageFormat("png");   // lossless frames into ffmpeg; glow gradients must not be JPEG'd before encoding
Config.setCodec("h264");
Config.setCrf(16);
// harfbuzzjs's emscripten loader references Node modules behind runtime checks; tell webpack they don't exist in the browser
Config.overrideWebpackConfig((c) => ({
  ...c,
  resolve: { ...c.resolve, fallback: { ...(c.resolve?.fallback ?? {}), fs: false, path: false, module: false, crypto: false, url: false, worker_threads: false } },
}));
