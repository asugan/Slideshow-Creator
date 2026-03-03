const axios = require('axios');
const { API_BASE_URL, MODEL, IMAGE_COUNT, REQUEST_TIMEOUT } = require('./config');

async function generatePrompts(topic) {
  const metaPrompt = `Generate exactly ${IMAGE_COUNT} image prompts for a TikTok slideshow about: "${topic}"

Requirements:
- Each prompt should describe a visually striking scene suitable for vertical 9:16 format
- Prompts should tell a visual story when viewed in sequence
- Keep each prompt to 1-2 sentences, focused on visual details
- Number each prompt (1. 2. 3.)
- Do NOT include any other text, explanation, or commentary — only the numbered prompts`;

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
