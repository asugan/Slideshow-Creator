const axios = require('axios');
const {
  API_BASE_URL, MODEL, REQUEST_TIMEOUT,
  TEXT_PROVIDER, OPENAI_COMPAT_BASE_URL, OPENAI_COMPAT_API_KEY, OPENAI_COMPAT_TEXT_MODEL,
  APP_LINK, APP_NAME,
} = require('./config');

async function chatViaOpenAICompat(prompt) {
  const { data } = await axios.post(`${OPENAI_COMPAT_BASE_URL}/chat/completions`, {
    model: OPENAI_COMPAT_TEXT_MODEL,
    messages: [{ role: 'user', content: prompt }],
  }, {
    headers: { Authorization: `Bearer ${OPENAI_COMPAT_API_KEY}` },
    timeout: REQUEST_TIMEOUT,
  });
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`Unexpected OpenAI-compat response: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return text;
}

async function chatViaGeminiReverse(prompt) {
  const { data } = await axios.post(`${API_BASE_URL}/chat`, {
    prompt,
    model: MODEL,
  }, { timeout: REQUEST_TIMEOUT });
  const text = data.text;
  if (!text) {
    throw new Error(`Unexpected /chat response: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return text;
}

async function generateMetadata(topic, captions) {
  const captionList = captions.map((c, i) => `${i + 1}. ${c}`).join('\n');

  const metaPrompt = `You are a social media marketing expert. Generate optimized post metadata for 3 platforms based on this video content.

Video topic: "${topic}"
App to promote: ${APP_NAME} (${APP_LINK})

Slide captions used in the video:
${captionList}

Generate metadata for TikTok, Instagram Reels, and YouTube Shorts. Output ONLY valid JSON matching this exact structure (no markdown fences, no commentary):

{
  "tiktok": {
    "description": "...",
    "hashtags": ["#tag1", "#tag2", "..."]
  },
  "instagram": {
    "description": "...",
    "hashtags": ["#tag1", "#tag2", "..."]
  },
  "youtube": {
    "title": "...",
    "description": "...",
    "tags": ["tag1", "tag2", "..."]
  }
}

Platform-specific rules:

TIKTOK:
- Description: 2-4 short lines, hook-first, punchy and emotional
- End with "📲 Download ${APP_NAME} — Link in bio!"
- Use emojis naturally (not excessively)
- Hashtags: 4-6 tags mixing trending (#PetTok #FYP) and niche (#PetCareApp)
- Always include #${APP_NAME} as a hashtag
- Total description under 300 characters (excluding hashtags)

INSTAGRAM:
- Description: Start with a strong hook line, then 2-3 engaging lines about the value
- Add a line break, then "📲 Download ${APP_NAME} — Link in bio!"
- Use emojis sparingly for visual breaks
- Hashtags: 15-20 tags in a separate array — mix of broad (#pets #petcare), medium (#petapp #pettracker), and niche (#${APP_NAME.toLowerCase()})
- All hashtags lowercase
- Total description under 500 characters (excluding hashtags)

YOUTUBE SHORTS:
- Title: Under 70 characters, SEO-optimized, curiosity-driven (no clickbait)
- Description: 2-3 informative lines about the video content
- Include the full app link directly: "📲 Download ${APP_NAME}: ${APP_LINK}"
- Tags: 5-8 search-friendly keyword phrases (no # prefix, lowercase)
- Always include "${APP_NAME.toLowerCase()}" and "pet care app" as tags

IMPORTANT:
- Write everything in natural, fluent English
- Make each platform feel native (TikTok = casual/trendy, Instagram = polished/aesthetic, YouTube = informative/searchable)
- The content should make viewers want to download the app
- Do NOT repeat the same text across platforms — each should feel unique`;

  const text = TEXT_PROVIDER === 'openai-compat'
    ? await chatViaOpenAICompat(metaPrompt)
    : await chatViaGeminiReverse(metaPrompt);

  // Extract JSON from response (handle potential markdown fences)
  let jsonStr = text.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  let metadata;
  try {
    metadata = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse metadata JSON. Raw response:\n${text}`);
  }

  // Validate structure
  for (const platform of ['tiktok', 'instagram', 'youtube']) {
    if (!metadata[platform]) {
      throw new Error(`Missing "${platform}" in metadata response`);
    }
  }
  if (!metadata.youtube.title) {
    throw new Error('Missing "title" in youtube metadata');
  }

  return metadata;
}

function formatTikTokText(meta) {
  const hashtags = meta.hashtags.join(' ');
  return `${meta.description}\n\n${hashtags}`;
}

function formatInstagramText(meta) {
  const hashtags = meta.hashtags.join(' ');
  return `${meta.description}\n\n.\n.\n.\n${hashtags}`;
}

function formatYouTubeText(meta) {
  return `${meta.title}\n\n${meta.description}\n\nTags: ${meta.tags.join(', ')}`;
}

module.exports = { generateMetadata, formatTikTokText, formatInstagramText, formatYouTubeText };
