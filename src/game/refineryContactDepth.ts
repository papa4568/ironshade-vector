export const REFINERY_CONTACT_DEPTH_PROFILE = Object.freeze({
  id: 'refinery-contact-grounding-v1',
  technique: 'instanced-soft-contact-decals',
  opacity: 0.26,
  alphaTextureSize: 32,
  instanceLimit: 10,
  trianglesPerInstance: 2,
  drawCalls: 1,
  protectedCueGroups: Object.freeze(['hud', 'enemies', 'hazards', 'objectives', 'loot', 'interactables']),
});

export function createRefineryContactDepthAlphaData(size: number = REFINERY_CONTACT_DEPTH_PROFILE.alphaTextureSize) {
  const boundedSize = Math.max(4, Math.min(64, Math.round(Number.isFinite(size) ? size : REFINERY_CONTACT_DEPTH_PROFILE.alphaTextureSize)));
  const data = new Uint8Array(boundedSize * boundedSize * 4);
  for (let y = 0; y < boundedSize; y += 1) {
    for (let x = 0; x < boundedSize; x += 1) {
      const nx = ((x + 0.5) / boundedSize) * 2 - 1;
      const ny = ((y + 0.5) / boundedSize) * 2 - 1;
      const radius = Math.hypot(nx, ny);
      const linear = Math.max(0, Math.min(1, (1 - radius) / 0.82));
      const alpha = Math.round(255 * linear * linear * (3 - 2 * linear));
      const index = (y * boundedSize + x) * 4;
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = alpha;
    }
  }
  return data;
}

export function refineryContactDepthTelemetry(instanceCount: number) {
  const instances = Math.max(0, Math.min(REFINERY_CONTACT_DEPTH_PROFILE.instanceLimit, Math.floor(Number.isFinite(instanceCount) ? instanceCount : 0)));
  const triangles = instances * REFINERY_CONTACT_DEPTH_PROFILE.trianglesPerInstance;
  const draws = instances > 0 ? REFINERY_CONTACT_DEPTH_PROFILE.drawCalls : 0;
  return `grounding:${REFINERY_CONTACT_DEPTH_PROFILE.id}:instances-${instances}:triangles-${triangles}:draws-${draws}:alpha-${REFINERY_CONTACT_DEPTH_PROFILE.alphaTextureSize}:opacity-${REFINERY_CONTACT_DEPTH_PROFILE.opacity.toFixed(2)}`;
}
