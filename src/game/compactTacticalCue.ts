// Compact landscape combat alerts retain the hazard name AND immediate
// consequence instead of collapsing a generic director prefix to a label.
// Route-specific short cues take precedence in GameCanvas; this handles
// unforeseen shared director hazards on Cryo, Lattice and later routes.
export function compactTacticalHazardCue(message: string): string {
  const parts = message.split(' // ').map(part => part.trim()).filter(Boolean);
  const generic = parts[0] === 'DIRECTOR EVENT' || parts[0] === 'TACTICAL ALERT';
  const meaningful = generic ? parts.slice(1) : parts;
  return meaningful.slice(0, 2).join(' // ') || message;
}
