// Preserve the requested High-tier raster ceiling while applying measured
// adaptive-pressure scaling even on 1x displays. Previously clamping the
// scaled quality cap before the device ratio meant desktop 1x never downscaled.
export function babylonEffectivePixelRatio(
  quality: number,
  devicePixelRatio: number,
  adaptiveScale: number,
) {
  const cap = quality < 0.55 ? 1.12 : quality < 0.8 ? 1.35 : 1.8;
  const physicalRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio
    : 1;
  const base = Math.min(cap, physicalRatio);
  return Math.min(physicalRatio, Math.max(0.76, base * adaptiveScale));
}
