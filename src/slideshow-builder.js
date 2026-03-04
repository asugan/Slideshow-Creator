const { execFile } = require('child_process');
const {
  IMAGE_DURATION,
  FADE_DURATION,
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
  VIDEO_FPS,
} = require('./config');

function buildFfmpegArgs(imagePaths, outputPath) {
  const args = [];

  // Inputs: each image looped for IMAGE_DURATION seconds
  for (const img of imagePaths) {
    args.push('-loop', '1', '-t', String(IMAGE_DURATION), '-i', img);
  }

  // Build filter chain
  const n = imagePaths.length;
  const filterParts = [];
  const scaleFilter = `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase,crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT},fps=${VIDEO_FPS},format=yuv420p`;

  // Scale + pad each input
  for (let i = 0; i < n; i++) {
    filterParts.push(`[${i}:v]${scaleFilter}[v${i}]`);
  }

  // Chain xfade transitions
  let prevLabel = 'v0';
  for (let i = 1; i < n; i++) {
    const offset = i * (IMAGE_DURATION - FADE_DURATION);
    const outLabel = i < n - 1 ? `xf${i}` : 'vout';
    filterParts.push(
      `[${prevLabel}][v${i}]xfade=transition=fade:duration=${FADE_DURATION}:offset=${offset}[${outLabel}]`
    );
    prevLabel = outLabel;
  }

  args.push('-filter_complex', filterParts.join(';'));
  args.push('-map', '[vout]');
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23');
  args.push('-movflags', '+faststart');
  args.push('-y', outputPath);

  return args;
}

function getCaptionedPaths(imagePaths) {
  const fs = require('fs');
  return imagePaths.map(p => {
    const captioned = p.replace(/\.png$/, '_captioned.png');
    return fs.existsSync(captioned) ? captioned : p;
  });
}

function buildSlideshow(imagePaths, outputPath) {
  imagePaths = getCaptionedPaths(imagePaths);
  return new Promise((resolve, reject) => {
    const args = buildFfmpegArgs(imagePaths, outputPath);

    execFile('ffmpeg', args, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`ffmpeg failed: ${error.message}\n${stderr}`));
        return;
      }
      resolve(outputPath);
    });
  });
}

module.exports = { buildSlideshow };
