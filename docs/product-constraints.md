# Ironshade Vector — Product Constraints

These are durable product decisions and quality constraints. They apply across roadmap batches unless a later explicit product decision replaces them.

## Product target

Target **premium console/PC-quality ARPG presentation on modern phones** while preserving responsive touch/controller play and reliable Android delivery.

- Build the premium version first. Solve device differences with adaptive quality, LODs, pooling, streaming, code splitting, and measured budgets before cutting mechanics.
- Protect frame pacing, input latency, memory/thermal stability, save integrity, deterministic QA, readable combat tells, and touch/controller usability.
- World state should communicate rarity, modifiers, status, boss phases, hazards, and interactions through model/animation/material/VFX/audio before relying on HUD text.
- Major combat actions should synchronize targeting, animation, sound, VFX, camera response, and haptics where supported.
- Performance scaling should remove secondary presentation cost before enemy mechanics, class identity, boss complexity, or encounter density.
- High-end devices should have a visibly richer quality mode.

## Locked design decisions

- Vanguard = **Breacher**
- Vector = **Rail Lance**
- Systems = **Carbine**
- No cross-family runtime weapon swapping.
- No per-item skill linking; skills belong to the class kit.
- FIRE and targeted skills acquire/focus first, then execute. Manual aim and explicit ground/self/mobility skills remain authoritative exceptions.
- Progression is a large layered graph with routing costs, major tradeoffs, specialization integration, planning/search tools, and build-defining nodes.
- Crafting uses visible affix rules, meaningful bases, distinct verbs, escalating control, rare deterministic options, and optional high-risk operations.
- Ship systems are intended to have deep, high-impact progression rather than shallow prototype tiers.

## Research and inspiration

When an implementation/design direction remains unclear after inspecting Ironshade's existing code and patterns, use focused current research rather than broad exploration.

For ARPG design inspiration, **Path of Exile 2** may be used as a reference for proven design lessons. Prefer official/first-party sources, supplement with strong community analysis when useful, adapt the lesson to Ironshade's hard-sci-fi identity, and do not copy content or presentation directly.
