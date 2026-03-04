/**
 * Alpha Map calculator
 * Calculate alpha map from capture background image
 */

/**
 * Calculate alpha map from background captured image
 * @param {ImageData} bgCaptureImageData - ImageData object for background capture
 * @returns {Float32Array} Alpha map (value range 0.0-1.0)
 */
function calculateAlphaMap(bgCaptureImageData) {
    const { width, height, data } = bgCaptureImageData;
    const alphaMap = new Float32Array(width * height);

    for (let i = 0; i < alphaMap.length; i++) {
        const idx = i * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const maxChannel = Math.max(r, g, b);
        alphaMap[i] = maxChannel / 255.0;
    }

    return alphaMap;
}

module.exports = { calculateAlphaMap };
