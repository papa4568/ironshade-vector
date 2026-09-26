import { rarityDefinition, rarityDisplayLabel, rarityOrder } from './rarity';

export type GuideSectionId =
  | 'combat-controls'
  | 'equipment-rarity'
  | 'builds-progression'
  | 'crafting'
  | 'ship-operations'
  | 'accessibility-settings';

export type GuideTopic = {
  id: string;
  title: string;
  body: string;
  points?: string[];
};

export type GuideSection = {
  id: GuideSectionId;
  label: string;
  eyebrow: string;
  summary: string;
  topics: GuideTopic[];
};

const rarityPoints = rarityOrder.map(rarity => {
  const definition = rarityDefinition(rarity);
  return rarityDisplayLabel(rarity) + ' — ' + definition.meaning;
});

export const guideSections: GuideSection[] = [
  {
    id: 'combat-controls',
    label: 'Combat & Controls',
    eyebrow: 'FIELD MANUAL',
    summary: 'Movement, aim, class actions, heat, interaction, and the input language shared across touch, keyboard/mouse, and controller play.',
    topics: [
      {
        id: 'combat-inputs',
        title: 'Core inputs',
        body: 'Move first, acquire a target, then commit the class armament or a class skill. Manual aim remains authoritative when you drag the battlefield or use a precise mouse/right-stick direction.',
        points: [
          'Desktop: WASD moves, mouse aims, left mouse fires, Q/E/F use your first/second/third class skills, Space dodges, X interacts, R reloads, and V vents.',
          'Mobile: left stick moves; hold FIRE for assisted tracking; drag the right battlefield for precision aim; use the three class-skill buttons, DODGE, ACT, and reload/vent prompts as they become relevant.',
          'Touch layout: Standard keeps movement on the left and combat actions on the right; Large enlarges both clusters; Left-Handed swaps those sides. Settings can lift, inset, and scale each cluster, and Reset reapplies the selected preset.',
          'Mission-critical vitals, objectives, alerts, target/boss state, and transient combat tells stay fixed outside the movable touch clusters. Portrait temporarily suspends horizontal inset so movement and actions remain separated; the saved landscape offset is preserved.',
          'Controller: movement/aim use the sticks; focused UI actions use the platform confirm/back convention. Menus preserve native focus order so D-pad/stick navigation remains visible.',
        ],
      },
      {
        id: 'combat-reading',
        title: 'Read the fight',
        body: 'Health, armor, target state, objective state, hazards, boss phases, status cues, and nearby interaction prompts are decision information. They stay on the combat surface rather than moving into this Guide.',
        points: [
          'Armor and health are separate layers; breaking armor can change the value of follow-up attacks.',
          'FIRE and targeted skills acquire/focus first, then execute. Ground, self, mobility, and explicit manual-aim actions remain exceptions.',
          'If heat or another resource blocks an action, use the live HUD reason and recovery prompt; this Guide never replaces transient combat tells.',
        ],
      },
    ],
  },
  {
    id: 'equipment-rarity',
    label: 'Equipment & Rarity',
    eyebrow: 'RECOVERY MANUAL',
    summary: 'How class-owned weapon families, universal support slots, rarity, Recovery Level, frame quality, modifiers, and Augments fit together.',
    topics: [
      {
        id: 'class-arsenals',
        title: 'Class arsenals',
        body: 'Each operator class owns one runtime weapon family. New weapon recoveries stay inside that family, while Combat Suit, Systems Rig, and Implant remain universal support slots.',
        points: [
          'Vanguard owns Breacher: close pressure, armor breaking, and recoil/backblast positioning.',
          'Vector owns Rail Lance: precision, deliberate cadence, range control, and marked weak-point payoff.',
          'Systems owns Carbine: sustained pressure, target routing, heat management, and capacitor flow.',
          'Off-class weapons preserved by older saves stay in storage but cannot be equipped by the wrong class.',
        ],
      },
      {
        id: 'rarity',
        title: 'Rarity language',
        body: 'Rarity communicates how an item is structured, not just a color tier. Shape, label, and fixed-rule language reinforce the same meaning.',
        points: rarityPoints,
      },
      {
        id: 'equipment-depth',
        title: 'Frame depth',
        body: 'Recovery Level describes source depth. Frame generation, frame quality, explicit modifier grades, and Augments are separate axes, so improving one does not silently improve all the others.',
        points: [
          'Frame Quality improves the inherent frame property only.',
          'Explicit modifiers carry their own grades and legal families.',
          'Augments are bounded hardware sockets with compatibility rules.',
          'Singular equipment keeps its fixed signature package; Reconstruction can improve open frame axes but does not reroll the Singular rule.',
        ],
      },
    ],
  },
  {
    id: 'builds-progression',
    label: 'Builds & Progression',
    eyebrow: 'OPERATOR NETWORK',
    summary: 'How class identity, the Operator Network, Skill Lenses/Evolutions, specializations, capstones, planning, and recalibration connect.',
    topics: [
      {
        id: 'network-routing',
        title: 'Operator Network routing',
        body: 'Your class establishes an origin and weapon-family sector. Planning can preview routes and before/after math without spending points; allocation only happens on a currently legal node.',
        points: [
          'Route costs count required connected nodes, including shared route segments.',
          'Major and Keystone choices can create explicit tradeoffs or mutually exclusive routes.',
          'Blocked nodes keep their local blocker reason and next requirement beside the action.',
          'Recalibration refunds only legal connected allocations; any current credit cost stays visible on the rebuild action.',
        ],
      },
      {
        id: 'skills-specialization',
        title: 'Skills, Evolutions & specialization',
        body: 'Read each class skill as Class Skill → Weapon Family → Lens/Evolution → Specialization/Capstone. Skills belong to the class kit rather than individual weapon items.',
        points: [
          'Standard behavior and shared Lenses can change a skill without linking it to one recovered weapon.',
          'Class Evolutions use their listed operator-level gates.',
          'A class specialization opens at LV15; compatible LV16 Evolutions can form capstone links.',
          'Every selectable option keeps its immediate tradeoff and eligibility state on the Skills screen.',
        ],
      },
    ],
  },
  {
    id: 'crafting',
    label: 'Crafting',
    eyebrow: 'RECONSTRUCTION MANUAL',
    summary: 'The legal modifier pool, material tiers, Microforge control, stability, protected/volatile work, and the review-before-spend contract.',
    topics: [
      {
        id: 'crafting-contract',
        title: 'Know the result space before spending',
        body: 'Reconstruction starts from the selected base frame. The base controls its legal pool, rarity controls explicit capacity, and the lower of Recovery access and Microforge access controls the grade ceiling.',
        points: [
          'Credits, Frame Alloy, Circuit Stock, and Precision Components fund ordinary work.',
          'Quarantined Trace funds premium deterministic control such as exact Precision Add, protected Replace, and G5 Prime access where legal.',
          'Microforge T2 unlocks the protected-control tier; exact current gates remain beside the action.',
          'Class-family ownership still gates the pool, and active specialization field-integration links can discount matching legal recipe targets without bypassing base legality.',
          'Removing or replacing work does not refund materials already spent.',
        ],
      },
      {
        id: 'crafting-risk',
        title: 'Control, stability & volatile work',
        body: 'Controlled work favors predictability. Volatile work can waive premium control costs but accepts a failure chance tied to the frame’s persisted stability.',
        points: [
          'Volatile work consumes stability whether it succeeds or fails.',
          'Legality, rarity capacity, Recovery Level, and grade ceilings still apply to volatile outcomes.',
          'The bench always shows exact cost, guaranteed outcomes, possible outcomes, exclusions/risk, and before/after state before confirmation.',
          'Singular signature rules are fixed and are not a random-modifier crafting target.',
        ],
      },
    ],
  },
  {
    id: 'ship-operations',
    label: 'Ship & Operations',
    eyebrow: 'COMMAND MANUAL',
    summary: 'Ship progression, contracts, Daily Operations, Escalations, Directives, recovery depth, and the optional Operations telemetry network.',
    topics: [
      {
        id: 'ship-systems',
        title: 'Ship Systems',
        body: 'Ship systems are permanent progression foundations with six major tiers. Late specialization packages add a larger doctrine choice after their explicit prerequisites are met.',
        points: [
          'Each upgrade screen keeps the exact next benefit, gates, cost, and affordability local.',
          'One advanced ship specialization can be installed; committing it locks the alternatives for that save.',
          'Cargo affects material yield rather than turning equipment recovery into item spam.',
        ],
      },
      {
        id: 'operation-types',
        title: 'Operation types',
        body: 'The Contract Board mixes standard deployments with narrative, shared, escalating, rare, and prepared operation types without changing the core safe/deep extraction loop.',
        points: [
          'Daily Operations share a seeded challenge and first-extraction material bonus for the active UTC date.',
          'Escalations are three-contract sequences where banked physical failures accumulate into later stages.',
          'Operation Directives add explicit risk modifiers and reward previews before deployment.',
          'Rare derelicts and command traces use their own local route/reward rules; those details stay on the selected contract.',
        ],
      },
      {
        id: 'telemetry',
        title: 'Optional Operations telemetry',
        body: 'Anonymous run sharing is optional. When enabled, gameplay numbers and low-frequency position checkpoints can contribute to balance metrics and replay traces without an account or device identifier attached to the run.',
        points: [
          'Local progression and rewards do not depend on telemetry upload success.',
          'The current sharing toggle and privacy explanation remain in Settings and on the Operations consent surface.',
        ],
      },
    ],
  },
  {
    id: 'accessibility-settings',
    label: 'Accessibility / Settings',
    eyebrow: 'CLIENT CONFIGURATION',
    summary: 'Interface size, readable text, contrast, motion, aiming assistance, effects, audio, haptics, and privacy controls that persist with the local operator profile.',
    topics: [
      {
        id: 'accessibility',
        title: 'Readability & motion',
        body: 'Interface Size, Interface Text Size, High Contrast, and Reduce Motion change presentation without changing combat timing or simulation rules.',
        points: [
          'Interface Size scales shared non-combat menu, panel, spacing, icon, and informational UI tokens. Compact fits more management UI; Large increases overall interface presence.',
          'Combat movement, FIRE, DODGE, class-skill, ACT, and other touch-control geometry remain owned only by Combat Layout Preset and cluster controls.',
          'Large text composes with Interface Size so rem-based typography grows independently while responsive layouts reflow around both choices.',
          'High Contrast strengthens text, borders, surfaces, and focus cues while keeping rarity shape coding.',
          'Reduce Motion disables interface transitions and combat camera shake; critical gameplay timing stays unchanged.',
          'Touch layout presets and custom cluster positions remain compatible with Interface Size, Large text, High Contrast, and Reduce Motion because general interface presentation does not alter combat input geometry or semantics.',
        ],
      },
      {
        id: 'assistance-feedback',
        title: 'Aim, feedback & privacy',
        body: 'Assistance and feedback settings tune how the client presents or acquires information; they do not silently change encounter rules.',
        points: [
          'Touch Aim Assistance changes how readily assisted FIRE acquires a nearby visible target.',
          'Assisted Fire Tracking can be disabled for fully manual touch aiming.',
          'Screen Shake and Effect Intensity tune secondary feedback while preserving critical tells.',
          'Combat/UI volume and Mobile Haptics control feedback buses independently.',
          'Anonymous run telemetry is opt-in and can be changed at any time in Settings.',
        ],
      },
    ],
  },
];

export function guideSection(id: GuideSectionId) {
  return guideSections.find(section => section.id === id) ?? guideSections[0];
}
