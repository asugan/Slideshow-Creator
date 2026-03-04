const fs = require('fs');
const axios = require('axios');
const {
  API_BASE_URL, MODEL, MAX_RETRIES, REQUEST_TIMEOUT,
  IMAGE_PROVIDER, OPENAI_COMPAT_BASE_URL, OPENAI_COMPAT_API_KEY, OPENAI_COMPAT_MODEL,
} = require('./config');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateViaGeminiReverseApi(prompt, outputPath) {
  const resp = await axios.post(`${API_BASE_URL}/generate-image`, {
    prompt: `Generate a vertical portrait image (9:16 aspect ratio, taller than wide) of: ${prompt}`,
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
}

async function generateViaOpenAICompat(prompt, outputPath) {
  const resp = await axios.post(`${OPENAI_COMPAT_BASE_URL}/chat/completions`, {
    model: OPENAI_COMPAT_MODEL,
    messages: [{
      role: 'user',
      content: `Generate a vertical portrait image (9:16 aspect ratio, taller than wide) of: ${prompt}`,
    }],
  }, {
    headers: {
      'Authorization': `Bearer ${OPENAI_COMPAT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: REQUEST_TIMEOUT,
    validateStatus: () => true,
  });

  if (resp.status !== 200) {
    const body = resp.data;
    const msg = body?.error?.message || body?.error || `HTTP ${resp.status}`;
    throw new Error(`API error (${resp.status}): ${typeof msg === 'string' ? msg.slice(0, 150) : msg}`);
  }

  const message = resp.data.choices?.[0]?.message;
  if (!message) {
    throw new Error(`No message in response. Response: ${JSON.stringify(resp.data).slice(0, 200)}`);
  }

  // Check message.images array (e.g. [{type: "image_url", image_url: {url: "data:image/png;base64,..."}}])
  const images = message.images;
  if (Array.isArray(images)) {
    for (const img of images) {
      const url = img?.image_url?.url;
      if (url) {
        const match = url.match(/^data:image\/\w+;base64,(.+)$/);
        if (match) {
          fs.writeFileSync(outputPath, Buffer.from(match[1], 'base64'));
          return;
        }
      }
    }
  }

  // Fallback: check content as multipart array
  const content = message.content;
  if (content) {
    const parts = Array.isArray(content) ? content : [content];
    for (const part of parts) {
      if (part?.type === 'image_url' && part.image_url?.url) {
        const match = part.image_url.url.match(/^data:image\/\w+;base64,(.+)$/);
        if (match) {
          fs.writeFileSync(outputPath, Buffer.from(match[1], 'base64'));
          return;
        }
      }
    }
  }

  throw new Error(`No image data found in response. Keys: ${Object.keys(message).join(', ')}`);
}

async function generateSingleImage(prompt, outputPath) {
  const generate = IMAGE_PROVIDER === 'openai-compat'
    ? generateViaOpenAICompat
    : generateViaGeminiReverseApi;

  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`  Retry ${attempt}/${MAX_RETRIES} (waiting 10s)...`);
      await sleep(10000);
    }

    try {
      await generate(prompt, outputPath);
      return;
    } catch (err) {
      console.log(`  Error: ${err.message.slice(0, 100)}`);
      lastError = err;
    }
  }

  throw new Error(`Failed after ${MAX_RETRIES + 1} attempts: ${lastError.message}`);
}

module.exports = { generateSingleImage };
