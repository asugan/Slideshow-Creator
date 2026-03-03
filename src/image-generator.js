const fs = require('fs');
const axios = require('axios');
const { API_BASE_URL, MODEL, MAX_RETRIES, REQUEST_TIMEOUT } = require('./config');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateSingleImage(prompt, outputPath) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`  Retry ${attempt}/${MAX_RETRIES} (waiting 10s)...`);
      await sleep(10000);
    }

    try {
      const resp = await axios.post(`${API_BASE_URL}/generate-image`, {
        prompt: `Generate an image of: ${prompt}`,
        model: MODEL,
      }, {
        timeout: REQUEST_TIMEOUT,
        validateStatus: () => true,
      });

      if (resp.status !== 200) {
        const body = resp.data;
        const msg = body?.text || body?.error || `HTTP ${resp.status}`;
        throw new Error(`API error (${resp.status}): ${typeof msg === 'string' ? msg.slice(0, 150) : msg}`);
      }

      const data = resp.data;

      // Use base64 data if available (server-side download)
      const imgData = data.imagesData?.[0];
      if (imgData?.base64) {
        fs.writeFileSync(outputPath, Buffer.from(imgData.base64, 'base64'));
        return;
      }

      // Fallback: direct URL download
      if (!data.images || data.images.length === 0) {
        throw new Error(`No images returned. Response: ${JSON.stringify(data).slice(0, 200)}`);
      }

      const response = await axios.get(data.images[0], {
        responseType: 'arraybuffer',
        timeout: REQUEST_TIMEOUT,
      });
      fs.writeFileSync(outputPath, response.data);
      return;
    } catch (err) {
      console.log(`  Error: ${err.message.slice(0, 100)}`);
      lastError = err;
    }
  }

  throw new Error(`Failed after ${MAX_RETRIES + 1} attempts: ${lastError.message}`);
}

module.exports = { generateSingleImage };
