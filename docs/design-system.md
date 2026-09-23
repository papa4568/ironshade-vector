# Ironshade Vector UI Design System

P15-A establishes the shared presentation primitives that later P15 work should reuse instead of redefining per-screen styling.

## Core rules

- **Typography:** use `--iv-font-body` for readable UI, `--iv-font-display` for titles, and the `--iv-type-*` scale for size.
- **Spacing:** use the `--iv-space-*` 4px rhythm. Prefer `.iv-stack`, `.iv-cluster`, and `.iv-grid` for repeated layout patterns.
- **Iconography:** Lucide or authored SVG icons should use `.iv-icon` plus the size modifiers. Keep icon meaning reinforced by labels or shape, not color alone.
- **Focus:** interactive controls inherit the shared `:focus-visible` outline and halo. Do not remove it on individual screens.
- **Rarity:** `Field`, `Refined`, `Prototype`, and `Singular` map directly to the canonical Gear 2.0 rarity contract. Use `.iv-rarity-token` with `.rarity-*` or `data-rarity`.
- **Panels/tooltips:** use `.iv-panel` / `.iv-panel--glass` and `.iv-tooltip` before introducing new shell treatments.
- **Responsive behavior:** safe-area variables are available globally; coarse-pointer layouts receive larger interaction heights and compact panel spacing.

## Shared primitives

```html
<section class="iv-panel">
  <header class="iv-panel__header iv-label">Operator Network</header>
  <div class="iv-panel__body iv-stack">...</div>
</section>

<span class="iv-rarity-token rarity-singular">Singular</span>
```

Feature-specific art direction can layer on top of these primitives, but the core token values should stay centralized in `src/designSystem.css`.
