# Gear 2.0 Architecture Audit — P8.5-A

This document records the current equipment architecture and the target schema contract before behavior is refactored. The executable contract lives in `src/game/gearSchema.ts`.

## Current state

Ironshade currently has strong item concepts, but their power responsibilities overlap:

| Axis | Current behavior | Current owners | Target responsibility |
| --- | --- | --- | --- |
| Recovery Level | Gates equip level, frame generation, modifier-grade ceiling and Reconstruction boundaries | `scaling.ts`, `meta.ts`, `lootQuality.ts`, `reconstruction.ts` | Eligibility only |
| Recovery Quality | Source-pressure score biases rarity, grade floor and Equipment Quality | `lootQuality.ts`, `meta.ts`, `gearDepth.ts` | Original-drop quality/provenance |
| Frame Generation | Changes naming, implicit magnitude, quality derivation and sockets | `scaling.ts`, `meta.ts`, `gearDepth.ts` | Base-frame progression |
| Equipment Quality | Multiplies frame implicit values and is craftable | `gearDepth.ts`, `reconstruction.ts` | Limited base/inherent improvement |
| Modifier Grade | Scales explicit modifier upside and tradeoffs | `lootQuality.ts`, `meta.ts`, `reconstruction.ts` | Affix strength only |
| Rarity | Presentation plus rolled-mod count and socket opportunity | `rarity.ts`, `lootQuality.ts`, `reconstruction.ts` | Explicit-mod budget / curated Singular identity |
| Frame Identity | Adds another implicit stat/tradeoff layer | `gearDepth.ts`, `meta.ts`, `factionGear.ts` | Fold into meaningful base families |
| Augments | Adds extra stats/tradeoffs through sockets | `gearDepth.ts`, `reconstruction.ts` | Bounded utility/specialization customization |
| Faction | Alternate frame, preferred-affix bias and multi-piece bonuses | `factionGear.ts`, `meta.ts` | Base/source identity and build-tag bias |
| Singular | Fixed affixes + fixed frame behavior + unique runtime trait | `meta.ts`, `gearDepth.ts`, `sim.ts` | Curated rule-changing package with explicit opportunity cost |

The main risk is not any one axis; it is that several axes can improve the same output at once. For example a weapon can receive generation scaling, frame-identity scaling, Equipment Quality scaling, modifier-grade scaling, Augments, faction bonuses, progression bonuses and Singular logic before class-skill or specialization interactions are considered.

## Content ownership today

### Bases
- `meta.ts/baseNames` supplies generic slot bases and legal affix pools.
- `meta.ts/starterItems` defines onboarding equipment separately.
- `factionGear.ts/factionFrames` defines faction-specific alternate frames separately.
- `gearDepth.ts/frameIdentityDefinitions` supplies another layer of frame identity and implicit behavior.

### Stats and combat application
- `meta.ts/applyAffix` applies explicit modifier effects.
- `gearDepth.ts/applyFrameIdentity` applies frame implicit effects.
- `gearDepth.ts/applyAugments` applies Augment effects.
- `meta.ts/deriveCombatBuild` combines gear, progression, faction, specialization and class-family effects.
- `factionGear.ts/factionSetDefinitions` defines additional multi-piece global bonuses.

### Affixes
- `meta.ts/affixes` defines modifier presentation and baseline mechanical meaning.
- `meta.ts/baseNames[].affixes` defines slot legality.
- `lootQuality.ts` owns grade scaling/floors.
- `reconstruction.ts` independently chooses legal candidate affixes during crafting.

### Augments
- `gearDepth.ts/augmentDefinitions` owns identities, costs, slots and text.
- `gearDepth.ts/applyAugments` owns runtime effects.
- `reconstruction.ts` owns installation/removal boundaries.

### Singulars
- Singular templates and source pools live primarily in `meta.ts`.
- Frame identity is inferred through `gearDepth.ts`.
- Unique rule hooks are represented by `SingularTraitId` and executed in `sim.ts`.

### Build links
- Class ownership lives in `classSkills.ts`.
- Progression nodes and exact-affix specialization links live in `meta.ts`.
- Item affinity/build-changing UI derives from those separate systems.

## Target schema

`gearSchema.ts` defines one target vocabulary for all later Gear 2.0 batches:

- **GearBaseDefinition** — slot, generation, inherent/local stats, implicit stats, legal affix groups and build tags.
- **GearStatDefinition** — one stat ID with explicit scope and value semantics.
- **GearAffixDefinition** — one affix ID, group/conflict identity, legal slots, minimum Recovery Level, grade table, tags and optional mechanical hook.
- **GearAugmentDefinition** — legal slots, bounded stats/tradeoffs and build tags.
- **GearSingularDefinition** — category, base, fixed affixes/frame, unique trait, tags and opportunity cost.
- **GearItemV2** — the eventual save/runtime item record that references registries rather than duplicating rules.
- **GearBuildTag** — common language for Ballistics, Penetration, Armor Break, Precision, Projectile, Recoil, Mobility, Low-G, Thermal, Heat, Venting, Capacitor, Cooldown, Systems, Disruption, Relay, Mark, Pressure, Vacuum and Defense.

## Target ownership rules

1. Recovery Level answers **what can appear**, not **how hard it hits**.
2. Modifier Grade is the only affix-strength axis.
3. Equipment Quality improves base/inherent properties only.
4. Recovery Quality describes and biases the original recovery; it is not a persistent combat multiplier.
5. Frame Generation chooses/qualifies base families rather than universally upgrading every number.
6. Rarity controls explicit-mod budget: Field clean base, Refined up to 2, Prototype up to 6, Singular curated fixed package.
7. Augments remain constrained utility/specialization hardware, normally 0–2 sockets.
8. Singular value comes primarily from rule changes, loops or conversions, with an opportunity cost.
9. Class/specialization links should consume build tags or thresholds by default; exact-affix requirements become exceptional.
10. UI and combat must ultimately consume the same registry definitions instead of re-encoding rules in presentation text.

## Known migration debt reserved for later batches

P8.5-A does **not** change current balance or save data. The audit intentionally records several mismatches for the later implementation batches:

- Reconstruction currently allows modifier limits that do not match the target rarity budgets.
- Frame generation and Equipment Quality currently multiply implicit effects together.
- Recovery Quality influences multiple persistent item properties.
- Faction sets add another global power layer on top of item-local properties.
- Specialization gear links often require one exact affix ID.
- Normal Augment socket counts can reach three on mature high-rarity frames.
- Generic bases, faction frames and frame identities are separate concepts that need consolidation.
- Stat meaning/scope is still encoded directly in application code instead of a registry.

These are implementation targets for P8.5-B through P8.5-K, not regressions to fix inside P8.5-A.
