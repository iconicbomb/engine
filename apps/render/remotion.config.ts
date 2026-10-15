import { Config } from "@remotion/cli/config";
Config.setVideoImageFormat("png");   // lossless frames into ffmpeg; glow gradients must not be JPEG'd before encoding
Config.setCodec("h264");
Config.setCrf(16);
