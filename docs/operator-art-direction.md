# Operator art direction — premium field suit

Tracking: #10 — Premium Stylized Hard-Sci-Fi 3D.

## Readability target

The operator must read immediately as a compact EVA-capable industrial combat suit at normal phone combat zoom. The silhouette should stay recognizable without depending on color: broad armored shoulders, compact sealed helmet, chest overplate, backpack/thruster mass, separated boots, and asymmetric utility detail.

## Shape language

- Forward-facing armored chest wedge with a narrower protected waist.
- Compact helmet with a dark visor plane and a small practical lamp rather than a large exposed face.
- Backpack mass kept close to the spine so the character remains readable from the isometric camera.
- Shoulder armor and boots slightly exaggerated relative to realistic human proportions for small-screen readability.
- Twin rear thrusters establish the EVA/low-gravity identity.
- Weapon remains a separate gameplay attachment so weapon art can evolve independently in Phase 4.

## Material language

- Main shell: painted metal, medium-high metalness, controlled roughness.
- Secondary armor: darker gunmetal with less visual noise.
- Undersuit/joints: dark non-metallic flexible material.
- Visor and status accents: restrained emissive values reserved for gameplay/readability.
- Avoid micro-scratches or dense surface noise that disappear into shimmer on a phone display.

## Faction treatment

The geometry remains shared. Faction identity should be expressed through authored material parameters and accent zones rather than duplicating the mesh:

- Meridian: cool desaturated green shell with teal status light.
- Heliostat: warmer amber/orange armor accents.
- Longarc: cool blue/cyan technical accents.

Role/readability must remain intact if the image is viewed in grayscale.

## LOD plan

The first committed authored asset is `operator-field-suit-lod2.glb`, the Performance-tier silhouette proof. It establishes real GLB content, ground origin, dimensions, material behavior, and runtime validation before rigging work starts.

Planned follow-up:

- LOD1: articulated mid-detail suit for normal mobile gameplay.
- LOD0: hero-detail rigged suit for High tier and close presentation surfaces.
- LODs must preserve the same overall silhouette, pivot, attachment conventions, and animation skeleton once rigging lands.

## Animation target

The final rigged operator should support idle, locomotion, aim, fire/recoil, reload, dodge/thruster burst, hit reaction, and any applicable down/death state. Animation must remain presentation-only; simulation timing, aim direction, collision, and weapon firing cadence stay authoritative in gameplay code.
