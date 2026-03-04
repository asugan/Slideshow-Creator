const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  IMAGE_DURATION,
  FADE_DURATION,
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
  VIDEO_FPS,
  MUSIC_DIR,
  MUSIC_VOLUME,
} = require('./config');

function pickRandomTrack() {
  if (!fs.existsSync(MUSIC_DIR)) return null;
  const tracks = fs.readdirSync(MUSIC_DIR).filter(f => /\.(mp3|m4a|wav|ogg|aac)$/i.test(f));
  if (tracks.length === 0) return null;
  const pick = tracks[Math.floor(Math.random() * tracks.length)];
  return path.join(MUSIC_DIR, pick);
}

function buildFfmpegArgs(imagePaths, outputPath, musicPath) {
  const args = [];

  // Inputs: each image looped for IMAGE_DURATION seconds
  for (const img of imagePaths) {
    args.push('-loop', '1', '-t', String(IMAGE_DURATION), '-i', img);
  }

  const audioInputIndex = imagePaths.length;

  // Music input: loop indefinitely, will be trimmed by -shortest
  if (musicPath) {
    args.push('-stream_loop', '-1', '-i', musicPath);
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

  // Audio: trim to video length, volume adjust, fade out last 1s
  if (musicPath) {
    const totalDuration = n * IMAGE_DURATION - (n - 1) * FADE_DURATION;
    const fadeOutStart = totalDuration - 1;
    filterParts.push(
      `[${audioInputIndex}:a]atrim=0:${totalDuration},asetpts=PTS-STARTPTS,volume=${MUSIC_VOLUME},afade=t=out:st=${fadeOutStart}:d=1[aout]`
    );
  }

  args.push('-filter_complex', filterParts.join(';'));
  args.push('-map', '[vout]');
  if (musicPath) {
    args.push('-map', '[aout]');
    args.push('-c:a', 'aac', '-b:a', '192k');
  }
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23');
  args.push('-movflags', '+faststart');
  args.push('-y', outputPath);

  return args;
}

function getCaptionedPaths(imagePaths) {
  return imagePaths.map(p => {
    const captioned = p.replace(/\.png$/, '_captioned.png');
    return fs.existsSync(captioned) ? captioned : p;
  });
}

function buildSlideshow(imagePaths, outputPath) {
  imagePaths = getCaptionedPaths(imagePaths);
  const musicPath = pickRandomTrack();
  if (musicPath) {
    console.log(`  Background music: ${path.basename(musicPath)}`);
  }
  return new Promise((resolve, reject) => {
    const args = buildFfmpegArgs(imagePaths, outputPath, musicPath);

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
