/**
 * Watermark remover wrapper for Node.js
 * Routes to appropriate remover based on IMAGE_PROVIDER config.
 */

const fs = require('fs');
const { loadImage } = require('canvas');
const { WatermarkEngine } = require('./watermarkEngine');
const { removeSparkleWatermark } = require('./sparkleRemover');
const { IMAGE_PROVIDER } = require('../config');

let engineInstance = null;

async function getEngine() {
    if (!engineInstance) {
        engineInstance = await WatermarkEngine.create();
    }
    return engineInstance;
}

/**
 * Remove watermark from image file (overwrites in-place).
 * Uses Gemini alpha-blending remover for gemini-reverse-api,
 * sparkle inpainting remover for openai-compat.
 * @param {string} imagePath - Path to PNG image
 * @returns {Object} Watermark removal metadata
 */
async function dewatermarkImage(imagePath) {
    if (!fs.existsSync(imagePath)) {
        throw new Error(`Image not found: ${imagePath}`);
    }

    if (IMAGE_PROVIDER === 'openai-compat') {
        return removeSparkleWatermark(imagePath);
    }

    const engine = await getEngine();
    const image = await loadImage(imagePath);
    const { canvas, meta } = await engine.removeWatermarkFromImage(image);

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(imagePath, buffer);

    return meta;
}

module.exports = { dewatermarkImage };
