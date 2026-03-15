const { execFile } = require('child_process');
const fs = require('fs');
const { CAPTION_FONT, CAPTION_FONT_SIZE, CAPTION_BOTTOM_MARGIN, CAPTION_BOX_PADDING, CAPTION_BOX_OPACITY, VIDEO_WIDTH, VIDEO_HEIGHT } = require('./config');

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

function escapeTextContent(text) {
  // Only % needs escaping for ffmpeg text expansion in textfile content
  return text.replace(/%/g, '%%');
}

function applyTextOverlay(inputPath, outputPath, caption) {
  return new Promise((resolve, reject) => {
    const wrapped = wrapText(caption);
    const textFilePath = inputPath.replace(/\.png$/, '_drawtext.tmp');
    fs.writeFileSync(textFilePath, escapeTextContent(wrapped));

    const scaleFilter = `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase,crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT}`;

    const drawtext = [
      `fontfile=${CAPTION_FONT}`,
      `textfile='${textFilePath}'`,
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
    ].join(':');

    const args = [
      '-i', inputPath,
      '-vf', `${scaleFilter},drawtext=${drawtext}`,
      '-y', outputPath,
    ];

    execFile('ffmpeg', args, (error, _stdout, stderr) => {
      try { fs.unlinkSync(textFilePath); } catch (e) {}
      if (error) {
        reject(new Error(`ffmpeg drawtext failed: ${error.message}\n${stderr}`));
        return;
      }
      resolve(outputPath);
    });
  });
}

module.exports = { applyTextOverlay, wrapText, escapeTextContent };
