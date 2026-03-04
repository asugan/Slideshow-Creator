/**
 * Sparkle watermark remover for openai-compat (gemini-3.1-flash-image) images.
 * The watermark is a diamond-shaped semi-transparent black overlay,
 * centered at approximately (width - margin, height - margin).
 * Removes it by inpainting from surrounding border pixels.
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const { SPARKLE_WM_RADIUS, SPARKLE_WM_MARGIN } = require('../config');

const LOGO_PATH = path.join(__dirname, '..', '..', 'assets', 'foreground.png');
const LOGO_SIZE = 96;

/**
 * Check if a point is inside the diamond (rotated square) mask.
 * Diamond centered at (0,0) with given radius: |dx| + |dy| <= radius
 */
function inDiamond(dx, dy, radius) {
  return Math.abs(dx) + Math.abs(dy) <= radius;
}

/**
 * Remove sparkle watermark from image file (overwrites in-place).
 * Uses border-pixel interpolation to fill the diamond region.
 */
async function removeSparkleWatermark(imagePath) {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image not found: ${imagePath}`);
  }

  const image = await loadImage(imagePath);
  const { width, height } = image;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  const cx = width - SPARKLE_WM_MARGIN;
  const cy = height - SPARKLE_WM_MARGIN;
  const radius = SPARKLE_WM_RADIUS;

  // Expand border sampling zone slightly beyond the diamond
  const borderPad = 3;
  const sampleRadius = radius + borderPad;

  // Collect border pixels (just outside the diamond, within sampleRadius)
  const borderPixels = [];
  for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
    for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
      if (inDiamond(dx, dy, radius)) continue; // skip inside diamond
      if (!inDiamond(dx, dy, sampleRadius)) continue; // skip too far
      const px = cx + dx;
      const py = cy + dy;
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      const idx = (py * width + px) * 4;
      borderPixels.push({ dx, dy, r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2] });
    }
  }

  if (borderPixels.length === 0) return { source: 'sparkle', removed: false };

  // For each pixel inside the diamond, interpolate from nearest border pixels
  // using inverse-distance weighting
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (!inDiamond(dx, dy, radius)) continue;
      const px = cx + dx;
      const py = cy + dy;
      if (px < 0 || px >= width || py < 0 || py >= height) continue;

      let totalWeight = 0;
      let rSum = 0, gSum = 0, bSum = 0;

      for (const bp of borderPixels) {
        const distSq = (dx - bp.dx) ** 2 + (dy - bp.dy) ** 2;
        if (distSq === 0) continue;
        const weight = 1 / distSq;
        totalWeight += weight;
        rSum += bp.r * weight;
        gSum += bp.g * weight;
        bSum += bp.b * weight;
      }

      if (totalWeight > 0) {
        const idx = (py * width + px) * 4;
        pixels[idx] = Math.round(rSum / totalWeight);
        pixels[idx + 1] = Math.round(gSum / totalWeight);
        pixels[idx + 2] = Math.round(bSum / totalWeight);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Overlay logo where the sparkle was
  const logo = await loadImage(LOGO_PATH);
  const logoX = cx - LOGO_SIZE / 2;
  const logoY = cy - LOGO_SIZE / 2;
  ctx.drawImage(logo, logoX, logoY, LOGO_SIZE, LOGO_SIZE);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(imagePath, buffer);

  return { source: 'sparkle', removed: true, position: { cx, cy, radius } };
}

module.exports = { removeSparkleWatermark };
