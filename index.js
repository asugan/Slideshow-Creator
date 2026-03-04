const fs = require('fs');
const path = require('path');
const { generatePrompts } = require('./src/prompt-generator');
const { generateSingleImage } = require('./src/image-generator');
const { generateCaptions } = require('./src/caption-generator');
const { applyTextOverlay } = require('./src/text-overlay');
const { buildSlideshow } = require('./src/slideshow-builder');
const { dewatermarkImage } = require('./src/watermark');
const { IMAGE_COUNT } = require('./src/config');

const WORK_DIR = path.join(__dirname, 'temp', 'current');
const OUTPUT_DIR = path.join(__dirname, 'output');
const PROMPTS_FILE = path.join(WORK_DIR, 'prompts.json');
const CAPTIONS_FILE = path.join(WORK_DIR, 'captions.json');
const TOPIC_FILE = path.join(WORK_DIR, 'topic.txt');

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

function loadPrompts() {
  if (!fs.existsSync(PROMPTS_FILE)) {
    throw new Error('No prompts found. Run: node index.js prompts "<topic>" first');
  }
  return JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf-8'));
}

function loadTopic() {
  if (!fs.existsSync(TOPIC_FILE)) return 'slideshow';
  return fs.readFileSync(TOPIC_FILE, 'utf-8').trim();
}

// ── Commands ─────────────────────────────────────────────────────────────────

async function cmdPrompts(topic) {
  if (!topic) {
    console.error('Usage: node index.js prompts "<topic>"');
    process.exit(1);
  }

  fs.mkdirSync(WORK_DIR, { recursive: true });

  console.log(`Generating image prompts for: "${topic}"`);
  const prompts = await generatePrompts(topic);
  prompts.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));

  fs.writeFileSync(PROMPTS_FILE, JSON.stringify(prompts, null, 2));
  fs.writeFileSync(TOPIC_FILE, topic);
  console.log(`\nPrompts saved. Now run: node index.js image 1`);
}

async function cmdImage(num) {
  const index = parseInt(num, 10);
  if (!index || index < 1 || index > IMAGE_COUNT) {
    console.error(`Usage: node index.js image <1-${IMAGE_COUNT}>`);
    process.exit(1);
  }

  const prompts = loadPrompts();
  const prompt = prompts[index - 1];

  fs.mkdirSync(WORK_DIR, { recursive: true });
  const outputPath = path.join(WORK_DIR, `slide_${index}.png`);

  console.log(`Generating image ${index}/${IMAGE_COUNT}: ${prompt.slice(0, 80)}...`);
  await generateSingleImage(prompt, outputPath);
  console.log(`Saved: ${outputPath}`);

  if (index < IMAGE_COUNT) {
    console.log(`\nNext: node index.js image ${index + 1}`);
  } else {
    console.log(`\nAll images done. Now run: node index.js slideshow`);
  }
}

async function cmdDewatermark(num) {
  const slides = num
    ? [parseInt(num, 10)]
    : Array.from({ length: IMAGE_COUNT }, (_, i) => i + 1);

  for (const i of slides) {
    const imagePath = path.join(WORK_DIR, `slide_${i}.png`);
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Missing slide_${i}.png. Run: node index.js image ${i}`);
    }
    console.log(`Removing watermark from slide ${i}...`);
    const meta = await dewatermarkImage(imagePath);
    console.log(`  Done (source: ${meta.source}${meta.detection ? `, gain: ${meta.alphaGain}, suppression: ${meta.detection.suppressionGain.toFixed(2)}` : ''})`);
  }

  console.log('\nWatermarks removed. Now run: node index.js captions');
}

async function cmdCaptions() {
  const prompts = loadPrompts();

  console.log('Generating TikTok captions...');
  const captions = await generateCaptions(prompts);
  captions.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));

  fs.writeFileSync(CAPTIONS_FILE, JSON.stringify(captions, null, 2));
  console.log(`\nCaptions saved. Now run: node index.js overlay`);
}

async function cmdOverlay() {
  if (!fs.existsSync(CAPTIONS_FILE)) {
    throw new Error('No captions found. Run: node index.js captions first');
  }
  const captions = JSON.parse(fs.readFileSync(CAPTIONS_FILE, 'utf-8'));

  for (let i = 1; i <= IMAGE_COUNT; i++) {
    const inputPath = path.join(WORK_DIR, `slide_${i}.png`);
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Missing slide_${i}.png. Run: node index.js image ${i}`);
    }
    const outputPath = path.join(WORK_DIR, `slide_${i}_captioned.png`);
    console.log(`Overlaying caption on slide ${i}: "${captions[i - 1]}"`);
    await applyTextOverlay(inputPath, outputPath, captions[i - 1]);
    console.log(`  Saved: ${outputPath}`);
  }

  console.log(`\nAll overlays done. Now run: node index.js slideshow`);
}

async function cmdSlideshow() {
  const topic = loadTopic();

  // Check all images exist
  const imagePaths = [];
  for (let i = 1; i <= IMAGE_COUNT; i++) {
    const p = path.join(WORK_DIR, `slide_${i}.png`);
    if (!fs.existsSync(p)) {
      throw new Error(`Missing slide_${i}.png. Run: node index.js image ${i}`);
    }
    imagePaths.push(p);
  }

  const ctaPath = path.join(__dirname, 'assets', 'cta.png');
  if (fs.existsSync(ctaPath)) {
    imagePaths.push(ctaPath);
    console.log('Added CTA slide as final slide.');
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputFile = path.join(OUTPUT_DIR, `${slugify(topic)}_${timestamp()}.mp4`);

  // Load captions for video-time text animation (fade-in)
  const captions = fs.existsSync(CAPTIONS_FILE)
    ? JSON.parse(fs.readFileSync(CAPTIONS_FILE, 'utf-8'))
    : null;

  console.log('Building slideshow video...');
  await buildSlideshow(imagePaths, outputFile, captions);
  console.log(`\nDone! Video saved to: ${outputFile}`);
}

async function cmdAll(topic) {
  if (!topic) {
    console.error('Usage: node index.js all "<topic>"');
    process.exit(1);
  }

  await cmdPrompts(topic);
  for (let i = 1; i <= IMAGE_COUNT; i++) {
    await cmdImage(String(i));
  }
  await cmdDewatermark();
  await cmdCaptions();
  await cmdOverlay();
  await cmdSlideshow();
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const rest = args.slice(1).join(' ').trim();

  try {
    switch (command) {
      case 'prompts':
        await cmdPrompts(rest);
        break;
      case 'image':
        await cmdImage(rest);
        break;
      case 'dewatermark':
        await cmdDewatermark(rest);
        break;
      case 'captions':
        await cmdCaptions();
        break;
      case 'overlay':
        await cmdOverlay();
        break;
      case 'slideshow':
        await cmdSlideshow();
        break;
      case 'all':
        await cmdAll(rest);
        break;
      default:
        console.log(`Usage:
  node index.js prompts "<topic>"   Generate ${IMAGE_COUNT} image prompts
  node index.js image <1-${IMAGE_COUNT}>         Generate image N
  node index.js dewatermark [1-${IMAGE_COUNT}]   Remove Gemini watermark (all or slide N)
  node index.js captions            Generate TikTok captions
  node index.js overlay             Overlay captions on images
  node index.js slideshow           Build MP4 from images
  node index.js all "<topic>"       Run all steps

Example:
  node index.js prompts "sunset over tokyo"
  node index.js image 1
  node index.js image 2
  node index.js image 3
  node index.js image 4
  node index.js image 5
  node index.js dewatermark
  node index.js captions
  node index.js overlay
  node index.js slideshow`);
        process.exit(command ? 1 : 0);
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.error(`\nError: Cannot connect to API. Is gemini-reverse-api running on localhost:3000?`);
    } else {
      console.error(`\nError: ${err.message}`);
    }
    process.exit(1);
  }
}

main();
