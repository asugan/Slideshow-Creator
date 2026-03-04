/**
 * Watermark remover wrapper for Node.js
 * Loads image, runs watermark engine, writes output
 */

const fs = require('fs');
const { loadImage } = require('canvas');
const { WatermarkEngine } = require('./watermarkEngine');

let engineInstance = null;

async function getEngine() {
    if (!engineInstance) {
        engineInstance = await WatermarkEngine.create();
    }
    return engineInstance;
}

/**
 * Remove Gemini watermark from image file (overwrites in-place)
 * @param {string} imagePath - Path to PNG image
 * @returns {Object} Watermark removal metadata
 */
async function dewatermarkImage(imagePath) {
    if (!fs.existsSync(imagePath)) {
        throw new Error(`Image not found: ${imagePath}`);
    }

    const engine = await getEngine();
    const image = await loadImage(imagePath);
    const { canvas, meta } = await engine.removeWatermarkFromImage(image);

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(imagePath, buffer);

    return meta;
}

module.exports = { dewatermarkImage };
