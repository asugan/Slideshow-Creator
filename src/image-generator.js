const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { API_BASE_URL, MODEL, MAX_RETRIES, REQUEST_TIMEOUT } = require('./config');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateAndDownload(prompt, outputPath) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`  Retry ${attempt}/${MAX_RETRIES}...`);
      await sleep(2000);
    }

    try {
      const { data } = await axios.post(`${API_BASE_URL}/generate-image`, {
        prompt,
        model: MODEL,
      }, { timeout: REQUEST_TIMEOUT });

      if (!data.images || data.images.length === 0) {
        throw new Error(`No images returned. Response: ${JSON.stringify(data).slice(0, 200)}`);
      }

      const imageUrl = data.images[0];
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: REQUEST_TIMEOUT,
      });

      fs.writeFileSync(outputPath, response.data);
      return;
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`Failed after ${MAX_RETRIES + 1} attempts: ${lastError.message}`);
}

async function generateImages(prompts, tempDir) {
  fs.mkdirSync(tempDir, { recursive: true });

  const imagePaths = [];

  for (let i = 0; i < prompts.length; i++) {
    const outputPath = path.join(tempDir, `slide_${i + 1}.png`);
    console.log(`  [${i + 1}/${prompts.length}] Generating: ${prompts[i].slice(0, 60)}...`);
    await generateAndDownload(prompts[i], outputPath);
    console.log(`  [${i + 1}/${prompts.length}] Saved: ${outputPath}`);
    imagePaths.push(outputPath);
  }

  return imagePaths;
}

module.exports = { generateImages };
