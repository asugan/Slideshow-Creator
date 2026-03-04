# Slideshow Creator

A CLI tool that generates TikTok-style slideshow videos from a single topic. It uses Gemini AI to create images and captions, then stitches everything together with ffmpeg into a polished 9:16 vertical video with crossfade transitions. Supports multiple image generation backends.

## How It Works

```
topic → AI image prompts → AI images → dewatermark + logo → AI captions → text overlay → slideshow video
```

Give it a topic like *"sunset over tokyo"* and it will:

1. Generate 3 descriptive image prompts via Gemini
2. Generate 3 portrait images from those prompts
3. Remove AI watermarks and replace with brand logo
4. Write short, punchy TikTok-style captions for each slide
5. Overlay the captions onto the images (bold white text, black outline)
6. Build a crossfade MP4 video in 1080×1920 (9:16) format

## Prerequisites

- **Node.js** (v18+)
- **ffmpeg** installed and available in PATH
- **DejaVuSans-Bold** font at `/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`
- One of the following image providers:
  - **[gemini-reverse-api](../gemini-reverse-api)** running on `localhost:3000` (default)
  - **OpenAI-compatible endpoint** (e.g. `localhost:8317/v1`) with an image generation model

## Setup

```bash
npm install
```

## Usage

### Full pipeline (recommended)

```bash
node index.js all "sunset over tokyo"
```

### Step by step

Each step runs independently to keep Gemini sessions clean:

```bash
# 1. Generate image prompts
node index.js prompts "sunset over tokyo"

# 2. Generate images one at a time
node index.js image 1
node index.js image 2
node index.js image 3

# 3. Remove watermarks and add brand logo
node index.js dewatermark

# 4. Generate captions
node index.js captions

# 5. Overlay captions onto images
node index.js overlay

# 6. Build the final video
node index.js slideshow
```

The final video is saved to `output/{topic}_{timestamp}.mp4`.

### Working files

All intermediate files live in `temp/current/`:

| File | Description |
|---|---|
| `prompts.json` | Generated image descriptions |
| `captions.json` | Generated TikTok captions |
| `slide_1.png` … `slide_3.png` | Raw AI-generated images |
| `slide_1_captioned.png` … `slide_3_captioned.png` | Images with text overlay |

## Configuration

All settings are in `src/config.js`:

| Setting | Default | Description |
|---|---|---|
| `IMAGE_PROVIDER` | `gemini-reverse-api` | Image backend: `gemini-reverse-api` or `openai-compat` |
| `OPENAI_COMPAT_BASE_URL` | `http://localhost:8317/v1` | OpenAI-compat API base URL |
| `OPENAI_COMPAT_MODEL` | `gemini-3.1-flash-image` | Model name for openai-compat provider |
| `VIDEO_WIDTH` | 1080 | Output video width |
| `VIDEO_HEIGHT` | 1920 | Output video height (9:16) |
| `IMAGE_COUNT` | 3 | Number of slides |
| `IMAGE_DURATION` | 4 | Seconds per slide |
| `FADE_DURATION` | 0.5 | Crossfade transition duration |
| `CAPTION_FONT_SIZE` | 56 | Caption text size |

## Image Providers

### gemini-reverse-api (default)

Uses a local [gemini-reverse-api](../gemini-reverse-api) instance on `localhost:3000`. Watermarks are removed via reverse alpha blending.

### openai-compat

Uses any OpenAI-compatible `/v1/chat/completions` endpoint with image generation support. Set `IMAGE_PROVIDER: 'openai-compat'` in `src/config.js`. Watermarks are removed via inpainting and replaced with the brand logo (`assets/foreground.png`).

## Why step-based?

Gemini's `/chat` endpoint pollutes the session state, which causes subsequent `/generate-image` calls to fail. Running each step as an independent command keeps sessions clean and makes the pipeline more reliable. The `all` command handles this automatically.
