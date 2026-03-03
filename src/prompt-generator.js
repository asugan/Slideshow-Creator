const axios = require('axios');
const { API_BASE_URL, MODEL, IMAGE_COUNT, REQUEST_TIMEOUT } = require('./config');

async function generatePrompts(topic) {
  const metaPrompt = `You are a creative writing assistant. I need you to write ${IMAGE_COUNT} short text descriptions that I will later use as AI image generation prompts. The topic is: "${topic}"

Rules:
- Write exactly ${IMAGE_COUNT} descriptions, numbered 1. 2. 3.
- Each description should be 1-2 sentences describing a visually striking scene in vertical 9:16 portrait format
- The descriptions should tell a visual story when read in sequence
- Focus on visual details: colors, lighting, composition, mood
- Do NOT generate, draw, or create any images — I only need the text descriptions
- Output ONLY the numbered list, no extra commentary`;

  const { data } = await axios.post(`${API_BASE_URL}/chat`, {
    prompt: metaPrompt,
    model: MODEL,
  }, { timeout: REQUEST_TIMEOUT });

  const text = data.text;
  if (!text) {
    throw new Error(`Unexpected /chat response: ${JSON.stringify(data).slice(0, 200)}`);
  }

  const prompts = [];
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*\d+[\.\)]\s*(.+)/);
    if (match) {
      prompts.push(match[1].trim());
    }
  }

  if (prompts.length < IMAGE_COUNT) {
    throw new Error(
      `Expected ${IMAGE_COUNT} prompts, got ${prompts.length}. Raw response:\n${text}`
    );
  }

  return prompts.slice(0, IMAGE_COUNT);
}

module.exports = { generatePrompts };
