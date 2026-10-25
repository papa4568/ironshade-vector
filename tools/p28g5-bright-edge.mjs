// P28-G5: inspect the full physical frame edge; the shared center-crop
// cannot see bright Android cutout/letterbox margins outside the game.
export function auditBrightEdgeMargins(image) {
  const { width, height, pixels } = image;
  if (!(width >= 64 && height >= 64 && pixels.length === width * height * 4)) {
    throw new Error('Invalid screenshot raster for edge-margin inspection');
  }
  const limit = Math.floor(width * 0.12);
  const stepY = Math.max(1, Math.floor(height / 60));
  const nearWhite = (x) => {
    let matching = 0, sampled = 0;
    for (let y = Math.floor(height * 0.08); y < Math.ceil(height * 0.92); y += stepY) {
      const p = (y * width + x) * 4;
      const r = pixels[p], g = pixels[p + 1], b = pixels[p + 2];
      if (Math.min(r, g, b) >= 235 && Math.max(r, g, b) - Math.min(r, g, b) <= 15) matching++;
      sampled++;
    }
    return matching / sampled >= 0.90;
  };
  const extent = (right) => {
    let count = 0;
    for (let i = 0; i < limit; i++) {
      if (!nearWhite(right ? width - 1 - i : i)) break;
      count++;
    }
    return count;
  };
  const left = extent(false), right = extent(true);
  const threshold = Math.max(12, Math.floor(width * 0.018));
  return { valid: left < threshold && right < threshold,
    leftBrightPixels: left, rightBrightPixels: right, threshold };
}
