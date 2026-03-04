const path = require('path');

module.exports = {
  API_BASE_URL: 'http://localhost:3000',
  MODEL: 'gemini-3.0-flash',
  IMAGE_COUNT: 5,
  IMAGE_DURATION: 3,
  FADE_DURATION: 0.5,
  TRANSITIONS: ['fade', 'wipeleft', 'slideright', 'dissolve', 'smoothup'],
  KEN_BURNS_ZOOM_INCREMENT: 0.0006,
  KEN_BURNS_MAX_ZOOM: 1.08,
  CAPTION_FADE_IN_DURATION: 0.5,
  CAPTION_FADE_IN_DELAY: 0.3,
  VIDEO_WIDTH: 1080,
  VIDEO_HEIGHT: 1920,
  VIDEO_FPS: 30,
  TEXT_PROVIDER: 'openai-compat',   // 'gemini-reverse-api' | 'openai-compat'
  IMAGE_PROVIDER: 'openai-compat',  // 'gemini-reverse-api' | 'openai-compat'
  OPENAI_COMPAT_BASE_URL: 'http://localhost:8317/v1',
  OPENAI_COMPAT_API_KEY: 'sk-3O6TsMpx1iKaD25xOhZnHYtCVbqPxD8NvlfRJbulvcyzc',
  OPENAI_COMPAT_MODEL: 'gemini-3.1-flash-image',
  OPENAI_COMPAT_TEXT_MODEL: 'gemini-3-flash-preview',
  MAX_RETRIES: 2,
  REQUEST_TIMEOUT: 120000,
  CAPTION_FONT: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  CAPTION_FONT_SIZE: 56,
  CAPTION_BOTTOM_MARGIN: 520,
  CAPTION_BOX_PADDING: 14,
  CAPTION_BOX_OPACITY: 0.4,
  SPARKLE_WM_RADIUS: 26,
  SPARKLE_WM_MARGIN: 57,
  MUSIC_DIR: path.join(__dirname, '..', 'assets'),
  MUSIC_VOLUME: 0.3,
};
