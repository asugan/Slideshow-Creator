const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { generatePrompts } = require('./src/prompt-generator');
const { generateImages } = require('./src/image-generator');
const { buildSlideshow } = require('./src/slideshow-builder');

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function timestamp() {
  return new Date().toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, '');
}

async function main() {
  const topic = process.argv.slice(2).join(' ').trim();
  if (!topic) {
    console.error('Usage: node index.js "<topic>"');
    console.error('Example: node index.js "sunset over tokyo"');
    process.exit(1);
  }

  const runId = crypto.randomUUID();
  const tempDir = path.join(__dirname, 'temp', runId);
  const outputDir = path.join(__dirname, 'output');

  try {
    // Step 1: Generate prompts
    console.log(`\n[1/3] Generating image prompts for: "${topic}"`);
    const prompts = await generatePrompts(topic);
    prompts.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));

    // Step 2: Generate and download images
    console.log(`\n[2/3] Generating images...`);
    const imagePaths = await generateImages(prompts, tempDir);

    // Step 3: Build slideshow
    console.log(`\n[3/3] Building slideshow video...`);
    fs.mkdirSync(outputDir, { recursive: true });
    const outputFile = path.join(outputDir, `${slugify(topic)}_${timestamp()}.mp4`);
    await buildSlideshow(imagePaths, outputFile);

    console.log(`\nDone! Video saved to: ${outputFile}`);
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.error(`\nError: Cannot connect to API. Is gemini-reverse-api running on localhost:3000?`);
    } else {
      console.error(`\nError: ${err.message}`);
    }
    process.exit(1);
  } finally {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

main();
