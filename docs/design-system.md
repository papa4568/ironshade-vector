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
- **Glance-first compact-phone hierarchy:** on phone-sized windows, anything visible by default should help the player survive, choose, or act within the next 1–2 seconds. Keep contextual information conditional and move technical/secondary explanation one interaction deeper instead of shrinking every desktop surface.
- **Compact-phone typography floor:** treat roughly 12px as the minimum for secondary UI labels, 14–16px as the normal range for decision information, and larger sizes for critical numbers/actions. Recompose, wrap, scroll, or disclose content before using 6–9px text as a fit strategy.
- **Adaptive primary navigation:** keep one information architecture, but place primary destinations in a bottom dock on compact phone windows and use a rail/sidebar only when the window is genuinely wide enough. Preserve active-page semantics, focus order, safe areas, and touch/controller parity across both compositions.
- **Identity preservation:** responsive simplification changes information priority, not Ironshade's hard-sci-fi visual identity, rarity language, class control model, or accessibility behavior.
- **Progressive disclosure:** default decision surfaces should lead with the plain-language outcome, the few facts needed to act, and the primary action. Move technical metadata, formulas, provenance, and extended explanations behind an explicit Details / How it works popup, sheet, or expandable section instead of presenting every layer at once.
- **Action eligibility:** never rely on a disabled style alone. A blocked, ready, selected, or active action must expose a nearby plain-language state plus the reason and next unmet requirement when blocked.
- **Popup safety:** popups and sheets are for secondary explanation or drill-down, not for hiding a required cost, tradeoff, warning, or eligibility blocker. They must support keyboard/controller focus, Escape/back dismissal, touch-safe controls, and readable mobile layouts.

## Shared primitives

```html
<section class="iv-panel">
  <header class="iv-panel__header iv-label">Operator Network</header>
  <div class="iv-panel__body iv-stack">...</div>
</section>

<span class="iv-rarity-token rarity-singular">Singular</span>
```

Feature-specific art direction can layer on top of these primitives, but the core token values should stay centralized in `src/designSystem.css`.
