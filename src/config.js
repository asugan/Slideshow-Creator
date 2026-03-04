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
  MAX_RETRIES: 2,
  REQUEST_TIMEOUT: 120000,
  CAPTION_FONT: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  CAPTION_FONT_SIZE: 56,
  MUSIC_DIR: path.join(__dirname, '..', 'assets'),
  MUSIC_VOLUME: 0.3,
};
