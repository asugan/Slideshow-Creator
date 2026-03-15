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
  TRANSITIONS,
  KEN_BURNS_ZOOM_INCREMENT,
  KEN_BURNS_MAX_ZOOM,
  CAPTION_FONT,
  CAPTION_FONT_SIZE,
  CAPTION_FADE_IN_DURATION,
  CAPTION_FADE_IN_DELAY,
  CAPTION_BOTTOM_MARGIN,
  CAPTION_BOX_PADDING,
  CAPTION_BOX_OPACITY,
} = require('./config');
const { wrapText, escapeTextContent } = require('./text-overlay');

// Ken Burns presets: zoom direction + pan direction
const KB_PRESETS = [
  // Zoom in, pan right
  (inc, max, frames) => ({
    z: `min(zoom+${inc},${max})`,
    x: `iw/2-(iw/zoom/2)+on*${(0.04 * VIDEO_WIDTH / frames).toFixed(4)}`,
    y: `ih/2-(ih/zoom/2)`,
  }),
  // Zoom in, pan left
  (inc, max, frames) => ({
    z: `min(zoom+${inc},${max})`,
    x: `iw/2-(iw/zoom/2)-on*${(0.04 * VIDEO_WIDTH / frames).toFixed(4)}`,
    y: `ih/2-(ih/zoom/2)`,
  }),
  // Zoom out, pan right
  (inc, max, frames) => ({
    z: `if(eq(on\\,0)\\,${max}\\,max(zoom-${inc}\\,1.0))`,
    x: `iw/2-(iw/zoom/2)+on*${(0.03 * VIDEO_WIDTH / frames).toFixed(4)}`,
    y: `ih/2-(ih/zoom/2)`,
  }),
  // Zoom out, pan left
  (inc, max, frames) => ({
    z: `if(eq(on\\,0)\\,${max}\\,max(zoom-${inc}\\,1.0))`,
    x: `iw/2-(iw/zoom/2)-on*${(0.03 * VIDEO_WIDTH / frames).toFixed(4)}`,
    y: `ih/2-(ih/zoom/2)`,
  }),
];

function pickRandomTrack() {
  if (!fs.existsSync(MUSIC_DIR)) return null;
  const tracks = fs.readdirSync(MUSIC_DIR).filter(f => /\.(mp3|m4a|wav|ogg|aac)$/i.test(f));
  if (tracks.length === 0) return null;
  const pick = tracks[Math.floor(Math.random() * tracks.length)];
  return path.join(MUSIC_DIR, pick);
}

function buildKenBurnsFilter(slideIndex, frames) {
  const preset = KB_PRESETS[slideIndex % KB_PRESETS.length];
  const { z, x, y } = preset(KEN_BURNS_ZOOM_INCREMENT, KEN_BURNS_MAX_ZOOM, frames);
  // Render at 2x resolution to eliminate subpixel jitter, then downscale
  const superW = VIDEO_WIDTH * 2;
  const superH = VIDEO_HEIGHT * 2;
  return `zoompan=z='${z}':x='${x}':y='${y}':d=${frames}:s=${superW}x${superH}:fps=${VIDEO_FPS},scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:flags=lanczos`;
}

function buildFfmpegArgs(imagePaths, outputPath, musicPath, captions, textFiles) {
  const args = [];
  const n = imagePaths.length;
  const isCtaSlide = (i) => i === n - 1 && n > 1; // last slide is CTA
  const frames = IMAGE_DURATION * VIDEO_FPS;

  // Inputs
  for (const img of imagePaths) {
    args.push('-loop', '1', '-t', String(IMAGE_DURATION), '-i', img);
  }

  const audioInputIndex = n;
  if (musicPath) {
    args.push('-stream_loop', '-1', '-i', musicPath);
  }

  const filterParts = [];
  const scaleFilter = `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase,crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT},fps=${VIDEO_FPS},format=yuv420p`;

  // Per-slide filter: Ken Burns for content slides, scale/crop for CTA
  for (let i = 0; i < n; i++) {
    if (isCtaSlide(i)) {
      filterParts.push(`[${i}:v]${scaleFilter}[v${i}]`);
    } else {
      filterParts.push(`[${i}:v]${buildKenBurnsFilter(i, frames)},format=yuv420p[v${i}]`);
    }
  }

  // Chain xfade transitions with random transition types
  let prevLabel = 'v0';
  for (let i = 1; i < n; i++) {
    const offset = i * (IMAGE_DURATION - FADE_DURATION);
    const outLabel = i < n - 1 ? `xf${i}` : 'vout';
    const transition = TRANSITIONS[Math.floor(Math.random() * TRANSITIONS.length)];
    filterParts.push(
      `[${prevLabel}][v${i}]xfade=transition=${transition}:duration=${FADE_DURATION}:offset=${offset}[${outLabel}]`
    );
    prevLabel = outLabel;
  }

  // Caption fade-in via drawtext on composited video
  if (captions && captions.length > 0) {
    let prevVLabel = 'vout';
    const contentSlideCount = isCtaSlide(n - 1) ? n - 1 : n;

    for (let i = 0; i < Math.min(captions.length, contentSlideCount); i++) {
      const slideStart = i * (IMAGE_DURATION - FADE_DURATION);
      const textStart = slideStart + CAPTION_FADE_IN_DELAY;
      const textEnd = slideStart + IMAGE_DURATION - FADE_DURATION;
      const fadeEnd = textStart + CAPTION_FADE_IN_DURATION;

      const outLabel = `ct${i}`;
      const drawtext = [
        `fontfile=${CAPTION_FONT}`,
        `textfile='${textFiles[i]}'`,
        `fontsize=${CAPTION_FONT_SIZE}`,
        `fontcolor=white`,
        `borderw=3`,
        `bordercolor=black`,
        `shadowx=2`,
        `shadowy=2`,
        `shadowcolor=black@0.6`,
        `box=1`,
        `boxcolor=black@${CAPTION_BOX_OPACITY}`,
        `boxborderw=${CAPTION_BOX_PADDING}`,
        `x=(w-tw)/2`,
        `y=h-th-${CAPTION_BOTTOM_MARGIN}`,
        `text_align=C`,
        `enable='between(t,${textStart.toFixed(2)},${textEnd.toFixed(2)})'`,
        `alpha='if(lt(t\\,${fadeEnd.toFixed(2)})\\,(t-${textStart.toFixed(2)})/${CAPTION_FADE_IN_DURATION}\\,1)'`,
      ].join(':');

      filterParts.push(`[${prevVLabel}]drawtext=${drawtext}[${outLabel}]`);
      prevVLabel = outLabel;
    }

    // Ensure yuv420p output for max compatibility
    filterParts.push(`[${prevVLabel}]format=yuv420p[finalv]`);
    args.push('-filter_complex', filterParts.join(';'));
    args.push('-map', '[finalv]');
  } else {
    filterParts.push(`[vout]format=yuv420p[finalv]`);
    args.push('-filter_complex', filterParts.join(';'));
    args.push('-map', '[finalv]');
  }

  // Audio
  if (musicPath) {
    const totalDuration = n * IMAGE_DURATION - (n - 1) * FADE_DURATION;
    const fadeOutStart = totalDuration - 1;
    // Insert audio filter before the final filter_complex join
    const audioFilter = `[${audioInputIndex}:a]atrim=0:${totalDuration},asetpts=PTS-STARTPTS,volume=${MUSIC_VOLUME},afade=t=out:st=${fadeOutStart}:d=1[aout]`;

    // We need to append audio filter to filter_complex
    const fcIdx = args.indexOf('-filter_complex');
    args[fcIdx + 1] += ';' + audioFilter;

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

function buildSlideshow(imagePaths, outputPath, captions = null) {
  // When captions provided, use raw images (not _captioned) — text is rendered in video
  if (!captions) {
    imagePaths = getCaptionedPaths(imagePaths);
  }
  const musicPath = pickRandomTrack();
  if (musicPath) {
    console.log(`  Background music: ${path.basename(musicPath)}`);
  }

  // Write captions to temp files to avoid ffmpeg drawtext escaping issues
  const textFiles = [];
  if (captions) {
    for (let i = 0; i < captions.length; i++) {
      const wrapped = wrapText(captions[i]);
      const tmpPath = path.join(path.dirname(outputPath), `_caption_${i}.tmp`);
      fs.writeFileSync(tmpPath, escapeTextContent(wrapped));
      textFiles.push(tmpPath);
    }
  }

  return new Promise((resolve, reject) => {
    const args = buildFfmpegArgs(imagePaths, outputPath, musicPath, captions, textFiles);

    execFile('ffmpeg', args, (error, _stdout, stderr) => {
      // Clean up temp caption files
      for (const f of textFiles) {
        try { fs.unlinkSync(f); } catch (e) {}
      }
      if (error) {
        reject(new Error(`ffmpeg failed: ${error.message}\n${stderr}`));
        return;
      }
      resolve(outputPath);
    });
  });
}

module.exports = { buildSlideshow };
