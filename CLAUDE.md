# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

TikTok slideshow creator — generates AI images via Gemini, adds text captions, and builds crossfade MP4 videos in 9:16 portrait format (1080×1920).

## Commands

```bash
npm install                       # Install dependencies (axios, canvas)
node index.js prompts "<topic>"   # Generate 3 image prompts → temp/current/prompts.json
node index.js image <1-3>         # Generate image N → temp/current/slide_N.png
node index.js dewatermark [1-3]   # Remove Gemini watermark (all slides or slide N)
node index.js captions            # Generate TikTok captions → temp/current/captions.json
node index.js overlay             # Overlay captions on images → temp/current/slide_N_captioned.png
node index.js slideshow           # Build MP4 → output/{topic}_{timestamp}.mp4
node index.js metadata            # Generate platform metadata → temp/current/metadata.json + .txt files
node index.js all "<topic>"       # Run full pipeline end-to-end
```

No test or lint infrastructure exists.

## System Dependencies

- **ffmpeg** — used for drawtext overlays and xfade slideshow building
- **DejaVuSans-Bold.ttf** — `/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`
- **gemini-reverse-api** — must be running on `localhost:3000` (lives at `../gemini-reverse-api`)
- **node-canvas system libs** — `libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev` (for `canvas` npm package used by dewatermark)

## Architecture

Step-based CLI where each command runs independently to avoid Gemini session contamination (`/chat` pollutes session state, causing subsequent `/generate-image` calls to fail with 403).

**Pipeline:** `prompts → image 1/2/3 → dewatermark → captions → overlay → slideshow → metadata`

| File | Role |
|---|---|
| `index.js` | CLI entry, orchestrates commands, manages temp/output dirs |
| `src/config.js` | All constants: API URL, video dimensions, font settings, timeouts |
| `src/prompt-generator.js` | Calls `/chat` to generate 3 image descriptions from a topic |
| `src/image-generator.js` | Calls `/generate-image`, handles base64 response → PNG |
| `src/watermark/` | Gemini watermark remover: reverse alpha blending + adaptive detection (ported from [gemini-watermark-remover](https://github.com/GargantuaX/gemini-watermark-remover)) |
| `src/caption-generator.js` | Calls `/chat` to generate 3 short TikTok captions from prompts |
| `src/text-overlay.js` | ffmpeg drawtext: white text, black border/shadow, center-aligned at bottom |
| `src/slideshow-builder.js` | ffmpeg xfade crossfade, auto-selects `_captioned.png` if available |
| `src/metadata-generator.js` | Generates TikTok/Instagram/YouTube metadata with app link (Petopia) |

## Critical Implementation Details

- **Image prompt prefix**: `/generate-image` needs explicit "Generate a vertical portrait image (9:16 aspect ratio, taller than wide) of: ..." — otherwise Gemini returns text or landscape images.
- **Image download**: Google `gg-dl` URLs require 2-step authenticated redirect handling in gemini-reverse-api. The API returns `imagesData[].base64` to avoid this on the client side.
- **Scale strategy**: Both `text-overlay.js` and `slideshow-builder.js` use `scale=increase + crop` (zoom-to-fill) instead of `decrease + pad` to avoid black bars.
- **Text wrapping**: `text-overlay.js` wraps captions at 25 chars/line with `text_align=C` for center alignment.
- **Prompt parsing**: Both `prompt-generator.js` and `caption-generator.js` parse numbered lists with regex `/^\s*\d+[\.\)]\s*(.+)/`.
