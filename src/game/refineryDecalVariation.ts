// Deterministic, presentation-only seam placement variation for the repeated
// refinery floor modules. Native Babylon mesh instances retain shared geometry;
// only their decorative transforms vary, so no new textures/decodes are needed.
export const REFINERY_F5_SEAM_VARIANTS = Object.freeze([
  { x: -0.14, z:  0.07, yaw: -0.055, scale: 0.94 },
  { x:  0.10, z: -0.06, yaw:  0.045, scale: 1.04 },
  { x: -0.04, z: -0.10, yaw: -0.02,  scale: 0.98 },
  { x:  0.15, z:  0.04, yaw:  0.055, scale: 1.03 },
  { x:  0.03, z:  0.11, yaw: -0.035, scale: 0.96 },
  { x: -0.11, z: -0.02, yaw:  0.025, scale: 1.02 },
]);

export function refineryF5SeamVariation(index: number) {
  return REFINERY_F5_SEAM_VARIANTS[index % REFINERY_F5_SEAM_VARIANTS.length];
}
