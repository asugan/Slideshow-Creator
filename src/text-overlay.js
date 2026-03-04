const { execFile } = require('child_process');
const { CAPTION_FONT, CAPTION_FONT_SIZE, VIDEO_WIDTH, VIDEO_HEIGHT } = require('./config');

const MAX_CHARS_PER_LINE = 25;

function wrapText(text) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > MAX_CHARS_PER_LINE && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  return lines.join('\n');
}

function escapeDrawtext(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\''")
    .replace(/:/g, '\\:')
    .replace(/%/g, '%%');
}

function applyTextOverlay(inputPath, outputPath, caption) {
  return new Promise((resolve, reject) => {
    const wrapped = wrapText(caption);
    const escapedText = escapeDrawtext(wrapped);

    const scaleFilter = `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase,crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT}`;

    const drawtext = [
      `fontfile=${CAPTION_FONT}`,
      `text='${escapedText}'`,
      `fontsize=${CAPTION_FONT_SIZE}`,
      `fontcolor=white`,
      `borderw=3`,
      `bordercolor=black`,
      `shadowx=2`,
      `shadowy=2`,
      `shadowcolor=black@0.6`,
      `x=(w-tw)/2`,
      `y=h-th-120`,
      `text_align=C`,
    ].join(':');

    const args = [
      '-i', inputPath,
      '-vf', `${scaleFilter},drawtext=${drawtext}`,
      '-y', outputPath,
    ];

    execFile('ffmpeg', args, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`ffmpeg drawtext failed: ${error.message}\n${stderr}`));
        return;
      }
      resolve(outputPath);
    });
  });
}

module.exports = { applyTextOverlay, wrapText, escapeDrawtext };
