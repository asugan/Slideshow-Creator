const path = require('path');

module.exports = {
  API_BASE_URL: 'http://localhost:3000',
  MODEL: 'gemini-3.0-flash',
  IMAGE_COUNT: 3,
  IMAGE_DURATION: 4,
  FADE_DURATION: 0.5,
  VIDEO_WIDTH: 1080,
  VIDEO_HEIGHT: 1920,
  VIDEO_FPS: 30,
  IMAGE_PROVIDER: 'openai-compat',  // 'gemini-reverse-api' | 'openai-compat'
  OPENAI_COMPAT_BASE_URL: 'http://localhost:8317/v1',
  OPENAI_COMPAT_API_KEY: 'sk-3O6TsMpx1iKaD25xOhZnHYtCVbqPxD8NvlfRJbulvcyzc',
  OPENAI_COMPAT_MODEL: 'gemini-3.1-flash-image',
  MAX_RETRIES: 2,
  REQUEST_TIMEOUT: 120000,
  CAPTION_FONT: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  CAPTION_FONT_SIZE: 56,
  SPARKLE_WM_RADIUS: 26,
  SPARKLE_WM_MARGIN: 57,
  MUSIC_DIR: path.join(__dirname, '..', 'assets'),
  MUSIC_VOLUME: 0.3,
};
