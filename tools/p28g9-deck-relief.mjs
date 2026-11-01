// Independent P28-G9 *pixel* guard for a fully rendered KTX2 survey deck.
// Read only genuine raw Android framebuffer pixels; never modify a screenshot.
// The patch lies on the foreground plate away from the mobile HUD/actors.
// Use normalized coordinates so the same region survives display DPI changes.
export function auditParallaxDeckRelief(image) {
  const { width, height, pixels } = image;
  if (!Number.isInteger(width) || !Number.isInteger(height)
    || width < 640 || height < 320 || pixels?.length !== width * height * 4) {
    throw new Error('Invalid real Parallax Android raster for deck relief audit');
  }
  const x0 = Math.floor(width * 0.27);
  const x1 = Math.floor(width * 0.38);
  const y0 = Math.floor(height * 0.64);
  const y1 = Math.floor(height * 0.81);
  let samples = 0;
  let texturedSamples = 0;
  for (let y = y0 + 2; y < y1 - 2; y += 3) {
    for (let x = x0 + 2; x < x1 - 2; x += 3) {
      const index = (y * width + x) * 4;
      const right = index + 8; // two neighboring real framebuffer pixels
      const below = index + 2 * width * 4;
      let variation = 0;
      for (let channel = 0; channel < 3; channel += 1) {
        variation += Math.abs(pixels[index + channel] - pixels[right + channel]);
        variation += Math.abs(pixels[index + channel] - pixels[below + channel]);
      }
      // Plain tinted PBR fallback material/late KTX2 upload measures near
      // zero; the real normal-mapped diamond plate produces frequent edges.
      if (variation / 3 > 10) texturedSamples += 1;
      samples += 1;
    }
  }
  const edgeRatio = samples ? texturedSamples / samples : 0;
  return { valid: samples >= 1000 && edgeRatio >= 0.045,
    edgeRatio: Number(edgeRatio.toFixed(5)), samples, texturedSamples,
    region: [0.27, 0.64, 0.38, 0.81] };
}
