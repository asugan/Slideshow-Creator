const axios = require('axios');
const { API_BASE_URL, MODEL, IMAGE_COUNT, REQUEST_TIMEOUT } = require('./config');

async function generateCaptions(prompts) {
  const promptList = prompts.map((p, i) => `${i + 1}. ${p}`).join('\n');

  const metaPrompt = `You are a TikTok content creator. Based on these image descriptions, write a short catchy caption for each slide.

Image descriptions:
${promptList}

Rules:
- Write exactly ${IMAGE_COUNT} captions, numbered 1. 2. 3.
- Each caption must be 5-10 words maximum
- Make them attention-grabbing, emotional, or curiosity-inducing
- Use simple, punchy language (TikTok style)
- No hashtags, no emojis
- Output ONLY the numbered list, no extra commentary`;

  const { data } = await axios.post(`${API_BASE_URL}/chat`, {
    prompt: metaPrompt,
    model: MODEL,
  }, { timeout: REQUEST_TIMEOUT });

  const text = data.text;
  if (!text) {
    throw new Error(`Unexpected /chat response: ${JSON.stringify(data).slice(0, 200)}`);
  }

  const captions = [];
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*\d+[\.\)]\s*(.+)/);
    if (match) {
      captions.push(match[1].trim());
    }
  }

  if (captions.length < IMAGE_COUNT) {
    throw new Error(
      `Expected ${IMAGE_COUNT} captions, got ${captions.length}. Raw response:\n${text}`
    );
  }

  return captions.slice(0, IMAGE_COUNT);
}

module.exports = { generateCaptions };
