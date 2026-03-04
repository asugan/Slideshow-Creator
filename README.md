# Slideshow Creator

A CLI tool that generates TikTok-style slideshow videos from a single topic. It uses Gemini AI to create images and captions, then stitches everything together with ffmpeg into a polished 9:16 vertical video with crossfade transitions.

## How It Works

```
topic → AI image prompts → AI images → AI captions → text overlay → slideshow video
```

Give it a topic like *"sunset over tokyo"* and it will:

1. Generate 3 descriptive image prompts via Gemini
2. Generate 3 portrait images from those prompts
3. Write short, punchy TikTok-style captions for each slide
4. Overlay the captions onto the images (bold white text, black outline)
5. Build a crossfade MP4 video in 1080×1920 (9:16) format

## Prerequisites

- **Node.js** (v18+)
- **ffmpeg** installed and available in PATH
- **DejaVuSans-Bold** font at `/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`
- **[gemini-reverse-api](../gemini-reverse-api)** running on `localhost:3000`

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

# 3. Generate captions
node index.js captions

# 4. Overlay captions onto images
node index.js overlay

# 5. Build the final video
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
| `VIDEO_WIDTH` | 1080 | Output video width |
| `VIDEO_HEIGHT` | 1920 | Output video height (9:16) |
| `IMAGE_COUNT` | 3 | Number of slides |
| `IMAGE_DURATION` | 4 | Seconds per slide |
| `FADE_DURATION` | 0.5 | Crossfade transition duration |
| `CAPTION_FONT_SIZE` | 56 | Caption text size |

## Why step-based?

Gemini's `/chat` endpoint pollutes the session state, which causes subsequent `/generate-image` calls to fail. Running each step as an independent command keeps sessions clean and makes the pipeline more reliable. The `all` command handles this automatically.
