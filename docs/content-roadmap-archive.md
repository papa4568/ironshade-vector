# Ironshade Vector — Completed Roadmap Archive

This file is the permanent archive for completed production work. The active execution checklist lives in `docs/content-roadmap.md`.

**Archive rule:** once a roadmap batch is merged, verified, and marked complete, move its detailed checklist and delivery note here. Keep only a compact completion pointer in the active roadmap. Do not execute work directly from this archive.

## Completed P6 Directive Work

- [x] **P6.1 Exclusive protocol combinations**
- [x] **P6.2 Enhanced protocol variants**
- [x] **P6.3 T9+ mutations**
- [x] **P6-A Boss phase mutations** — T9+ bosses now arm deterministic phase-two-only mutation identities; T12 combines two distinct mutations. The system is separate from elite mutation budgets and future whole-target command packages, discloses the armed mutation in Tactical Forecast and the boss HUD, and applies transition/runtime pressure through rupture/countermass/relay hazards plus bounded firing-cadence escalation.
  - Regression covers pre-T9 lockout, tier legality, deterministic forecast/runtime parity, T12 non-duplication, phase-one dormancy, phase transition effects, recurring phase-two effects, and UI disclosure.
  - QA direction updated: the bundle-size budget and raw/gzip byte reporting are removed entirely; Vite's chunk-size warning ceiling is disabled, while deferred Three.js/authored-loader isolation, dynamic entry splitting, and chunk-structure assertions remain mandatory.
  - Cap-free verification: PR Browser E2E `35556215023` passed desktop/mobile-landscape; merged-main Browser E2E `35556330981`, Level 15 beta smoke `35556331013`, and Android beta.206 `35556330989` all passed. Artifact `10620835919` has APK SHA-256 `1638186f43f3add07bc3ae43a8489d1410b7e3c73261d2a0c1a9ba058a5e71b5`.
  - Verified on merged main `61c3f039be921153950a2cb536d985c987e23a3a`: Browser E2E `35555532705`, Level 15 beta smoke `35555532748`, Android beta.205 `35555532703`, artifact `10620730413`, APK SHA-256 `713a76706a1e12475089f6896d11e7c97302dfabba06996078f951400f914745`.
- [x] **P6-B Command Target mutations** — T9–T12 Command Target directives now arm one deterministic whole-fight mutation package that is stored and executed separately from elite T9+ mutations and phase-two boss mutations. Four authored packages cover reinforced durability, faster pursuit recovery, recurring countermass denial, and recurring relay/shock-grid denial; the package remains active before and after the boss phase transition.
  - Pre-deployment disclosure is present on Directive cards and Tactical Forecast; the combat boss HUD identifies the active whole-fight package independently of any armed/active phase mutation.
  - Regression covers pre-T9 lockout, Command Target-only eligibility, tier legality, deterministic forecast/runtime parity, dedicated storage separation, durability changes, cadence changes, phase-one activity, recurring arena hazards, and UI disclosure.
  - Verified on PR head `881b25139036a79f9179992cf1ce969e69b27cf4`: Browser E2E `35557209844` passed desktop and mobile-landscape including full regression/production build and browser journey.
  - Verified on merged gameplay source `2feaef5a529fd6f4032bb7074d2cf15302dbbd48`: Browser E2E `35557318517`, Level 15 beta smoke `35557318419`, and Android beta.207 `35557318413` all passed. Artifact `10620214462` contains debug-signed APK SHA-256 `36260887f7d51de83d9fcc77467e582704202248c3c5d73dff1190d7be5c0a88`.

- [x] **P6-C Environmental risk package** — T9–T12 Directives now resolve deterministic high-tier environmental packages that pair two authored Director events inside one overlapping danger window instead of merely increasing event count. Packages are tier/location/objective aware, preserve the four-event high-tier budget, and leave remaining event ecology/group selection intact.
  - Eight authored package identities cover pressure + grid, breach + shutter, cargo + magnetic swing, gravity + defenses, habitat spin + grid, compressor + arc, solar thermal + machinery runaway, and ice-bore collapse + purge combinations.
  - Every package carries a disclosed extraction-yield premium (8%–16%) that feeds the real operation settlement multiplier; Directive cards and Tactical Forecast display the package identity, physical risk description, and yield bonus before deployment.
  - Regression covers pre-T9 lockout, deterministic package selection, exact two-event composition, overlapping schedule timing, both events firing in the shared danger window, reward-multiplier parity, preserved high-tier event budget, and UI disclosure.
  - Verified on PR head `17fa6836b3746db616c99322c682d8532229bcb1`: Browser E2E `35558132124` passed desktop and mobile-landscape including full regression/production build and browser journeys. The initial CI attempt caught an unused type-only import; it was removed before the verified run.
  - Verified on merged gameplay source `2ff92ba5bade634e3fbf053cc2ddb13db3816a22`: Browser E2E `35558235262`, Level 15 beta smoke `35558235264`, and Android beta.208 `35558235240` all passed. Artifact `10621705098` contains debug-signed APK SHA-256 `2572bb716ab6ffd375e16635ebf252182743b75ce3a7484061b992cf09ffad8a`.

- [x] **P6-D Chase reward package** — T9–T12 Operation Directives now own a dedicated six-item Singular chase pool covering Carbine, Breacher, Rail Lance, suit, rig, and implant slots. Those six build-changing items are excluded from ordinary location chase pools so the endgame reward source is genuinely exclusive rather than another additive drop path.
  - Directive chase odds scale visibly by tier from 3% safe / 6% deep at T9 to 9% safe / 18% deep at T12. Successful rolls replace the normal contract chase slot instead of increasing ordinary item spam; ground-drop Singulars suppress the extra Directive roll, while a deep boss recovery can still pair with one Directive chase item inside the existing two-reward contract budget.
  - Directive cards and the prepared contract inspector disclose the exact six-item candidate pool and safe/deep odds before deployment. The normal Directive quality, source recovery-level, location-Singular pressure, environmental-yield, Command package, and boss-phase systems remain independent.
  - Regression covers pre-T9 lockout, exact six-item membership, safe/deep odds, removal from ordinary location pools, deterministic materialization from the exclusive pool, and pre-deployment UI disclosure.
  - Verified on PR head `a314efb1741e4be0a2f9afaf4ac11a6993bc0d8d`: Browser E2E `35559001381` passed desktop and mobile-landscape including full regression/production build and browser journeys.
  - Verified on merged gameplay source `18147504baeab95146f5d1fbfb53c8ec3fe1a49e`: Browser E2E `35559131881`, Level 15 beta smoke `35559131901`, and Android beta.209 `35559131902` all passed. Artifact `10621546868` contains debug-signed APK SHA-256 `f465b97d1d17bd419734b413b5d81c130e2a03db8acfa3a4dc52f5c26e521602`.


- [x] **P6-E Endgame verification** — release builds now gate on a deterministic T9–T12 encounter matrix plus a saturated T12 runtime stress pass and adaptive-quality recovery checks. The matrix replays six fixed seeds at every high-end tier and compares the resulting Directive modifiers, encounter budget, environmental plan, elite protocols, T9+ mutations, Command Target package, boss phase mutations, roster state, and boss durability signature.
  - Worst-case T12 QA deterministically searches Command Target directives for the highest combined threat/risk/protocol/event pressure with a recurring command-package pulse, forces the encounter into its phase-two pressure window, and runs a 60-second / 600-step live simulation. The trace requires all scheduled Director events to fire, hostile projectiles and overlapping hazards to materialize, combat/physics values to remain finite and physically bounded, and the fixed pools to remain fixed at 112 projectiles / 12 hazards / 30 effects / 24 damage numbers / 16 debris objects.
  - Adaptive render verification drives sustained worst-case frame pressure to Performance quality, asserts the authored low-cost shadow/detail/VFX/transparency budget, then proves recovery to High on desktop and the safe Balanced baseline on coarse/mobile devices.
  - The first PR CI attempt correctly exposed an over-specific stress-harness assumption about boss phase thresholds; the harness was corrected to enter the universal low-health + armor-broken phase-two window without changing gameplay behavior. Verified PR head `91075455e4e09406b3ddc682c36e561c14bd2c35`: Browser E2E `35560181053` passed desktop and mobile-landscape including the full regression/production build.
  - Verified on merged gameplay source `d2e2448f2bc693df70684bcb5097c4b1fcfa31ba`: Browser E2E `35560310881`, Level 15 beta smoke `35560310891`, and Android beta.210 `35560310916` all passed. Artifact `10621449019` contains debug-signed APK SHA-256 `bbd8a2e133be6793ba7c9ed74d1ba2131961adf475fa67cd13c26b86b4bc9d04`.


## P7 — Loot Rarity & Equipment Presentation

- [x] **P7-A Rarity contract** — Field, Refined, Prototype, and Singular now share one authored contract for order/rank, stable CSS token, plain-language meaning, world label/color, non-color icon/shape cue, and accessible text. Recovery rarity, ground-loot rarity, gear-depth rarity, and profile item rarity now derive from the shared `ItemRarity` type instead of maintaining duplicate unions.
  - Ground-loot labels/colors resolve through the contract, equipment sorting uses the shared rank, and the Build equipment surface exposes a responsive rarity guide plus shape cues on equipped cards, storage cards, and the inspector so rarity is not color-only.
  - Regression locks the exact Field → Refined → Prototype → Singular order, rank parity, unique tokens/icons/shapes, accessible descriptions, CSS token behavior, ground-loot presentation routing, and shared type ownership across loot/gear/profile systems.
  - Verified on PR head `19662b466aa272450004a8be0f5683094f2fee92`: Browser E2E `35561188093` passed desktop and mobile-landscape including the full regression/production build and browser player journeys.
  - Verified on merged gameplay source `0486cf45b17f2cd45bcb3d88385cd78e5c32b998`: Browser E2E `35561313627`, Level 15 beta smoke `35561313621`, and Android beta.211 `35561313599` all passed. Android verification includes package/version/SDK/signature checks plus native emulator install/launch/runtime smoke. Artifact `10622107759` contains the debug-signed APK with SHA-256 `d42b0e563f2c8ebf1d3ff2a5dca5fdd7dea7b69d994e68ac11f335e0a2af1339`.
  - **Next: P7-B — World loot.**

- [x] **P7-B World loot** — rarity is readable in the combat space through contract-owned color, icon, four distinct silhouettes, and a monotonic ring/beacon hierarchy instead of relying on color alone.
  - `groundLootPresentation` now derives world color/label/icon/shape plus marker, ring, beacon, and pickup-cue hierarchy from the shared P7-A rarity definition without changing drop odds, magnet radii, recovery quality, or reward balance.
  - Canvas fallback and Three.js both render Field diamond, Refined bar, Prototype hexagon, and Singular star language. The Three.js marker remains visible alongside authored recovery-capsule assets, while higher rarity increases marker/ring/beacon emphasis.
  - The nearest-drop HUD now reports screen-relative direction, range, monster level, and rarity icon/label. Mobile/coarse-pointer layouts retain the direction/range read while hiding only the longer recovery instruction.
  - Pickup completion now fires the existing `loot` / `rareLoot` audio cues and adds short distinct haptics for ordinary versus Prototype/Singular recoveries.
  - Regression coverage locks all four non-color world shapes, strictly increasing beacon/ring hierarchy, ordinary/high-value pickup cue mapping, Canvas/Three.js wiring, mobile HUD readability, and haptic treatment.
  - PR #130 merged as gameplay source `6b4530f4ab28aedc06f79d2a6b51e12ec78f9ad4`. The API-created PR did not receive a pull-request event run, so final validation was performed on the merged source rather than treating an unscheduled PR gate as evidence.
  - Verified on merged gameplay source `6b4530f4ab28aedc06f79d2a6b51e12ec78f9ad4`: Browser E2E `35562379185` passed desktop and mobile-landscape, Level 15 beta smoke `35562379166` passed the full regression/production build, and Android beta.212 `35562379132` passed package/version/SDK/signature checks plus emulator install, mobile touch/runtime smoke, lifecycle resume, authored-asset verification, and the Chapter 3 touch playthrough. Artifact `10622443302` contains the debug-signed APK with SHA-256 `c3e6b1b04956be261ad654b0900cb4969b78e9ff9e6db0b3f5ecd1557282c768`.
  - **Next: P7-C — Menu consistency.**

- [x] **P7-C Menu consistency** — equipped gear, ship storage, reconstruction/crafting, item comparison, contract reward previews, live combat pickup feed, and mission debrief now consume the same shared rarity wording instead of maintaining surface-specific labels.
  - Added canonical menu/feed labels from the P7-A rarity contract: `FIELD · BASELINE`, `REFINED · UPGRADED`, `PROTOTYPE · HIGH-END`, and `SINGULAR · RULE-CHANGER`. Build surfaces render the same non-color rarity shape/icon through a shared `RarityText` component.
  - Comparison rows now show current and candidate rarity with the same language; reconstruction lists, equipped slots, storage cards, inspector badges, debrief cards, reward rarity guidance, and combat pickup messages use the same formatter.
  - Legacy Build/debrief rarity colors were aligned to the contract-owned Field/Refined/Prototype/Singular palette without changing loot odds, item generation, recovery quality, or reward balance.
  - Existing Directive wording compatibility was preserved while adding the shared Singular descriptor. Regression coverage was updated to require the centralized formatter/icon path rather than stale local helpers.
  - PR #131 verification: Browser E2E run `35563502326` passed desktop and mobile-landscape including full regression/production build plus browser player journeys. Earlier CI attempts correctly exposed three stale/compatibility assertions; each was fixed before the green run.
  - Verified on merged gameplay source `d84fb598df17682499b48645bdc08b8fb7a0eeab`: Browser E2E `35563629622`, Level 15 beta smoke `35563629634`, and Android beta.213 `35563629631` all passed.
  - Android artifact `10623163424` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.213`, debug signing, and APK SHA-256 `ae391c5212cd32f939c01bb68ad0f74cdc01590c8b298f3ecd4331dacfcdf930`.
  - **Next: P7-D — Inspector/tools.**

- [x] **P7-D Inspector/tools** — the equipment inspector now exposes base identity, frame identity/generation, Recovery Level and Recovery Quality, frame quality, explicit modifier count/peak grade, Augment occupancy/access/compatibility, recovery source, and equip/class compatibility before the deep technical section.
  - Build-changing effects are called out explicitly: fixed Singular signatures, mechanical modifiers with grades, and active specialization gear-link candidates each receive a dedicated readable entry instead of being buried among generic modifiers.
  - Ship Storage search now indexes base IDs, source text, Recovery Level, generation, frame quality, modifier grades/descriptions, and Augment hardware/name/description.
  - Storage tooling now adds a rarity selector plus class-fit, augmented, and build-changing quick filters; sorting now includes rarity, top modifier grade, and Augments installed alongside existing quality/recovery/level/name ordering.
  - Storage cards expose Recovery Level, peak modifier grade, frame quality, and Augment occupancy for fast scanning. Reset actions clear query, quick filter, rarity filter, and sort together.
  - Responsive inspector telemetry uses a two-column identity grid that collapses to one column on narrow devices; compatibility states and build-changing panels remain visible without hover.
  - PR #132 did not receive a GitHub pull-request workflow event despite reopen/synchronize attempts, so completion uses merged-main gates rather than treating an absent check as evidence.
  - Verified on merged gameplay source `ca46720c37eee2adb568958e6b25d1a438546f0a`: Browser E2E `35564592351` passed desktop and mobile-landscape, Level 15 beta smoke `35564592312` passed, and Android beta.214 `35564592356` passed the full web regression/build, package/version/SDK/signature checks, emulator install/launch, mobile runtime/touch smoke, lifecycle resume, authored assets, and Chapter 3 mobile playthrough.
  - Android artifact `10624176006` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.214`, debug signing, and APK SHA-256 `117ccad83f8304d2962e5c0c1862979abcd9fac449faf46eca49c55941817555`.
  - **Next: P7-E — Singular + touch QA.**


- [x] **P7-E Singular + touch QA** — Singular equipment now has a premium, non-color-only identity and an always-visible fixed-rule read across equipped slots, Ship Storage, the full inspector, reconstruction, contract reward guidance, combat world-recovery guidance, and mission debrief.
  - Loadout/storage/crafting surfaces expose the fixed Singular rule directly instead of making Singular a stronger-colored normal card. The inspector leads with a dedicated RULE-CHANGER hero panel, while debrief cards preserve the signature effect before discard decisions.
  - Touch/coarse-pointer layouts expand fixed-rule callouts and preserve the existing single-scroller inspector escape path. Item meaning does not depend on hover/title data; exact Singular effects remain hidden before recovery while the combat radar identifies the drop as a chase recovery.
  - Regression coverage locks the Singular treatment across every item surface, the premium reward/world/debrief styling, and the no-hover-only item-data rule without changing loot odds, equipment balance, or reconstruction legality.
  - PR #133 Browser E2E `35565532206` passed desktop and mobile-landscape including the full regression/production build and browser player journeys.
  - Verified on merged gameplay source `78f98fd006b1292409fa1e92fa544e7fc15ec5c8`: Browser E2E `35565674528` passed desktop and mobile-landscape, Level 15 beta smoke `35565674581` passed, and Android beta.215 `35565674577` passed the full web regression/build, package/version/SDK/signature checks, emulator install/launch, mobile runtime/touch smoke, lifecycle resume, authored assets, and Chapter 3 mobile playthrough.
  - Android artifact `10624431236` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.215`, debug signing, and APK SHA-256 `b88e688f2ea4f69bcb70330ddc14c33d7c67784bd94017a95e5563caa195314d`.
  - **Next: P8-A — Target acquisition.**


## P8 — Targeting & Class Arsenal Identity

- [x] **P8-A Target acquisition** — FIRE and genuinely targeted skills now share one deterministic target-acquisition model before execution instead of each input path owning its own selection behavior.
  - Legal filtering rejects inactive, dead, and out-of-range hostiles. Scoring combines aim alignment, range, visibility, active threat state, existing mark state, boss priority, and protocol penalties; equal scores resolve through stable visibility/distance/id tie-breaks so array order does not change the result.
  - Assisted FIRE focuses the chosen hostile before spawning the projectile, while explicit pointer/right-stick/manual aim remains authoritative. Targeted skill execution routes through the same acquisition intent.
  - Mobility, self-centered, projected ground/directional, and non-targeted fan skills remain explicit exceptions. A follow-up touch-routing fix centralized the targeted-skill policy so touch ability buttons cannot pre-bias Rush/Shift/Well/Guard/Splitshot toward a hostile before simulation-level exception handling.
  - Deterministic gameplay regression covers legal filtering, LOS preference, mark/threat/boss weighting, stable tie resolution, focus-before-fire, manual aim preservation, targeted skill acquisition, explicit skill exceptions, and the GameCanvas touch-routing contract.
  - PR #134 Browser E2E `35598501139` passed desktop and mobile-landscape. PR #135 Browser E2E `35599336973` passed desktop; its first mobile live-location pass hit an unrelated transient Solar Yard telemetry-empty failure after combat/layout checks passed, then the targeted failed-job retry passed without a gameplay code change.
  - Verified on merged gameplay source `22efdce02b3d6d95efc08fa7beac63466f50ce5c`: Browser E2E `35599713378`, Level 15 beta smoke `35599713449`, and Android beta.217 `35599713483` all passed. Android verification includes full web regression/build, package/version/SDK/signature checks, native emulator install/launch/runtime smoke, lifecycle/touch QA, authored assets, and Chapter 3 playthrough.
  - Android artifact `10637979892` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.217`, debug signing, and APK SHA-256 `e8d9af5150c440e7072483e2d21d0dbf365bccb7b768a667f3fde16b6298d939`.
  - **Next: P8-B — Target control.**


- [x] **P8-B Target control** — assisted targeting now retains one authoritative hostile lock across touch FIRE and targeted skills instead of reevaluating a fresh winner at every execution point.
  - Added deterministic target-control memory for current target, acquisition time, and last-visible time. Near-equal challengers cannot cause rapid lock flicker, while materially higher-priority visible threats can still take over.
  - Brief LOS loss receives a bounded grace window; after that window an occluded hostile is released rather than being tracked indefinitely through cover. Dead and out-of-range hostiles invalidate immediately.
  - The retained target ID is passed into FIRE and targeted skill execution, so the action cannot silently reacquire a different enemy after the HUD lock has already settled.
  - Manual pointer/touch-drag and right-stick aim clear assisted lock state immediately. FIRE release, restart/transit, focus loss, and non-targeted ability paths also clear target-control memory.
  - P8-A exceptions remain intact: self-centered, mobility, projected ground/directional, and other non-targeted abilities do not inherit assisted target control.
  - Regression coverage locks stickiness, priority takeover, occlusion grace/expiry, death/range invalidation, manual reset, retained-target FIRE/skill execution, and the GameCanvas touch/manual override routing contract.
  - PR #137 Browser E2E `35601768142` passed desktop and mobile-landscape including the full deterministic regression suite, production build, and live player journeys.
  - Verified on merged gameplay source `0f3842a19542df286d3e996b52960fe72af6fa27`: Browser E2E `35601943572`, Level 15 beta smoke `35601943626`, and Android beta.218 `35601943603` all passed. Android verification includes full web regression/build, native project generation, package/version/SDK/signature checks, emulator install/launch/runtime smoke, touch/lifecycle coverage, authored assets, and Chapter 3 playthrough.
  - Android artifact `10639383799` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.218`, debug signing, and APK SHA-256 `e57e511355264caef61f8bd42250a11d082672ccb9873d1d28a146d1a7d65e88`.
  - **Next: P8-C — Target feedback/QA.**

- [x] **P8-C Target feedback/QA** — assisted target state now has a clear, accessible presentation layer and verified touch/controller behavior without changing the P8-A/P8-B selection rules.
  - Canvas and Three.js targeting presentation use a stronger ASSIST LOCK reticle/readout tied to the retained target ID. Reduced-effects mode freezes reticle pulse/rotation while preserving high-contrast target identity.
  - New lock feedback adds a short dedicated audio cue, optional phone vibration, and supported standard-gamepad rumble. Feedback fires on real acquisition/switch events instead of repeating every simulation frame.
  - A polite screen-reader live region announces target acquisition, manual-aim takeover, and release without turning continuously changing HP/armor values into live-region chatter.
  - Standard controller combat routing now covers left-stick movement, right-stick manual aim, RT assisted fire, A dodge, B weapon cycle, X interact, Y reload, and LB/RB/LT class abilities. Right-stick input remains authoritative and immediately clears assisted lock state.
  - Deterministic regression now locks the shared target-feedback helper, visible/readout target identity, target audio/haptics, controller acquisition/manual override, reduced-motion behavior, and accessibility hooks. Browser E2E adds live touch acquisition/release plus controller RT acquisition/right-stick override using an observable gamepad QA shim.
  - PR #139 Browser E2E `35606278955` passed desktop and mobile-landscape after a targeted UI-readability assertion update for the renamed assisted-lock readout.
  - Verified on merged gameplay source `b4a179c4d278159b3b90efc1c5feb5a14d7dcabc`: Browser E2E `35606519039`, Level 15 beta smoke `35606519086`, and Android beta.219 `35606519023` all passed.
  - Android verification includes full web regression/build, native project generation, package/version/SDK/signature checks, emulator install/launch/runtime smoke, touch controls, lifecycle resume, authored assets, and Chapter 3 touch playthrough. Artifact `10642866731` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.219`, debug signing, and APK SHA-256 `aab0c090167ac26f08fe76d0fb928a78008268d83b4187eca3fe67a135436e09`.
  - **Next: P8-D — Hard arsenal lock + migration.**

- [x] **P8-D Hard arsenal lock + migration** — each class now owns exactly one runtime armament family: Vanguard → Breacher, Vector → Rail Lance, Systems → Carbine.
  - Profile/save normalization equips only the active class family while preserving incompatible weapons in ship storage; if no usable class-family weapon exists, the matching starter is restored without deleting player inventory.
  - Class recalibration swaps the active family safely, off-class weapon equip attempts are rejected with compatibility feedback, and combat rejects direct or cycle-based cross-family selection.
  - Loadout presentation now shows one active class armament plus suit/rig/implant; desktop/mobile cross-family swap controls were removed and class intake copy now teaches weapon-family ownership.
  - Combat build derivation ignores malformed/off-class equipped weapon modifiers, so legacy or hand-edited profiles cannot leak incompatible weapon stats into runtime.
  - Regression coverage includes legacy multi-weapon migration, starter restoration, class switching, off-class equip rejection, runtime swap blocking, class resonance fixtures, UI ownership language, and class-specific beta smoke.
  - PR #141 Browser E2E `35612549638` passed desktop and mobile-landscape after updating legacy fixtures for owned-family combat.
  - Merged gameplay source `075b64fdb16e12ec9782bedeb8e249e0e392c528`; QA follow-up PR #142 updated Android runtime smoke to assert the removed weapon-cycle control is absent rather than tapping it.
  - Verified on QA source `f358602357dc4bd7410336ee485a5b6e224d11a7`: merged-main Browser E2E `35613944890`, Level 15 beta smoke `35613944913`, and Android beta.220 `35613944855` all passed.
  - Android artifact `10645323083` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.220`, debug signing, native emulator runtime/touch/asset/Chapter 3 QA, and APK SHA-256 `61cdeaa2331c955f678586f94f733ba94d50169801e87cc577b4414aa5f6d97e`.
  - **Next: P8-E — Loot/UI/tutorial ownership.**

- [x] **P8-E Loot/UI/tutorial ownership** — class ownership now governs the complete equipment-recovery and player-facing compatibility flow instead of only runtime equipping.
  - Ordinary contract recoveries, field drops, legacy victory rewards, boss Singulars, location chase Singulars, and Directive chase Singulars now restrict weapon outcomes to the active class family while keeping Combat Suit, Systems Rig, and Implant universal.
  - First-run onboarding rewards now teach the correct owned family: Vanguard receives Breacher, Vector receives Rail Lance, and Systems receives Carbine. Legacy off-class weapons remain preserved in ship storage for save safety but cannot be equipped.
  - The Build inspector, usable-now filter, equip action, class/progression language, and storage guidance now distinguish weapon ownership from gear resonance. A compact three-family tutorial explains Vanguard close-pressure Breacher play, Vector precision Rail play, and Systems sustained-control Carbine play.
  - Contract reward previews now disclose the active class-owned weapon family before deployment, and high-tier Directive chase previews filter candidate Singular names to items that the current class can actually receive.
  - Regression coverage exercises all three classes across onboarding, legacy victory rewards, repeated safe/deep recoveries, class-compatible premium rewards, Build compatibility/actions, contract reward guidance, and stale “no class lock” wording.
  - PR #143 Browser E2E `35616428796` passed desktop and mobile-landscape on exact head `3a88f7d8eb233b28512d14c8f40f22eaf1574449`, including the full deterministic regression suite, production build, and live player journeys.
  - Merged gameplay source `9ad0b9e40dc948a95c55dc05e8ee9c761c625e69`; merged-main Browser E2E `35616718020` and Level 15 beta smoke `35616717994` both passed.
  - Android beta.222 run `35616717976` passed full web regression/build, native Android generation, package/version/SDK/signature checks, installable debug APK assembly, native emulator install/runtime smoke, touch/lifecycle coverage, authored assets, and Chapter 3 mobile playthrough.
  - Android artifact `10647375675` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.222`, debug signing, and APK SHA-256 `57c7ca02ec66ef610f30e4dfa0e8088f7e8eb184b0af5f8424a676ca098f6b40`.
  - **Next: P8-F — Handling identity.**

- [x] **P8-F Handling identity** — the three class-owned weapon families now differ through a shared mechanical and presentation handling layer instead of relying mainly on damage/rate tuning.
  - A single `weaponHandlingProfiles` contract gives Carbine, Breacher, and Rail Lance unique mobile/breach/precision stances plus explicit 100-point mobility/control/recovery/thermal/impact budgets.
  - Simulation handling now differentiates shot momentum retention, recoil impulse, post-shot movement, reload movement/timing, and vent movement/timing while preserving the P8-D class-family lock.
  - Authored Three.js operators now use family-specific ready poses, recoil amplitudes, reload motions, vent motions, muzzle proportions, and camera response. The Canvas fallback reads the same profile for muzzle/camera behavior.
  - Phone vibration and supported controller rumble are family-specific, so Carbine reads light/continuous, Breacher reads heavy/close-pressure, and Rail reads planted/high-impact.
  - Deterministic gameplay coverage validates all handling budgets, reload/vent timing, and post-shot movement separation; UI/source regression guards the renderer, fallback, haptics, and new vent animation telemetry.
  - PR #145 final Browser E2E `35621771872` passed desktop and mobile-landscape on exact head `8a26368ce123ba1c31da3a40bd2eb6b23cf1dd73`; gameplay merged as `f7ccfc8f4d877abdacd399da2eaa9e35a0101b57`.
  - The first merged Android run exposed a QA false-negative: the emulator reclaimed the app process after HOME even though runtime/touch/authored-asset checks had passed. PR #146 changed the lifecycle gate to report preserved vs OS-reclaimed process mode while still requiring restored combat renderer, touch controls, and valid render-budget telemetry.
  - Final QA source `a871520223ad3e71d8f22f2d2636024a353d3e75`: merged-main Browser E2E `35627586557`, Level 15 beta smoke `35627586625`, and Android beta.224 `35627586668` all passed.
  - Android beta.224 verified full web regression/build, native project generation, package/version/SDK/signature checks, installable debug APK assembly, emulator install/runtime/touch/lifecycle recovery, authored operator/enemy/weapon/environment assets, and Chapter 3 mobile playthrough. Lifecycle verification reported `process=preserved` with the balanced mobile render budget restored.
  - Android artifact `10652799934` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.224`, debug signing, and APK SHA-256 `f6afeb0ae0add10d9dfab2090eb8ba8b595ed041254b3837adc2bbfb6279223c`.
  - **Next: P8-G — Class-owned skill migration.**

- [x] **P8-G Class-owned skill migration** — all three class kits now explicitly belong to the class-owned armament family and can inherit family-level build influence without binding a skill to a specific weapon item ID.
  - Vanguard skills bind to Breacher, Vector skills to Rail Lance, and Systems skills to Carbine through the shared class-skill metadata contract; runtime ability configuration verifies the active family before applying family tuning.
  - The equipped owned-family weapon contributes bounded class-skill power, range, control, armor pressure, recovery, cost, and chain influence from frame generation/identity, Equipment Quality, relevant affixes, and Singular status. Stowed or off-family weapon state cannot tune class skills.
  - Selected Network nodes now influence the same family-skill layer for armor work, recoil/vector control, signal compression, quick-vent recovery, and predictive lead without creating a second per-item skill-binding system.
  - Shared skill mechanics were migrated off weapon-specific assumptions: redirected projectiles use the active class family, and Execution Trace now consumes marked targets through the class-owned armament rather than being Rail-only.
  - Deterministic gameplay coverage exercises all three classes, owned-family metadata, frame/affix/Singular tuning sources, off-family isolation, runtime family binding, and family-aware Execution Trace behavior. Source/UI regression guards the family contract and prevents item-ID binding from returning.
  - PR #148 final Browser E2E `35630094749` passed desktop and mobile-landscape on exact head `e0a364a7d28ca1d296df06ebce8a4de9aa226ca5`, including the full deterministic regression suite, production build, and live player journeys.
  - Merged gameplay source `266bb5072adbd1140b3c944ebc6612c3d3102b9c`; merged-main Browser E2E `35630330974` and Level 15 beta smoke `35630331136` both passed.
  - Android beta.225 run `35630331086` passed full web regression/build, native Android generation, package/version/SDK/signature checks, installable debug APK assembly, native emulator install/runtime/touch/lifecycle smoke, authored operator/enemy/weapon/environment assets, and Chapter 3 mobile playthrough.
  - Android artifact `10654129177` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.225`, debug signing, and APK SHA-256 `a43733c42a6047b10fbb5bfb8c69b0c0ad7b6b7806d5b737abb4408b288d4495`.
  - **Next: P8-H — Skill UI + regression.**

- [x] **P8-H Skill UI + regression** — Build → Skills now teaches and exposes the complete class-owned skill hierarchy instead of mixing shared Lenses and class Evolutions into one flat option list.
  - The Skills surface reads in a fixed order: **Class Skill → Weapon Family → Lens/Evolution → Specialization/Capstone**. Each of the three active class skills shows the owned weapon family, equipped family frame, current family-influence source count, selected modifier state, and live specialization/capstone relationship.
  - Standard behavior, Shared Lenses, and LV16 Class Evolutions are visually separated, while existing class-skill and weapon SVG assets provide fast mobile parsing without adding a new asset family.
  - The UI consumes the same P8-G derived family state used by combat. It does not create a new per-item binding path, and deterministic QA hooks expose each skill slot/modifier for touch/runtime validation.
  - Coarse-pointer and mobile-landscape styling keeps the four-stage hierarchy readable, prevents horizontal overflow, and gives selectable skill options at least 52px touch height.
  - Gameplay regression now round-trips Vanguard, Vector, and Systems through class, owned equipment family, LV15 specialization, LV16 overclock, class Evolution, capstone pairing, atomic save/load, campaign state, ship bonuses, and runtime family binding. The persistence fixture is isolated from the existing asynchronous save-recovery suite.
  - Browser runtime QA opens Equipment → Skills before deployment and verifies four hierarchy stages, three skill cards, option density, no horizontal overflow, and the normal return-to-contract flow. Native Android QA additionally touch-selects Revector Lens, verifies live hierarchy state, restores Standard, then continues through the normal combat/lifecycle/Chapter 3 run.
  - PR #150 final Browser E2E `35636084315` passed desktop and mobile-landscape on exact head `996f6d6dadf383ac989a4c1c9c45587c1827825c`, including the full deterministic regression suite, production build, and live player journeys.
  - Merged gameplay/UI source `bbad384d53a741d7832342a9efb35bc8906d8a82`; merged-main Browser E2E `35636320051` and Level 15 beta smoke `35636320062` both passed.
  - Android beta.226 run `35636320018` passed full web regression/build, package/version/SDK/signature checks, installable debug APK assembly, the new native touch skill-hierarchy journey, combat runtime/touch smoke, authored operator/enemy/weapon/environment assets, lifecycle recovery, and Chapter 3 mobile playthrough.
  - Android artifact `10656103751` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.226`, debug signing, and APK SHA-256 `9490c12dc6f551103f029d8d2597b434dcff3eef92462a0fdd67ad4c133de884`.
  - **Next: P8.5-A — Gear architecture audit + target schema.**

## P0 — Foundation ✅ COMPLETE

- [x] Three classes: Vanguard / Vector / Systems
- [x] Unique LV1 class skill kits
- [x] Class-specific gameplay mechanics
- [x] Class selection/onboarding
- [x] Class-specific mobile assets
- [x] Gear resonance
- [x] LV15 specializations
- [x] LV16 specialization overclocks
- [x] Network/passive progression
- [x] Reconstruction/crafting
- [x] Faction gear
- [x] Singular chase loot
- [x] T1–T12 Directives
- [x] Elite protocols
- [x] Environmental events
- [x] Multi-stage megastructures
- [x] Mobile combat/UI pass
- [x] Authored combat models
- [x] Authored loot/interactables
- [x] Browser + Android automated QA

## P1 — Chapter 3: LV15–18 Campaign ✅ COMPLETE

### Chapter Foundation

- [x] **P1.1** Define Chapter 3 story premise — **Parallax Debt**
- [x] **P1.2** Create one completely new location — **Cislunar Parallax Array**
- [x] **P1.3** Create unique environmental gameplay mechanic — **Reference Shear / shifting gravity**
- [x] **P1.4** Create bespoke mobile-friendly Parallax environment GLB assets
  - [x] Baseline pylons
  - [x] Reference frames
  - [x] Mass carriages
  - [x] Shear anchors
  - [x] Reference consoles
  - [x] Mobile LOD1/LOD2 coverage
  - [x] Runtime integration with Chapter 3 objective geometry
  - [x] Procedural fallback
  - [x] Graphics/content regression coverage
- [x] **P1.5** Add unique environment props/interactables — baseline frames, pylons, mass carriages, reference machinery

### Missions

- [x] **P1.6** Add new mission objective — **Reference Alignment**
- [x] Add three-pylon physical alignment loop
- [x] Add Parallax Debt opening sequence
  - [x] Baseline Zero
  - [x] Return Vector
  - [x] Blind Meridian
- [x] Expand Chapter 3 beyond the opening sequence toward full LV15–18 progression
  - [x] LV16 — Kepler Wake
  - [x] LV16 — Ledger of Least Action
  - [x] LV16 — Residual Frame
  - [x] LV17 — Null Transit
  - [x] LV17 — Counterfactual Burn
  - [x] LV18 — False Horizon
  - [x] Explicit LV16/LV17/LV18 progression gates
  - [x] T9 → T12 Chapter 3 encounter scaling
  - [x] Legacy three-contract completion migration
  - [x] Final decision branch + final three Chapter 3 operations
    - [x] Expose route — Common Reference → Witness Transit → Released Vector
    - [x] Keep route dark — Dark Baseline → Ghost Transit → Private Vector

### Enemies

- [x] **P1.7** Add 2–3 new enemy variants
  - [x] Parallax Shear Runner
  - [x] Reference Shear Technician
  - [x] Long-Baseline Marksman
- [x] **P1.8** Add explicit class-specific counters/interactions for Chapter 3 enemies
  - [x] Review P1.17 specialization mechanics first and avoid duplicating specialization-specific interactions
  - [x] Add clear Vanguard-specific enemy counterplay
  - [x] Add clear Vector-specific enemy counterplay
  - [x] Add clear Systems-specific enemy counterplay
  - [x] Add deterministic regression coverage for all three class interactions

### Boss

- [x] **P1.9** Add major multi-phase boss — **Baseline Keeper Sera Nox**
- [x] **P1.10** Add boss arena mechanics
  - [x] Baseline Fork
  - [x] Parallax Sweep
  - [x] Shear Collapse
  - [x] Phase-two gravity reconfiguration
- [x] Add further boss tuning after Chapter 3 playtest

### Narrative / Choice

- [x] **P1.11** Add meaningful campaign decision/branch
  - [x] Expose the route — independent witnesses, Meridian reputation, disrupted support stack
  - [x] Keep the route dark — Long Arc reputation, preserved covert route access
- [x] **P1.12** Add evidence/intel progression
  - [x] Baseline Offset
  - [x] Return Vector
  - [x] Blind Meridian
  - [x] Kepler Wake
  - [x] Service Ledger
  - [x] Residual Frame
  - [x] Null Transit
  - [x] Counterfactual Burn
  - [x] False Horizon
- [x] Expand full Intel UI presentation for Parallax Debt

### Loot

- [x] **P1.13** Add at least 3 boss-specific Singulars
  - [x] Nox Parallax R-7
  - [x] Baseline Debt Rig
  - [x] Blind Meridian Link
- [x] **P1.14** Add 4–6 Parallax location chase Singulars
- [x] **P1.15** Add new normal/Prototype Chapter 3 gear identities where useful
  - [x] Six Parallax Debt slot identities across weapons, suit, rig, and implant
  - [x] Prototype signature-affix identity on Chapter 3 recoveries
  - [x] Chapter-scoped recovery routing without leaking into shared locations
  - [x] Loot regression coverage

### Progression / Builds

- [x] **P1.16** Tune XP progression across LV15–18
  - [x] Authored safe-extraction XP floors carry the 12-operation campaign through the LV16/LV17/LV18 gates without unrelated side-contract grinding
  - [x] LV18 closing operations continue meaningful progression instead of dropping back to generic recovery pacing
  - [x] Chapter-specific reward multipliers rise with late-campaign pressure while deep extraction can still exceed the XP floor
  - [x] Authored encounter patterns/reserve counts survive operation scaling; late operations add explicit threat-budget pressure
- [x] **P1.17** Make specializations materially affect Chapter 3 encounters
  - [x] Pressure Diver converts hostile reference shear into vacuum wakes that disrupt Parallax specialists
  - [x] Momentum Broker recovers additional recoil energy inside live reference fields
  - [x] Grid Weaver collapses nearby reference shear through machinery-routed Arc
  - [x] Survey Deadeye gains stronger precision interruption against Parallax reference enemies
  - [x] Redline Pilot overclock dodges punch through nearby shear fields
  - [x] Breach Vanguard armor breaks suppress Parallax specialist hardware
  - [x] Capacitor Conductor three-link cycles short nearby reference fields and disrupt reference enemies
- [x] Campaign progression unlocks at LV15 after Interdiction
- [x] Chapter 3 continuation is level-gated at LV16, LV17, and LV18
- [x] Existing saves migrate safely into expanded Parallax Debt state

### UI / Integration

- [x] Contract-board integration
- [x] Debrief integration
- [x] Campaign status integration
- [x] Dedicated Chapter 3 campaign progress card with level-gate/readiness state
- [x] **P1.18** Finish dedicated Intel/campaign presentation
  - [x] LV15–18 phase timeline with current/gated/banked operation states
  - [x] Evidence-bank count and readable physical findings
  - [x] False Horizon route decision and closing-branch presentation
  - [x] Explicit unresolved-evidence boundary
  - [x] Mobile-landscape responsive coverage
  - [x] Gameplay/UI regression coverage keeps dossier metadata synchronized

### QA

- [x] **P1.19** Progression/save migration regression coverage
- [x] Navigation/pathfinding coverage for Parallax Array
- [x] Full production regression/build green
- [x] Desktop Browser E2E green
- [x] Mobile-landscape Browser E2E green
- [x] Android APK package/version/signature verification
- [x] Android emulator runtime smoke
- [x] **P1.20** Dedicated full Chapter 3 browser/mobile campaign playthrough
- [x] **P1.21** Full Chapter 3 Android hands-on playtest
  - [x] Packaged APK Chapter 3 LV15–18 checkpoint coverage in the native Android WebView
  - [x] Touch-driven Intel, contract-open, and False Horizon route-decision interaction
  - [x] Both Chapter 3 completion branches verified at mobile-landscape viewport width
  - [x] Android Chapter 3 screenshot/report retained with the APK QA artifact
- [x] **P1.22** Tune rewards, boss difficulty, enemy pressure, and completion pacing
  - [x] Smooth Chapter 3 pressure bonuses across all 12 operations while preserving T9 → T12 escalation
  - [x] Split boss durability by campaign role: Blind Meridian opening finale vs. true Chapter 3 closing finale
  - [x] Increase late-operation/finale material premiums while preserving the proven LV16/LV17/LV18 XP gates
  - [x] Exercise scaled rewards/pressure and boss budgets in the dedicated two-route Chapter 3 regression
  - [x] Re-verify desktop/mobile browser E2E and packaged Android beta.134 emulator/Chapter 3 touch QA

### P1 Completion Gate

- [x] Substantial LV15–18 campaign sequence
- [x] Visually distinct new location foundation
- [x] New mission mechanic
- [x] New enemy roster
- [x] Major boss
- [x] New build-defining Singular loot
- [x] Bespoke authored Parallax environment assets
- [x] Campaign branch/choice
- [x] Final three Chapter 3 operations
- [x] Full LV15–18 progression/balance pass
- [x] Complete Chapter 3 playtest

## P2 — Authored Biomes Pack I ✅ COMPLETE

### Spin Habitat
- [x] P2.1 Unique environment kit
- [x] P2.2 Rotating habitat architecture
- [x] P2.3 Rim / spoke / axis visual differences
- [x] P2.4 Spindown VFX
- [x] P2.5 Machinery/interactables
- [x] P2.6 Local enemy visual identity
- [x] P2.7 Sable Voss presentation
- [x] P2.8 Biome ambient effects
- [x] P2.9 Mobile LOD/performance

### Jovian Harvester
- [x] P2.10 Environment kit
- [x] P2.11 Gas-harvester machinery
- [x] P2.12 Storm/pressure visual language
- [x] P2.13 Pressure props/interactables
- [x] P2.14 Stormline Foreman presentation
- [x] P2.15 Atmospheric effects
- [x] P2.16 Mobile LOD/performance

**Gate:** recognizable from screenshots without HUD text.

## P3 — Authored Biomes Pack II ✅ COMPLETE

### Ice Mine
- [x] P3.1 Assets
- [x] P3.2 Bore/tunnel geometry
- [x] P3.3 Brittle support destruction
- [x] P3.4 Cryogenic machinery
- [x] P3.5 Collapse/fracture effects
- [x] P3.6 Rhea Kade presentation

### Solar Yard
- [x] P3.7 Assets
- [x] P3.8 Fabrication machinery
- [x] P3.9 Sun/shadow identity
- [x] P3.10 Thermal shutters
- [x] P3.11 Cranes/rails/motion
- [x] P3.12 HELIOS-9 presentation
- [x] P3.13 Mobile optimization

## P4 — Megastructure Capstone Pass ✅ COMPLETE

- [x] P4.1 Perseid generation-ship continuity layer
- [x] P4.2 Perseid stage-specific encounter/event identity
- [x] P4.3 Perseid Steward Core finale
- [x] P4.4 Perseid adaptive render/regression coverage
- [x] P4.5 K-91 counterweight continuity layer
- [x] P4.6 K-91 stage-specific encounter/event identity
- [x] P4.7 K-91 bossless Ballast Vault traverse finale
- [x] P4.8 K-91 adaptive render/regression coverage
- [x] P4.9 Orpheline hidden-habitat continuity layer
- [x] P4.10 Orpheline stage-specific encounter/event identity
- [x] P4.11 Orpheline Habitat Warden finale + adaptive render/regression coverage
- [x] P4.12 Hecate shipbreaking-yard continuity layer
- [x] P4.13 Hecate stage-specific encounter/event identity
- [x] P4.14 Hecate Yardmaster Null finale + adaptive render/regression coverage
- [x] P4.15 Stage transitions
- [x] P4.16 Environmental continuity
- [x] P4.17 Debrief improvements
- [x] P4.18 Mobile performance

## P5 — Class Capstones ✅ COMPLETE

- [x] P5.1 Vanguard third specialization
- [x] P5.2 Vanguard skill evolution
- [x] P5.3 Vanguard capstone interactions
- [x] P5.4 Deepen Vector specializations
- [x] P5.5 Vector skill evolutions
- [x] P5.6 Systems third specialization
- [x] P5.7 Systems skill evolution
- [x] P5.8 Systems capstone interactions
- [x] P5.9 Same-class builds feel different at LV16+
- [x] P5.10 Specialization gear synergies
- [x] P5.11 Visual combat feedback
- [x] P5.12 Regression coverage
- [x] P5.13 Mobile playtesting

## Historical Delivery Notes

**P6.3 delivered:** T9+ elite-led encounters now add a deterministic whole-enemy mutation layer on top of protocol packages without consuming the separate boss/Command Target mutation work. Six authored mutations are available across T9–T12: **Reinforced Core**, **Ablative Mantle**, **Hunter Servo**, **Redline Bus**, **Countermass Rig**, and **Relay Reflex**. Mutations consume an explicit reserved threat budget that scales from 2 points at T9 to 8 at T12, remain restricted to elite/enhanced non-boss enemies, and materially change durability, armor, mobility, firing cadence, or hazard/protocol cadence. Tactical Forecast discloses the legal mutation pool before deployment, the combat HUD shows compact mutation tags, and deterministic regression covers the T8 gate, T9/T11 budget caps, boss exclusion, repeatable assignment, runtime stat/cadence effects, and UI visibility. PR Browser E2E run `35553253160` passed desktop/mobile-landscape full regression, production build, the 349.9 KiB boot-bundle gate, player-journey QA, and the Chapter 3 browser playthrough. Merged-main Browser E2E run `35553418993` and Level 15 beta smoke run `35553418968` passed; Android beta.204 run `35553418964` passed the full web regression/build, package/version/SDK/signature verification, native emulator install/launch/resume smoke, and the two-route Chapter 3 Android touch playthrough. Artifact `10619296967` is debug-signed with APK SHA-256 `5c47a13db9815fddee05e9e1744f7403cdc3e44f3146f181624d11bce8e2b5f9`. **P6.4 — Boss phase mutations is next.**

**P6.2 delivered:** T10+ elite protocols now resolve every enhanced roll into one of 15 deterministic, authored variants instead of a generic stronger flag: **Ablative Bloom**, **Cutline Pair**, **Twin-Well Lock**, **Anchor Singularity**, **Wake Anchor**, **Cascade Grid**, **Overlink Mesh**, **Dual Rack**, **Cross-Shutter**, **Capacitor Scramble**, **Coolant Redline**, **Tech Bus Sync**, **Cross-Fan Volley**, **Mass Theft**, and **Hard Lock Grid**. Each variant preserves the existing high-tier mechanical upgrade and +1 threat/reward premium, remains locked below T10, uses the existing 24% T10–T11 / 42% T12 enhanced cadence, and coexists with P6.1 exclusive protocol packages. Combat labels now show compact variant identities, Tactical Forecast names legal variants before deployment, and presentation metadata is lazy-loaded so the existing client boot-size budget remains intact. Deterministic regression covers the T9 gate, T10/T12 cadence, variant/protocol integrity, retained threat/reward accounting, representative runtime mechanics, and UI visibility. PR Browser E2E run `35551169484` passed desktop/mobile-landscape full regression, production build, boot-bundle budget, and player-journey QA. **P6.3 — T9+ mutations is next.**

**P6.1 delivered:** T9+ elite packaging now uses seven deterministic, named high-tier combinations instead of only protocol-by-protocol assembly: **Breach Lock**, **Mass Pursuit**, **Fortress Mesh**, **Recovery Lockdown**, **Kill Corridor**, **Arc Blackout**, and **Vacuum Hunt**. Packages obey existing location/objective eligibility and Directive protocol bias, remain atomic under the threat budget, and can intentionally authorize combinations that normal family de-duplication forbids (notably Recovery Lockdown's Salvage Interdictor + Recovery Denial pairing). Contract Tactical Forecast shows legal package names before deployment, combat labels show the compact package identity above the enemy, and deterministic regression covers the T9 gate, package selection, same-family authorization, forecast visibility, and all-or-nothing threat-budget acceptance. PR Browser E2E run `35549802656` and merged-main Browser E2E run `35549914024` passed desktop/mobile-landscape full regression, production build, and player-journey QA; Level 15 beta smoke run `35549914124` passed; Android beta.202 run `35549914181` passed web regression/build, package/version/SDK/signature verification, native emulator install/launch/resume smoke, Android touch/runtime QA, and the Chapter 3 two-route touch playthrough. **P6.2 — Enhanced protocol variants is next.**

**P5.11–P5.13 delivered:** the LV16+ class capstones now have distinct world-space combat language instead of sharing generic ability pulses. **Vanguard** capstones use a warm, braced shock-ring cue; **Vector** capstones use an elongated blue vector-sweep cue; **Systems** capstones use a violet rotating mesh pulse. The cues are emitted directly from all nine authored capstone interactions — Void Ram, Breach Cascade, Counterfort, Inertial Dividend, Reference Solution, Redline Needle, Induction Sink, Recursive Bus, and Mesh Reflux — without changing balance values or save data. Deterministic gameplay regression verifies all nine trigger paths, graphics regression locks the class-coded renderer contract and QA telemetry, PR Browser E2E run `35549019565` passed desktop/mobile-landscape full regression, production build, and player-journey QA, merged-main Browser E2E run `35549143093` passed both targets, and Level 15 beta smoke run `35549143109` passed. Android beta.201 run `35549143095` passed web regression/build, package/version/SDK/signature verification, native emulator install/launch/resume smoke, Android touch/runtime QA, and the Chapter 3 two-route touch playthrough; artifact `10617593551` was verified as debug-signed with APK SHA-256 `ab92800ca26af249bcba803b5c3e9b8f465c7c7ed3af4c16c4c121f85971e984`. **P5 is complete; P6.1 — Exclusive protocol combinations is next.**

**P5.10 delivered:** every LV15 specialization now has one explicit gear link that activates from **Tier I class resonance plus a matching existing affix**, so specialization identity changes what recovered gear is worth without adding a parallel loot currency or class-locked equipment. Vanguard links are **Pressure Recirculator** (Pressure Diver + Layered vacuum seal), **Breach Stack** (Breach Vanguard + Tungsten penetrator stack), and **Counterfort Bracing** (Bulkhead Warden + Countermass buffer). Vector links are **Reaction Ledger** (Momentum Broker + Vector servo weave), **Survey Ballistics** (Survey Deadeye + Shear-map optics), and **Thermal Slip** (Redline Pilot + Kinetic heat shunt). Systems links are **Mesh Orchestra** (Grid Weaver + Relay microdrone), **Bus Harmonics** (Capacitor Conductor + Capacitor recycler), and **Heat Exchange** (Thermal Shunter + Cryogenic return loop). Each link produces a specialization-specific combat/stat effect, participates in build identity, appears in the specialization panel and Stats, and marks linked candidate gear in the Equipment Bay. Deterministic regression covers activation for all nine links plus representative Vanguard/Vector/Systems mechanical effects. PR Browser E2E run `35547738454` and merged-main Browser E2E run `35547831993` passed desktop/mobile full regression, production build, and player-journey QA; Level 15 beta smoke run `35547832057` passed; Android beta.200 run `35547832105` passed web regression/build, package/version/SDK/signature verification, native emulator install/launch/resume smoke, Android touch/runtime QA, and the Chapter 3 two-route touch playthrough. **P5.11 — Visual combat feedback** is next.

**P5.9 delivered:** LV16+ Vector branches now form three explicit specialization/evolution doctrines so same-class builds have different resource loops, firing priorities, and recovery cadence instead of only different labels. **Inertial Dividend** links Momentum Broker + Slingshot Shift: the extended Slipstream converts recoil into a deeper Vector Shift/dodge recovery dividend plus extra capacitor return. **Reference Solution** links Survey Deadeye + Triangulation Lock: the lock holds a longer firing solution, opens a deeper Armor Breach, recycles Splitshot harder, and the marked Slipstream shot gains extra velocity, damage, penetration, and follow-up recovery. **Redline Needle** links Redline Pilot + Needle Fan: a 75%+ hot weapon bus overdrives the three-lane fan to higher velocity, damage, penetration, and armor pressure while venting heat and advancing dodge recovery. Build identity, Skills, and Stats surface the active doctrine through the shared capstone model, and deterministic gameplay/UI regressions cover all three pairings. PR Browser E2E run `35545564468` and merged-main Browser E2E run `35545672419` passed desktop/mobile full regression, production build, and player-journey QA; Level 15 beta smoke run `35545672492` passed; Android beta.199 run `35545672495` passed web regression/build, package/version/SDK/signature verification, native emulator install/launch/resume smoke, Android touch/runtime QA, and the Chapter 3 two-route touch playthrough. **P5.10 — Specialization gear synergies** is next.

**P5.8 delivered:** Systems specialization/evolution pairs now form three explicit LV16+ capstone loops. **Induction Sink** links Thermal Shunter + Anchor Lattice so a hot multi-node Polarity Well routes additional heat into a longer overcharged crossfire bank; the next shot gains extra velocity, damage, penetration, capacitor return, and overclock recovery beyond standard Thermal Crossfire. **Recursive Bus** links Capacitor Conductor + Recursive Intrusion so propagated hack relays return capacitor directly and the overclock cools the active weapon as the intrusion spreads. **Mesh Reflux** links Grid Weaver + Return Current so machinery-routed remote marks become conductive return nodes and recycle Relay Hack recovery. Skills/Stats surface the active capstone links, and deterministic gameplay/UI regressions cover all three paired behaviors. PR Browser E2E run `35543600968` and merged-main Browser E2E run `35543698281` passed desktop/mobile full regression, production build, and player-journey QA; Level 15 beta smoke run `35543698279` passed; Android beta.198 run `35543698272` passed web regression/build, package/version/SDK/signature verification, native emulator install/launch/resume smoke, Android touch/runtime QA, and the Chapter 3 two-route touch playthrough. **P5.9 — Same-class builds feel different at LV16+** is next.

**P5.7 delivered:** Systems now has three LV16 class skill evolutions in the existing Skill Lens slots. **Anchor Lattice** turns Polarity Well into a conductive clustering tool that recycles Relay Hack recovery per caught node, balanced by +18% Polarity Well cooldown. **Recursive Intrusion** extends Relay Hack through one additional hostile, leaves propagated relays conductive, and advances Cascade Arc recovery, balanced by +18% Relay Hack capacitor cost. **Return Current** converts Cascade Arc network contacts into capped capacitor return and Polarity Well recovery, balanced by +20% Cascade Arc cooldown. Class/LV16 gating, class-switch cleanup, tradeoffs, network propagation, recovery routing, capacitor return, build-stat visibility, and explicit combat feedback are covered by deterministic regression. PR desktop/mobile Browser E2E and merged-main desktop/mobile Browser E2E both passed full regression, production build, and player-journey QA; merged-main Level 15 beta smoke passed; Android beta.197 passed package/version/SDK/signature verification, native emulator smoke, touch/runtime QA, and the Chapter 3 two-route touch playthrough. **P5.8 — Systems capstone interactions** is next.

**P5.6 delivered:** Systems now has a third LV15 specialization, **Thermal Shunter**, alongside Grid Weaver and Capacitor Conductor. Thermal Shunter creates a weapon/ability weaving loop: casting a Systems ability with at least 35% active-weapon heat shunts 8% heat (10% with the LV16 overclock) into a short crossfire bank; the next weapon shot gains 12% projectile velocity, 10% damage, +10 penetration, and returns 4 capacitor. The LV16 overclock extends the bank to 3 seconds, advances the ability that armed it by 0.5 seconds on discharge, and sheds another 5% weapon heat, balanced by +10% weapon heat per shot. The base specialization trades 10 maximum armor. Deterministic gameplay regression covers hot-vs-cold arming, heat routing, projectile bonuses, capacitor return, one-shot bank consumption, cooldown recycling, combat feedback, and both tradeoffs; UI regression verifies the third Systems path is sourced through the shared specialization metadata. Merged-main desktop/mobile Browser E2E, Level 15 beta smoke, Android beta.196 package/version/SDK/signature verification, native emulator install/launch/resume smoke, Android touch/runtime smoke, and Chapter 3 touch playthrough all passed. **P5.7 — Systems skill evolution** is next.

**P5.5 delivered:** Vector now has three LV16 class skill evolutions in the existing Skill Lens slots. **Slingshot Shift** turns Vector Shift into a longer route with an extended Slipstream bank and partial dodge recovery, balanced by +18% capacitor cost. **Triangulation Lock** opens a short Armor Breach firing window and advances Splitshot recovery, balanced by +18% Deadeye Lock cooldown. **Needle Fan** compresses Splitshot into a tighter 1,700-speed fan with +20 penetration and a reinforced center lane, balanced by +20% Splitshot cooldown. Class/LV16 gating, class-switch cleanup, build-stat visibility, tradeoffs, ballistic behavior, recovery routing, and explicit combat feedback are covered by deterministic regression. PR full regression/production build and browser player journey passed on both desktop and mobile-landscape in Browser E2E run `35539490995`. Merged-main desktop/mobile Browser E2E, Level 15 beta smoke, Android beta.195 package/version/SDK/signature verification, native emulator install/launch/resume smoke, Android touch/runtime smoke, and the Chapter 3 touch playthrough all passed. **P5.6 — Systems third specialization** is next.

**P5.4 delivered:** Vector specializations now branch into three materially different combat loops instead of sharing the same Slipstream cadence. **Momentum Broker** turns a Slipstream shot's recovered recoil into Vector Shift and dodge cooldown recycling while retaining its capped capacitor return. **Survey Deadeye** now converts a marked Rail precision trace into a fresh Slipstream follow-through window, with the LV16 overclock pulling Deadeye Lock toward a 1.6 second recovery target. **Redline Pilot** now cashes 75%+ weapon heat into a hot Slipstream shot with extra projectile velocity, damage, and penetration; the overclock also vents a small amount of heat and recycles dodge recovery after the shot. Specialization copy now explains these loops, and deterministic gameplay regression covers each branch's distinct state/recovery/ballistic behavior and combat feedback. PR full regression/production build passed on both Browser E2E runners; a transient desktop Solar Yard telemetry miss passed on the targeted retry. Merged-main desktop/mobile Browser E2E, Level 15 beta smoke, Android beta.194 package/version/SDK/signature verification, native emulator install/launch/resume smoke, Android touch/runtime smoke, and Chapter 3 touch playthrough all passed. **P5.5 — Vector skill evolutions** is next.

**P5.3 delivered:** Vanguard specializations now form three explicit LV16+ capstone loops with the new skill evolutions. **Void Ram** links Pressure Diver + Siege Ram: ram contacts gain vacuum pressure, seed a player-owned vacuum wake at the breach line, and shed vacuum exposure. **Breach Cascade** links Breach Vanguard + Faultline Tag: both fracture targets take deeper armor stripping, armor breaks feed Breach Guard, and the LV16 overclock repairs armor from those breaks. **Counterfort** links Bulkhead Warden + Reprisal Pulse: reprisal contacts reinforce Breach Guard, add extra armor repair, and the LV16 overclock recycles capacitor. The Skills screen calls out active capstone links, the stats summary surfaces the active capstone, and deterministic gameplay/UI regressions prove the paired behavior rather than merely checking that both components are equipped. PR desktop/mobile Browser E2E, merged-main desktop/mobile Browser E2E, Level 15 beta smoke, Android beta.193 package/version/SDK/signature verification, native emulator install/launch smoke, and Android touch/runtime smoke all passed. **P5.4 — Deepen Vector specializations** is next.

**P5.2 delivered:** Vanguard now has three LV16 class skill evolutions in the existing Skill Lens slots. **Siege Ram** turns Breach Rush into an armor-cracking ram line that opens Armor Breach and feeds Breach Guard time, balanced by +20% Breach Rush cooldown. **Faultline Tag** relays Fracture Tag into a nearby secondary hostile to create a two-target Breacher lane, balanced by +18% Fracture Tag capacitor cost. **Reprisal Pulse** re-strikes already-breached Bulwark Pulse contacts and advances Breach Rush recovery per reprisal contact, balanced by +18% Bulwark Pulse cooldown. Evolutions are Vanguard-only, remain locked before LV16, share the existing per-skill selection slots with common Lenses, and are cleared safely when switching to an incompatible class while shared Lenses remain intact. Build UI exposes only class-compatible evolutions with unlock state, and player stats now report the actual class skill kit rather than generic MAG/MARK/ARC values. Deterministic gameplay regression covers level/class gating, all three tradeoffs, armor/guard/relay/recovery behavior, combat feedback, and class-switch cleanup. PR desktop/mobile Browser E2E, merged-main desktop/mobile Browser E2E, Level 15 beta smoke, Android beta.192 package/version/SDK/signature verification, native emulator install/launch smoke, and Android touch/runtime smoke all passed. **P5.3 — Vanguard capstone interactions** is next.

**P5.1 delivered:** Vanguard now has a third LV15 specialization, **Bulkhead Warden**, alongside Pressure Diver and Breach Vanguard. Bulkhead Warden turns Breach Guard into a defensive impact-recycling loop: guarded blockable damage receives additional mitigation and advances Bulwark Pulse recovery, while the LV16 overclock also returns capped capacitor from the absorbed impact. Bulwark Pulse repairs armor for each nearby contact and extends the Warden guard window, with an 8% direct weapon-output tradeoff and a +10% overclocked Bulwark capacitor-cost tradeoff. Deterministic gameplay regression covers mitigation, cooldown recycling, capacitor return, armor repair, extended guard duration, combat feedback, and both tradeoffs. PR desktop/mobile Browser E2E, merged-main desktop/mobile Browser E2E, Level 15 beta smoke, Android beta.191 package/version/SDK/signature verification, native emulator install/launch smoke, and Android touch smoke all passed.

**P4.18 delivered:** Megastructure mobile rendering now batches repeated Perseid ribs/guide lights, K-91 rails/inertial datum, Orpheline rock/utility continuity, and Hecate truss/clamp/cutter continuity through shared Three.js instanced draws instead of one mesh per repeated element. The existing mobile/performance profiles still preserve each capstone silhouette while trimming repeated density, and capstone overlays now stop receiving structural shadows whenever those profiles disable structural shadowing. Runtime QA exposes `instanced-continuity` batching plus per-family continuity draw-call ceilings (2 draws for Perseid/K-91, 4 for Orpheline, 5 for Hecate), and render-performance regression keeps both the visible mobile instance counts and the batching contract deterministic. P4 is complete; the next roadmap slice is P5.1 Vanguard third specialization.

**P4.17 delivered:** Megastructure debriefs now resolve the expedition as an authored after-action report instead of a single generic banked-progress sentence. Perseid, K-91, Orpheline, and Hecate show the secured/unreached four-space route, optional-recovery total, safe/deep extraction state, finale disposition, and the environmental continuity consequences observed along the secured path. The report distinguishes partial extraction, full safe traversal with an optional command zone left sealed, K-91’s bossless Ballast Vault resolution, and deep command-target defeat without adding new save state. The route recap collapses cleanly on narrow mobile surfaces, and deterministic gameplay regression covers all outcome classes plus the responsive presentation contract. The next capstone work is P4.18 Mobile performance.\n\n**P4.16 delivered:** Megastructure spaces now inherit authored physical consequences from the connected space instead of resetting every environment at the handoff. Perseid carries pressure debt, gravity trim loss, and cryogenic visibility deeper through the ship; K-91 carries capture debris, inertial drift, and lift-bus grid damage; Orpheline carries bore dust, improvised-grid faults, and ring momentum loss; Hecate carries clamp-release gravity instability, crusher-grid damage, and wreck-chain atmosphere loss. Inherited conditions are merged without duplication into the existing mission condition system, so the normal pressure, gravity, damaged-grid, visibility, and director hazard behavior remains the single source of gameplay truth. Contract previews expose the continuity explanation, and a dedicated regression validates condition inheritance plus live pressure/gravity/arc effects across all four capstones. The next capstone work is P4.17 Debrief improvements.

**P4.15 delivered:** Megastructure stage changes no longer jump instantly from one reused biome to the next. Every Perseid, K-91, Orpheline, and Hecate handoff now carries authored physical-route metadata, a continuity explanation, and a destination-specific arrival cue. Choosing Transit Deeper opens a dedicated internal-transit briefing that shows the secured/next-space route, current recovery tags, carried suit health/armor, the +12 capacitor service and 35% heat bleed already applied by expedition transit, plus the arrival cue before the next combat space is instantiated. The combat state remains frozen at the checkpoint until the player commits the transit, and mobile/coarse-pointer layouts collapse the route/carry grids into a scroll-safe two-column presentation. Gameplay regressions cover representative transition routes across all four capstones plus the staged GameCanvas handoff. The next capstone work is P4.16 Environmental continuity.

**P4.12–P4.14 delivered:** Abandoned Shipbreaking Yard Hecate now reads as one continuous dismantling complex instead of four unrelated reused biomes. A dedicated shipbreaking-yard capstone profile carries a black salvage-truss spine, red clamp arms, and yellow cutter datum through Sunward Clamp Field, Crusher Causeway, Wreck Transit, and Yard Control Crown while layering autonomous hull cradles, crusher jaws, stripped wreck frames, and master control pylons. Each space overrides generic sector naming and carries Hecate-specific shipbreak events with physical clamp-vector, crusher-mass, open-hull vacuum, and cutter-grid hazards; stage two fields the Hecate Crusher Foreman. Yard Control Crown culminates in Hecate Yardmaster Null, whose clamp-lock, thermal-cutter, and wreck-purge patterns turn the final gantry into a dedicated shipbreaking finale. Full/Balanced/mobile/Performance profiles trim repeated salvage trusses, cutter datum markers, stage props, and structural shadows without losing the yard silhouette. Gameplay and render regressions cover all four spaces, Yardmaster identity/phase behavior, stage events, continuity telemetry, and mobile performance profile. The next capstone work is P4.15 Stage transitions.

**P4.9–P4.11 delivered:** Unregistered Asteroid Habitat Orpheline now reads as one buried settlement instead of four unrelated reused biomes. A dedicated hidden-habitat capstone profile carries a rock-cut spine, violet utility trunk, and white occupancy marks through Ice Access Bore, Industrial Commons, Residential Spin Ring, and Buried Control Vault while layering concealment shutters, improvised fabrication stalls, hab-pod stacks, and founding-archive walls. Each space overrides generic sector naming and carries Orpheline-specific habitat event language with physical venting, grid, and gravity hazards; stage two fields the Orpheline Commons Custodian. The Buried Control Vault culminates in a dedicated Orpheline Habitat Warden whose shelter-purge, spin-authority, and partition-fire patterns turn the founding archive into a distinct finale. Full/Balanced/mobile/Performance profiles trim repeated rock ribs, utility markers, stage props, and structural shadows without losing the habitat silhouette. Gameplay and render regressions cover all four spaces, the Warden identity, stage events, continuity telemetry, and mobile performance profile. The next capstone slice is P4.12–P4.14 Hecate.

**P4.5–P4.8 delivered:** Orbital Elevator Counterweight K-91 now reads as one continuous tumbling mass instead of four unrelated reused biomes. A dedicated counterweight capstone profile carries the same load spine, paired countermass rails, and amber inertial datum through Capture Collar, Mass Transit Spine, Power Transfer Gallery, and Ballast Vault while layering stage-specific capture jaws, mass carriages, lift-bus hardware, and ballast restraints. Each space now overrides generic sector naming and carries K-91 inertial event language with physical vector/gravity/grid hazards; stage two fields the K-91 Mass-Transit Warden. The finale deliberately remains bossless: the Ballast Vault ends on a high-pressure ballast-shift survival/recovery beat, matching the site premise that the value is surviving the full traverse rather than hunting a command target. Full/Balanced/mobile/Performance profiles trim repeated rails, datum lights, props, and structural shadows without losing the counterweight silhouette. Gameplay and render regressions cover all four spaces, the bossless final contract, inertial events, runtime continuity telemetry, and mobile performance profile. The next capstone slice is P4.9–P4.11 Orpheline.

**P4.1–P4.4 delivered:** Generation Ship Perseid now reads as one continuous derelict instead of four unrelated reused biomes. A dedicated capstone profile overlays the same keel spine, pressure ribs, and green transit datum across Docking Spine, Agricultural Drum, Cryogenic Service Deck, and Reactor Choir while adding stage-specific docking, agriculture, cryogenic, and harmonic-reactor dressing. Each space now overrides generic sector naming, carries its own Perseid event language and local hazard beat, preserves the stage-two guaranteed elite as the Perseid Drum Warder, and culminates in a dedicated Perseid Steward Core boss variant with pressure, gravity, and reactor-choir phase mechanics. The continuity layer has Full/Balanced/mobile/Performance budgets that trim repeated ribs, guide lights, props, and structural shadows without removing stage identity. Gameplay and render regressions cover the four-stage route, optional recovery, elite, Steward Core, ship events, runtime continuity telemetry, and mobile performance profile. The next capstone slice is P4.5–P4.8 K-91.

**P3.13 delivered:** Solar Yard now has a dedicated adaptive render profile instead of relying on LOD selection alone. Full desktop retains the complete authored yard, while Balanced/mobile trim secondary decks, trusses, radiators, fabrication machines, and transfer rails; mobile preserves all three reflector pylons, both moving gantry cranes, the gameplay-bound thermal shutter, and HELIOS-9 while forcing LOD2. Solar Yard structural shadow casters are disabled outside the Full profile, sun/shade overlays drop from 3+3 to 2+2 on mobile and 1+1 in Performance, and the procedural fallback follows the same panel/overlay/shadow budget. Deterministic render-profile regression plus desktop/mobile-landscape browser QA cover the authored instance budget, shadow policy, overlay density, transport motion, thermal shutter linkage, and boss LOD. P3 is complete; P4 begins with Perseid.

**P3.12 delivered:** HELIOS-9 Yardmind now has a Solar Yard-specific authored boss presentation instead of the shared generic boss silhouette. Adaptive LOD1/LOD2 assets give the yardmind a broad sunshield crown, paired reflector wings, and fabrication/thermal core hardware in the existing ceramic / solar-gold / heat-amber language, shifting to overheat-red pressure cues in phase two while preserving the shared boss telegraph system. Runtime routing is restricted to Solar Yard contracts whose deep target is HELIOS-9 Yardmind; deterministic telemetry exposes boss identity, asset, silhouette, palette, and live phase presentation, while mobile-landscape selects the dedicated LOD2 asset. Generated-content, static graphics, and browser runtime regressions cover the new presentation. The dedicated Solar Yard mobile optimization pass remains P3.13.

**P3.11 delivered:** Solar Yard now has an authored material-transfer system instead of a static fabrication floor: three paired transfer-rail spans cross the fabrication spine and two overhead gantry cranes carry independently phased trolley assemblies. Both transport families ship adaptive LOD1/LOD2 GLBs in the existing ceramic / scorched-steel / solar-gold / heat-amber language. The trolleys move deterministically from live simulation time rather than decorative randomness, and runtime telemetry exposes rail/crane counts, motion mode, and live trolley offsets. Generated-content/static regressions and desktop/mobile-landscape Browser E2E verify the authored families, mobile LOD reduction, runtime loading, and actual trolley movement. HELIOS-9 presentation and the dedicated Solar Yard mobile optimization pass remain P3.12–P3.13.

**P3.10 delivered:** Solar Yard now has authored local thermal-shutter hardware tied directly to the existing `solar-shutter` gameplay control. The shutter family ships adaptive LOD1/LOD2 GLBs with ceramic thermal panels, scorched structural rails/posts, solar-gold actuation hardware, amber status lighting, and full-detail heat-rejection ribs. Runtime placement is anchored to the live encounter control, open/closed panel state follows the control's real `exposed` state, and the existing solar-surge logic remains the source of radiant-load protection rather than being duplicated in the renderer. Deterministic telemetry exposes authored shutter state, radiant-load protection, and the state-link contract; generated-content/static regressions and desktop/mobile-landscape Browser E2E verify the new asset family, mobile LOD reduction, authored loading, and live open-state linkage. Cranes/rails/motion, HELIOS-9 presentation, and the dedicated mobile optimization pass remain P3.11–P3.13.

**P3.9 delivered:** Solar Yard now has a stable biome-specific luminance identity instead of relying on the shared player-following key light. A fixed sunward directional key creates consistent long shadows across the yard, a lower-intensity cool fill preserves readable shaded combat space, and three bounded sun patches / three cool shade masses reinforce the authored shade-deck → fabrication-spine → sunward-yard composition without adding heavy geometry. The existing live solar-shutter timing can still drive a short solar-surge state, but the authored shutter hardware remains reserved for P3.10. Runtime telemetry exposes the sun direction, hard-sun/cool-shade language, patch counts, active sun mode, tone treatment, and adaptive shadow budget; static graphics regression and desktop/mobile-landscape Browser E2E cover the identity. Thermal shutters, cranes/rails/motion, HELIOS-9 presentation, and the dedicated mobile optimization pass remain P3.10–P3.13.

**P3.8 delivered:** Solar Yard fabrication is now represented by three authored machine families instead of generic service props: sinter forges, printer spindles, and feedstock presses. Seven machines are distributed across the shade deck, fabrication spine, and sunward work yard; the P3.7 ceramic decks, truss frames, radiator towers, and reflector pylons now load with them as one authored Solar Yard scene. Every family ships adaptive LOD1/LOD2 GLBs, the runtime preserves procedural fallback, coarse/mobile forces LOD2, and deterministic telemetry exposes the exact fabrication-machine budget for browser QA. Generated-content, static graphics, and desktop/mobile-landscape Browser E2E cover the complete P3.7–P3.8 yard foundation. Sun/shadow identity remains P3.9; thermal shutters, cranes/rails/motion, HELIOS-9 presentation, and the dedicated mobile optimization pass remain P3.10–P3.13.

**P3.7 delivered:** Solar Yard now has a reusable authored static environment foundation with ceramic fabrication decks, scorched structural truss frames, black radiator towers, and gold reflector pylons. All four families generate adaptive LOD1/LOD2 GLBs, retain a ceramic / scorched-steel / black-radiator / solar-gold / heat-amber material language, and expose deterministic silhouette markers for asset QA. Generated-content and static asset-pipeline regressions verify the authored kit and mobile LOD reduction. Active fabrication machinery remains P3.8; sun/shadow identity, thermal shutters, cranes/rails/motion, HELIOS-9 presentation, and the dedicated mobile optimization pass remain P3.9–P3.13.

**P3.6 delivered:** Salvage Captain Rhea Kade now has an Ice Mine-specific authored boss presentation instead of the shared generic boss silhouette. Adaptive LOD1/LOD2 assets give her a bore-cowl, cryogenic backpack hardware, a fracture-ram profile, and a mine-steel/frost-cyan palette that shifts to fracture-amber pressure in phase two while retaining the shared boss telegraph language. Runtime routing is restricted to Ice Mine contracts whose deep target is Rhea Kade; generated-content, static graphics, and browser QA cover the silhouette contract, mobile LOD2 selection, and phase telemetry. Ice Mine P3.1–P3.6 is complete; Solar Yard begins at P3.7.

**P3.5 delivered:** Ice Mine support failure now reads as a real physical collapse instead of an authored frame simply disappearing. Damaged brittle gates expose animated fracture rings, support failure triggers a deterministic frost pulse plus ballistic ice/steel shard burst, and settled rubble remains at the opened firing lane. The effect is driven directly by live support HP/active transitions, timed ice shear now zeroes support durability as well as collision state, and coarse/mobile rendering cuts the effect from eight shards/three crack bands to four shards/two crack bands. Runtime telemetry exposes fracture identity, state, detail tier, and per-support collapse state; static graphics and browser smoke coverage verify the VFX contract. Rhea Kade presentation remains P3.6.\n\n**P3.4 delivered:** Ice Mine now carries a dedicated authored cryogenic machinery run instead of relying on generic service props: two cryo pumps, three coolant manifolds, and two freeze compressors span the reinforced extraction tunnel into the Subglacial Vault. Each machinery family ships adaptive LOD1/LOD2 GLBs, keeps cold-cyan operational markers and frost detail, participates in the same authored-load/procedural-fallback path, and exposes deterministic machinery telemetry for browser QA. Generated-content checks validate silhouette/material retention, while desktop/mobile-landscape browser coverage verifies the full seven-machine layout and mobile LOD2 selection. Collapse/fracture effects remain P3.5 and Rhea Kade presentation remains P3.6.\n\n**P3.3 delivered:** Ice Mine brittle supports are now gameplay-bound rather than decorative: the two light support gates remain destructible by player fire, the authored 14-second ice shear collapses whatever is still standing, and each live support drives a matching authored tunnel-frame root. The renderer suppresses the generic collision-box visual only after authored geometry is ready, preserving fallback behavior, and exposes intact/damaged/partial/cleared support telemetry for runtime QA. Gameplay regression covers both player-opened and timed-opened firing lanes, while static graphics plus desktop/mobile browser QA verify the authored support binding and live support-state telemetry without depending on encounter survival time. Cryogenic machinery remains P3.4; collapse/fracture effects and Rhea Kade presentation remain P3.5–P3.6.\n\n**P3.2 delivered:** Ice Mine now composes the P3.1 kit into a runtime three-zone mine silhouette: a frost-cut Access Bore, a steel-supported Extraction Tunnel with cyan service decking, and a pillar-dense Subglacial Vault. Authored runtime loading retains procedural crystal scenery as fallback, exposes deterministic zone/composition telemetry, and forces LOD2 on coarse/mobile surfaces. Static renderer regression plus dedicated desktop/mobile-landscape browser QA now cover the authored sequence. Brittle support destruction remains P3.3; cryogenic machinery, collapse/fracture effects, and Rhea Kade presentation remain P3.4–P3.6.\n\n**P3.1 delivered:** Ice Mine now has a reusable authored static environment asset kit with frost walls, structural support frames, service decks, and ice pillars. All four families generate adaptive LOD1/LOD2 GLBs with cold-rock, support-steel, frost-ice, and cyan-readability material identities plus deterministic silhouette markers. Generated-content and static asset-pipeline regressions verify the kit and mobile LOD reduction, and the PR full regression/production build is green. Bore/tunnel runtime composition remains P3.2; brittle support destruction, cryogenic machinery, collapse/fracture effects, and Rhea Kade presentation remain P3.3–P3.6.

**P2.16 delivered:** Jovian Harvester now has a dedicated adaptive biome render profile instead of inheriting the generic scene budget unchanged. Full desktop preserves the 19-piece authored structural composition; Balanced, coarse/mobile, and Performance profiles trim non-landmark deck/bridge/ballast placements to 13 pieces while preserving all five skimmer towers. Coarse/mobile forces authored environment LOD2, non-Full profiles disable structural shadow casters, and the procedural fallback follows the same shadow policy. Existing P2.12 storm-pressure and P2.15 atmosphere density reductions remain layered on top. Deterministic render-profile regressions and desktop/mobile-landscape browser runtime QA now assert the active LOD, structural instance budget, and shadow budget. P2 is complete; the next implementation target is P3.1 Ice Mine assets.

**P2.15 delivered:** Jovian Harvester now has a persistent atmospheric layer distinct from the reactive P2.12 storm/pressure effects: broad upper-atmosphere pressure-cloud filaments, slow charged particulate, and skimmer-spine haze. Ambient motion uses low-frequency crosswind drift / pressure breathing / charged drift and is subtly modulated by live storm charge and pressure shear without becoming event-only VFX. Density scales through the existing render budget (2/3/5 cloud bands and 20/36/56 motes) with deterministic coarse/mobile reduction. Static graphics and render-budget regressions, the full production build, PR and merged-main desktop + mobile-landscape Browser E2E, Level 15 beta smoke, Android beta.167 package/version/SDK/signature verification, native emulator runtime smoke, and Chapter 3 touch playthrough are green. P2.16 remains the dedicated Jovian mobile LOD/performance pass.

**P2.14 delivered:** Stormline Foreman Ilex now has a dedicated Jovian Harvester boss presentation with adaptive LOD1/LOD2 assets, a pressure-work silhouette built around a storm cowl, pressure crown, relief stacks, and manifold pack, contract-scoped runtime routing, and a storm-orange / pressure-cyan / vent-red phase language. Static/generated-content regressions, the full production build, PR and merged-main desktop + mobile-landscape Browser E2E, Level 15 beta smoke, Android beta.166 package/version/SDK/signature verification, and Android emulator runtime + Chapter 3 touch smoke are green. Runtime QA confirms `stormline-foreman-ilex` with the dedicated `jovian-harvester-stormline-foreman-lod2` asset in both browser viewports. Atmospheric effects and the dedicated mobile performance pass remain scoped to P2.15–P2.16.

**P2.13 delivered:** Jovian Harvester pressure gameplay now has biome-specific authored hardware instead of shared generic controls: a storm-rated pressure-lock family for live pressure doors/interlocks and a relief-manifold family for breach/seal controls. Both ship adaptive LOD1/LOD2 GLBs with distinct wheel/valve silhouettes, full-detail equalization/gauge/riser props, status emitters, and objective-beacon mounts. Runtime status color/intensity follows the real pressure-door link and service/boss breach state, while QA telemetry exposes the pressure kit, source, live pressure state, and door state. Generated-content and static graphics regressions, full production build, desktop + mobile-landscape Browser E2E on PR and merged `main`, Level 15 beta smoke, Android beta.165 package/version/SDK/signature verification, and Android emulator runtime + Chapter 3 touch smoke are green on implementation head `fd5840bf877b48fd490ae6d4991cb886724b725d`. Stormline Foreman presentation, atmospheric effects, and the dedicated mobile performance pass remain scoped to P2.14–P2.16.

**P2.12 delivered:** Jovian Harvester now has a gameplay-driven storm/pressure visual language layered over both authored and fallback environment geometry: electrostatic storm-charge sweeps, unequal-pressure shear bands, and a storm-relief manifold pulse. Visual state is derived from live sector pressures/pressure states, the service-breach state, and contract pressure/grid conditions rather than decorative randomness; venting shifts the language toward warning-red relief cues, while normal unequal-pressure operation retains the storm-orange/pressure-cyan identity. The effect scales through the existing transparency/VFX budget and trims secondary sweeps/bands for coarse pointers or Performance-tier rendering. Deterministic helper regression, static graphics assertions, full production regression/build, Level 15 beta smoke, desktop + mobile-landscape Browser E2E with live storm/shear telemetry, Android beta.164 package/version/SDK/signature verification, and native emulator runtime smoke are green on implementation head `971da635740eaf16d7302eb17b563d8432fc5ac7`. Pressure props/interactables, Stormline Foreman presentation, atmospheric effects, and the dedicated mobile performance pass remain scoped to P2.13–P2.16.

**P2.11 delivered:** Jovian Harvester gameplay machinery now has four biome-local authored families bound to the existing mission systems: storm-bus isolators for live grid branches, deck mass-trim hardware for gravity calibration, and skimmer-compressor / separator-package recovery machines for machinery-recovery objectives. Every family ships adaptive LOD1/LOD2 GLBs with distinct silhouettes, state-readable status emitters, objective-beacon mounts on full-detail assets, runtime authored/fallback routing, and deterministic QA telemetry. Generated-content regression validates scale, silhouette markers, and mobile payload reduction; the full production regression/build, Level 15 beta smoke, desktop + mobile-landscape Browser E2E, Android beta.163 package/version/SDK/signature verification, and Android emulator runtime smoke are green on implementation head `8a9275289ce2f22689000574e158c8f711609bde`. Storm/pressure visual language, pressure interactables, Stormline Foreman presentation, atmospheric effects, and the dedicated mobile performance pass remain scoped to P2.12–P2.16.

**P2.10 delivered:** Jovian Harvester now has a reusable authored structural environment foundation with weathered elevated deck spans, a five-skimmer-tower silhouette, dark transfer bridges, and suspended ballast pods. All four families generate adaptive LOD1/LOD2 GLBs, route through runtime authored placement with procedural fallback, expose deterministic screenshot/readability telemetry, and are covered by generated-content, static pipeline, and desktop/mobile-landscape browser runtime QA. Storm/pressure visual language, pressure interactables, Stormline Foreman presentation, atmospheric effects, and the dedicated mobile performance pass remain scoped to P2.12–P2.16.

**P2.9 delivered:** Spin Habitat now has a biome-specific adaptive render profile: coarse/mobile play forces authored environment LOD2, trims the rotating environment from 15 to 11 authored placements while preserving all four spokes and the stationary axis, disables rotating environment shadow casters outside the full desktop profile, lowers procedural rim tessellation, and uses the three-arc spindown presentation on mobile. Runtime telemetry exposes profile, instance budget, and shadow-caster mode. Full production regression/build, Level 15 beta smoke, desktop + mobile-landscape Browser E2E (including live mobile LOD2 / 11-instance / axis-only assertions), Android beta.156 package/version/SDK/signature verification, and Android emulator runtime smoke are green.

**P2.8 delivered:** Spin Habitat now has a bounded ambient-effects layer that makes the biome read even when no emergency event is active: gravity-coupled cyan/green rim-light sweeps, counter-drifting habitat particulate, and a stationary-axis haze pulse. The effects follow the real habitat rotation state, scale their light-band count, mote count, opacity, and pulse intensity through the existing adaptive VFX/transparency budget, and expose deterministic runtime QA telemetry without folding the dedicated performance/LOD pass forward from P2.9. Full production regression/build, desktop + mobile-landscape Browser E2E, Level 15 beta smoke, Android beta.155 package/version/signature verification, and Android emulator runtime smoke are green.

**P2.7 delivered:** Recovery Commander Sable Voss now has a Spin Habitat-specific authored boss presentation instead of the shared generic boss silhouette. Her adaptive LOD1/LOD2 model adds a broad counter-spin mantle, command visor, governor hardware, and a recovery-green/cyan command palette that shifts to amber pressure cues in phase two while preserving the shared boss telegraph language. Runtime routing is scoped to Spin Habitat contracts whose deep target is Sable Voss, with explicit authored/fallback QA telemetry. Generated-content regression validates the silhouette marker and mobile payload reduction; full production regression/build, desktop + mobile-landscape Browser E2E, APK package/version/signature verification, and Android emulator smoke are green on the final P2.7 head.

**P2.6 delivered:** Spin Habitat combat now has four biome-local authored enemy identities tied to the existing tactical variants: Spoke Marksman, Spin-Trim Specialist, Ring Drone Carrier, and Axis Shield Boarder. Each identity ships adaptive LOD1/LOD2 GLBs with preserved articulated enemy rig sockets, a distinct silhouette marker and cool green/cyan habitat palette; renderer routing is restricted to Spin Habitat and deliberately leaves Recovery Commander Sable Voss on the generic boss path for P2.7. Generated-content tests validate every local LOD pair and mobile payload reduction, runtime QA exposes the local kit/assets and fallback state, desktop + mobile-landscape Browser E2E verify all four authored identities in live Spin Habitat combat, and Android beta.152 re-verifies package metadata/signature plus native emulator runtime/touch smoke.

**P2.5 delivered:** Spin Habitat gameplay machinery now has five authored, mobile-LOD-aware families tied to the real mission objects: spin-bus isolators, rim/spoke gravity trims, bearing-control recovery hardware, attitude flywheels, and pressure locks. The renderer selects these families by biome, object kind, and machinery-recovery objective identity while preserving generic salvage/cache visuals where appropriate. Runtime QA exposes the active habitat interactable kit and loaded assets, generated-GLB tests validate every LOD pair and silhouette marker, desktop and mobile-landscape Browser E2E verify authored habitat machinery without procedural fallback, and Android beta.151 re-verifies the packaged runtime, touch flow, Chapter 3 playthrough, package metadata, signature, and emulator smoke.

**P2.4 delivered:** Spin Habitat emergency spindown now has gameplay-driven VFX tied to the real Sector B transfer-gravity state: lowering transfer gravity toward 0.05G activates amber rim brake arcs and a stationary-axis warning pulse while preserving the existing Sector A gravity-coupled architecture rotation. The effect exposes runtime QA state/intensity/source/detail, scales transparency through the adaptive render budget, drops secondary arcs in the performance VFX tier, and retains deterministic nominal/emergency regression coverage. Desktop and mobile-landscape Browser E2E verify the runtime VFX contract, and Android beta.150 re-verifies the packaged runtime, touch flow, Chapter 3 playthrough, package metadata, and emulator smoke.

**P2.3 delivered:** Spin Habitat now separates its three navigation zones by both silhouette and material language: the rim uses broad green-plated deck mass and wayfinding, spokes use slimmer skeletal dark trusses with cyan status lighting, and the stationary axis uses a brighter cool-metal tower silhouette with service rings, beacon, and vertical fins. The procedural fallback preserves the same rim/spoke/axis hierarchy, runtime QA exposes the zone-identity contract, generated-GLB tests validate the assigned materials, retained desktop/mobile-landscape screenshots confirm the differentiation in combat, and Android beta.142 re-verifies the packaged runtime. Spindown VFX, machinery/interactables, local enemy presentation, Sable Voss, ambient effects, and the dedicated mobile performance pass remain in P2.4–P2.9.

**P2.2 delivered:** Spin Habitat ring segments, spoke trusses, and service bays now share a gravity-coupled rotating structural frame while the central axis hub remains stationary. The procedural fallback rotates with an asymmetric witness marker, runtime QA exposes spin mode/RPM/phase/source, spin overspeed naturally accelerates the visual frame through sector-A gravity, and desktop/mobile browser QA verifies that the rendered phase advances.

**P2.1 delivered:** Spin Habitat now has an authored reusable environment kit with ring segments, spoke trusses, an axis hub, and service bays; every family ships adaptive LOD1/LOD2 assets, runtime authored placement, procedural fallback, and graphics-content regression coverage.

**P1.22 delivered:** Chapter 3 now uses a smoother authored pressure curve, stronger late/finale material premiums, separate opening-vs-closing boss durability budgets, preserved no-side-grind LV15–18 XP gates, and dedicated regression coverage for the tuned values. Android beta.134 re-verified the packaged combat/touch/lifecycle and native Chapter 3 touch flow.

**P1.21 delivered:** Packaged Android beta.133 now verifies Chapter 3 in the native WebView with touch-driven Intel/contract/route-decision interaction, LV15–18 checkpoint coverage, both completion branches, zero horizontal overflow at the Android emulator viewport, retained screenshot/report evidence, and the existing Android combat/lifecycle smoke.

**P1.20 delivered:** Dedicated Chapter 3 QA now plays all 12 operations through normal settlement/XP progression on both route branches, verifies LV16/LV17/LV18 gates, and exercises the Chapter 3 Intel/Contract Board flow at desktop and mobile-landscape browser viewports.

**P1.18 delivered:** Parallax Debt now has a dedicated LV15–18 phase timeline, evidence bank, route-decision/branch presentation, unresolved-evidence boundary, responsive mobile-landscape treatment, and regression coverage.

Sera Nox tuning is now phase-aware: Blind Meridian uses the lighter opening-finale budget while Chapter 3 closing bosses retain the higher end-of-chapter durability budget.


## P8.5 — Gear 2.0 // Build-Defining Itemization

- [x] **P8.5-A Gear architecture audit + target schema** — inventoried the current equipment power axes and ownership across item generation, frame depth, loot quality, rarity, Reconstruction, faction gear, class-skill links, Singular runtime hooks, combat derivation, UI-facing item fields, and regressions. Added `src/game/gearSchema.ts` as the executable target vocabulary for bases, scoped stats, affixes, Augments, Singulars, build tags, and the future V2 item record; added `docs/gear-architecture-audit.md` plus the `test:gear-schema` release gate.
  - The audit explicitly assigns Recovery Level to eligibility, Modifier Grade to affix strength, Equipment Quality to base/inherent improvement, Recovery Quality to drop provenance/quality bias, Frame Generation to base-frame progression, rarity to explicit-mod budgets, Augments to bounded utility customization, and Singulars to curated rule-changing packages.
  - Verified on merged main `19f34c21e48e2677ce2cc95a13522bf02cb9e4cf`: Browser E2E `35638230023`, Level 15 beta smoke `35638229810`, and Android beta.227 `35638229940` all passed.
  - Android artifact `10657786590` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.227`, debug signing, and APK SHA-256 `3a85a2554ba17a4986ef01ff18f16208e70fddd80afc01257b0bc380107ec211`.
  - **Next: P8.5-B — Power-axis consolidation.**

- [x] **P8.5-B Power-axis consolidation** — removed the separate universal Frame Generation combat multiplier from build derivation, stopped generation/equipment quality from layering generic power/recovery onto class skills, and kept class-skill integration identity-specific. Recovery Quality remains drop provenance/bias rather than a persistent combat multiplier, Equipment Quality now rolls independently for new drops and only scales frame/base inherent behavior, Modifier Grade remains explicit-affix strength, and Frame Generation remains base-frame progression/eligibility metadata.
  - Added `tests/gear-power-axis.ts` plus the `test:gear-power-axis` build gate covering Recovery Quality combat neutrality, Frame Generation base-vs-universal separation, Equipment Quality inherent-only scaling, Modifier Grade strength, and independent drop quality.
  - Updated the class-owned-skill regression to verify each family’s actual frame identity signal (Vanguard power/armor, Vector range/armor, Systems recovery/chain) rather than depending on the removed generic frame-depth bonus.
  - Verified on merged main `6cedda46a6611d838e63dc27f4f5a42674f958bd`: Browser E2E `35658499659`, Level 15 beta smoke `35658499723`, and Android beta.230 `35658499694` all passed. Android emulator QA passed class selection, mobile menu/skill hierarchy, class kit, touch combat, runtime rendering, lifecycle resume, authored operator/enemy/weapon/refinery checks, and Chapter 3 touch playthrough.
  - Android artifact `10665749798` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.230`, debug signing, and APK SHA-256 `4ed04a5c15811b0cfe3c79a8b750c227cac5fea01d48a06d08b6dbd2f7d3a937`.
  - **Next: P8.5-C — Meaningful base-frame families.**

- [x] **P8.5-C Meaningful base-frame families** — replaced the one-base-per-slot generation-name ladder with 18 authored strategic base families: three each for Carbine, Breacher, Rail, Suit, Rig, and Implant. Every family now owns a stable base identity, inherent/implicit role, frame behavior, explicit tradeoff, build tags, legal affix pool, and a generation range that preserves the family across the current progression ladder.
  - Live loot now selects an eligible base family before modifiers; forced onboarding affixes choose a compatible family, faction recoveries inherit the legal pool for their matching frame identity, and legacy base IDs normalize deterministically without deleting saved gear.
  - Added `tests/gear-base-families.ts` plus the `test:gear-base-families` build gate. Coverage proves three distinct families per slot, differentiated same-slot pools, legacy aliasing, compatible forced-affix routing, and a direct-output-vs-thermal Breacher comparison where a Generation 1 specialist can still beat a Generation 6 alternative on its intended damage axis.
  - Verification caught and fixed two integration regressions before closure: the older Gear 2.0 audit gate still expected the removed `baseNames` table, and the Dense-Choke Breacher pool overlapped the Backblast onboarding signature pair. Both were corrected before the final green build.
  - Verified on merged main `311855564d9e6381e15470a274e24db168d60f67`: Browser E2E `35660219711`, Level 15 beta smoke `35660219687`, and Android beta.233 `35660219691` all passed, including Android emulator smoke.
  - Android artifact `10667401598` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.233`, debug signing, and APK SHA-256 `af8f18d5097802e3ecd3ef3d4a26075da92033df0afdd43c132e0bcc796dd9a7`.
  - **Next: P8.5-D — Stat registry + local/global scope + build tags.**

- [x] **P8.5-D Stat registry + local/global scope + build tags** — added a single typed `gearStats` registry covering 57 base/affix/global/skill-family/environment/rule stat semantics and the shared 20-tag Gear 2.0 vocabulary. Base families derive/merge their build tags from registered stats; materialized modifiers now carry registry stat IDs/tradeoffs/tags; class-resonance/build affinities use the same affix semantics instead of the removed duplicate modifier-affinity table.
  - Combat affix application now checks registered scope before applying local weapon effects; loot metadata, Armory search/inspection, class build links, and Reconstruction candidate validation all consume the shared registry. The Armory exposes generated BUILD TAGS and STAT SCOPE without introducing a gear-score number.
  - Added `tests/gear-stat-registry.ts` plus the `test:gear-stat-registry` production build gate. Regression covers 57 unique registered stats, all 15 current affixes, base semantic/tag parity, local-affix scope presentation, crafting consumption, and preserved Vanguard/Vector/Systems affinity behavior.
  - PR #154 Browser E2E `35661888226` passed desktop and mobile-landscape including full regression/production build and player journeys. The P8.5-D gate reported `GEAR_STAT_REGISTRY_PASS stats=57 affixes=15 tags=20`.
  - Verified on merged main `30b907f2beaf6cb04b0b4e64dba55ab6fc3df852`: Browser E2E `35662108587`, Level 15 beta smoke `35662108589`, and Android beta.234 `35662108576` all passed. Android verification passed package/version/SDK/signature checks, native emulator class selection/menu/skills/class-kit/touch/runtime/lifecycle QA, authored assets, and the Chapter 3 touch playthrough.
  - Android artifact `10666859262` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.234`, debug signing, and APK SHA-256 `e04b42bb514f04b63dddc5f1e7d04f5338f4a0f0ee07e4418158acc4a3233854`.
  - **Next: P8.5-E — Affix pools + conflicts + rarity budgets.**

- [x] **P8.5-E Affix pools + conflicts + rarity budgets** — added an authoritative `gearAffixes` registry for all 15 current explicit modifiers with slot legality, base-pool legality, mod groups, positive roll weights, reciprocal conflicts, minimum Recovery Level gates, G1–G5 stat/tradeoff tables, and shared rarity budgets. Field stays a clean base with 0 explicit mods, Refined caps at 2, Prototype caps at 6, and Singular remains a curated fixed package that can intentionally bypass ordinary random-roll rules.
  - Live ordinary loot now rolls only affixes legal for the selected base, slot, Recovery Level, and already-chosen modifiers, with weighted selection and explicit conflict rejection. Advanced modifiers such as Tungsten, Rail Fracture, and Relay Microdrone retain authored Recovery Level gates instead of leaking into early recoveries.
  - Reconstruction now consumes the same base-aware legal pool and rarity-budget rules as loot generation. This closed the pre-existing mismatch where Field equipment could gain a random affix and Prototype reconstruction stopped at five modifiers even though the roadmap contract allows six.
  - Added `tests/gear-affix-rules.ts` and the `test:gear-affix-rules` production-build gate covering registry completeness, G1–G5 tables, Recovery Level floors, reciprocal conflicts, weighted choice coverage, slot/base legality, rarity budgets, Singular exemption, live modifier metadata, and Reconstruction boundaries.
  - Verification caught and fixed two integration issues before closure: advanced-affix grade floors needed to respect each affix's own minimum Recovery Level, and the existing architecture audit intentionally required the typed `const affixes:` facade in `meta.ts`. Both were corrected without weakening the gates.
  - PR #155 Browser E2E `35664001207` passed desktop and mobile-landscape full regression, production build, and player journeys.
  - Verified on merged main `a0b9ed59cad21ab953b39912849f279c8ce37896`: Browser E2E `35664177993`, Level 15 beta smoke `35664177901`, and Android beta.235 `35664178163` all passed. Android verification covered package/version/SDK/signature checks, native emulator class selection, menu/skills/class-kit, touch combat, authored runtime assets, lifecycle resume, and the Chapter 3 touch playthrough.
  - Android artifact `10668966622` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.235`, debug signing, and APK SHA-256 `7dc9d592b699fddb1d78ce3b09ea59b011838b0036d882663ab8d67560d6889a`.
  - **Next: P8.5-F — Loot generation + anti-junk rules.**


- [x] **P8.5-F Loot generation + anti-junk rules** — centralized non-Singular equipment generation in `src/game/gearGeneration.ts` so ordinary, faction, field, elite, boss fallback, deep, and onboarding recoveries resolve through one validated path: slot → eligible authored base → Recovery Level/Frame Generation → rarity/modifier budget → compatible weighted affixes/grades → Equipment Quality/Augment sockets → source/faction opportunity bias → final validation.
  - The generator rejects illegal slot/base/Recovery Level combinations, duplicate/conflicting affixes, under-budget Refined/Prototype outcomes, invalid grade floors, and socket-count drift before item materialization. Prototype-capable base pools were expanded where conflicts previously starved legal 4–6 modifier outcomes.
  - Elite, boss, enhanced, and deep sources now spend more reward pressure on repeated quality opportunities and rarity pressure instead of simply adding larger disposable item piles. Field-loot quantity bands were reduced while premium-source opportunity quality remains stronger.
  - Added `tests/gear-loot-generation.ts` and the `test:gear-loot-generation` production-build gate, plus updated P8.5-C/P8.5-E ownership regressions so they verify the centralized generator rather than the retired in-`meta.ts` roll path.
  - Verification caught and fixed the centralized generator's faction-frame import plus two stale architecture assertions from earlier Gear 2.0 batches before closure; no gate was weakened.
  - PR #156 Browser E2E `35666379396` passed desktop and mobile-landscape full regression, production build, and browser player journeys on final head `fcdd95e37d97de03f54fde2ce434a1d521bddfeb`.
  - Verified on merged main `1c27e56eaa6bf3239b42916f9c77f6d7360146cd`: Browser E2E `35666584886`, Level 15 beta smoke `35666584887`, and Android beta.236 `35666584873` all passed. Android verification covered package/version/SDK/signature checks, emulator install/runtime/touch/lifecycle QA, authored assets, and the Chapter 3 touch playthrough.
  - Android artifact `10668674754` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.236`, debug signing, and APK SHA-256 `05fb004697cf08f5846e0134b101919edbccc681108bd9a56df1b45b0daab626`.
  - **Next: P8.5-G — Class/specialization gear integration.**
- [x] **P8.5-G Class/specialization gear integration** — replaced the nine ordinary specialization gear links' exact-affix gates with shared semantic build-tag clusters and 2-tag thresholds, so class builds can reach the same specialization synergy through multiple authored bases/modifiers instead of hunting one mandatory modifier ID.
  - Each specialization now declares `preferredTags` plus `minimumTagMatches`; the matcher consumes the same generated item build tags already shared by bases and affixes. An optional `exoticAffix` hook remains available for future genuinely rule-changing hard requirements, but no current ordinary specialization link uses one.
  - Equipment Bay comparison, build-changing filtering, storage badges, specialization cards, and active link state now consume the tag-driven matcher and explain matched tag routes rather than claiming a required modifier.
  - Regression coverage verifies all nine specializations have at least two class-equippable real base/affix routes, no ordinary exact-affix gate, resonance remains required, and equivalent semantic routes remain viable across Refined, Prototype, and Singular rarity contracts. UI regression also prevents the old exact-affix copy/contract from returning.
  - PR #157 Browser E2E `35669180527` passed full regression/production build on both desktop and mobile-landscape before merge.
  - Verified on merged main `1d5ae5a91fbd00ce4522a091c382afddee219254`: Browser E2E `35670423061`, Level 15 beta smoke `35670423099`, and Android beta.237 `35670423101` all passed. Android verification covered package/version/SDK/signature checks plus emulator install/runtime/touch/lifecycle and Chapter 3 playthrough QA.
  - Android artifact `10671030427` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.237`, debug signing, and APK SHA-256 `36008e913795f0bb02f6f631ce43675db657726f7de48b825454032257f0067b`.
  - **Next: P8.5-H — Quality + Augment responsibility pass.**

- [x] **P8.5-H Quality + Augment responsibility pass** — separated the remaining customization axes so Equipment Quality and Augments no longer behave like extra affix stacks. Equipment Quality now stays on a 0–20 base-frame axis and scales only the frame/inherent behavior at 1% per point, capping the quality contribution at +20%; explicit modifier grades and Augments remain unaffected.
  - Augment capacity is now rarity-bounded and generation-independent: Field 0, Refined 1, Prototype 2, Singular 2. Late Frame Generation can no longer inflate normal socket count to three, Reconstruction hard-caps accessible normal sockets at two, and current Augments remain fixed-effect utility/specialization hardware with explicit tradeoffs and no grades.
  - The Reconstruction/Armory surface now explains the three responsibilities directly: Frame Quality = base-frame improvement, Modifier Grade = explicit-affix strength, Augments = bounded fixed utility. The stale Armory reconstruction modifier-limit display was also routed to the authoritative rarity budget so Field/Refined/Prototype limits match the actual 0/2/6 rules.
  - Added P8.5-H regression coverage for the 0/1/2 socket contract across all current frame generations, the Q20/+20% quality ceiling and clamp, fixed Augment tradeoffs, and centralized loot-generation socket counts.
  - Verified on merged main `08a4e611cb1b343f6740d00304547bfc8324abab`: Browser E2E `35672315575`, Level 15 beta smoke `35672315474`, and Android beta.238 `35672315510` all passed. Android verification covered the full production regression/build, package/version/SDK/signature checks, installable APK build, emulator runtime/touch/lifecycle smoke, and Chapter 3 touch playthrough.
  - Android artifact `10671063785` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.238`, debug signing, and APK SHA-256 `c4488312cd5f7f1be4a4c50d0163c400265371243b55faf6faf132b87c2ac253`.
  - **Next: P8.5-I — Singular chase-item audit.**

- [x] **P8.5-I Singular chase-item audit** — audited all 60 current named Singulars and moved their chase identity into a data-driven registry covering all eight locked categories: Skill Transformer, Resource Loop, Movement Transformer, Projectile Transformer, Defense Transformer, Conditional Engine, Build Converter, and Environmental Interaction.
  - The audit found 54 unique Singular runtime traits and verified every one is wired to an actual simulation hook; no remaining Singular was a pure stat-stick requiring a combat rewrite. Existing rule-changing behavior was preserved where it already met the chase-item standard instead of adding unnecessary balance churn.
  - Added `src/game/gearSingulars.ts` as the authoritative chase metadata registry. Every Singular now carries a category, primary rule text, and explicit opportunity cost; `meta.ts` materializes that metadata onto runtime Singular items and `gearSchema.ts` validates the registry as part of the Gear 2.0 contract.
  - Added `tests/gear-singular-audit.ts` and wired it into the production build. The gate enforces complete one-to-one coverage between runtime Singular definitions and audit rows, unique base IDs, all eight category buckets, meaningful opportunity-cost copy, and a simulation hook for every referenced Singular trait.
  - Verification caught a TypeScript literal-union validator issue on the first CI attempt and fixed it in `43725ba8ec40cdacfa8fce5a35191c23ccdc8470`; no test or build gate was weakened.
  - Verified on main `43725ba8ec40cdacfa8fce5a35191c23ccdc8470`: Browser E2E `35673509787`, Level 15 beta smoke `35673509664`, and Android beta.240 `35673509803` all passed. Android verification covered full production regression/build, package/version/SDK/signature checks, installable APK generation, emulator runtime/touch/lifecycle smoke, and the Chapter 3 touch playthrough.
  - Android artifact `10672485894` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.240`, debug signing, and APK SHA-256 `533c9ad02399092fd5426be0989bb4d1969074d2f4bf0fb829eb8d721a68ef8a`.
  - **Next: P8.5-J — Mobile Armory + build-link comparison.**



- [x] **P8.5-J Mobile Armory + build-link comparison** — rebuilt item inspection around the Gear 2.0 decision hierarchy: name/rarity → base/implicit → explicit modifiers → Augments → generated BUILD LINKS → equipped loadout impact, with recovery/source/provenance and other advanced telemetry moved behind the expandable metadata layer.
  - BUILD LINKS now derive directly from the shared stat/tag registries and current-vs-candidate combat build. The comparison surfaces gained/lost local stats, global/environment stats, class-skill links and tuning sources, specialization gear-link activation/breakage, and Singular rule changes without introducing a composite gear-score number.
  - Preserved existing quick-read and discovery contracts inside the new hierarchy: PRIMARY EFFECT remains tap-visible, build-changing effects still call out mechanical modifiers/Singular signatures/specialization links, rarity and class-resonance language remains intact, and the established mobile inspector escape/scroll behavior is unchanged.
  - Added P8.5-J UI regression gates for hierarchy order, registry-driven gain/loss categories, advanced provenance placement, no-gear-score enforcement, and responsive gain/loss styling. Verification caught two compatibility regressions from the first restructure (legacy specialization-link wording and identity/provenance labels); both were restored without weakening the previous tests.
  - Verified on main `4c59505c043d2502a68a6c497ecaffd172ca90d5`: Browser E2E `35674695661`, Level 15 beta smoke `35674695652`, and Android beta.244 `35674695713` all passed. Android verification covered the full production regression/build, package/version/SDK/signature checks, installable APK generation, emulator runtime/touch/lifecycle smoke, and the Chapter 3 touch playthrough.
  - Android artifact `10672632757` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.244`, debug signing, and APK SHA-256 `f0b6196464748b8c5a95303f31333c95de48f1305591ec5501be2fff17119829`.
  - **Next: P8.5-K — Save/data migration + compatibility.**


- [x] **P8.5-K Save/data migration + compatibility** — moved the atomic game-state envelope to v2 with Gear Schema 1, normalized legacy Gear 2.0 inventory/equipped records in place, preserved valid item identities, clamped legacy Recovery Level/Frame Generation/Equipment Quality/Augment responsibility, rejected invalid/duplicate/conflicting affixes safely, and kept the existing verified backup/quarantine recovery contract intact.
  - Added `tests/save-data-migration.ts` and the `test:save-migration` production-build gate covering v1 → v2 upgrades, current-version round trips, equipped-item identity preservation, legacy normalization, and raw-byte recovery backup behavior.
  - Verified on main `329e6a64327fab5d82ee75fadc7f9517984f3678`: Browser E2E `35677516115`, Level 15 beta smoke `35677516122`, and Android beta.245 `35677516114` all passed.
  - Android artifact `10673937592` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.245`, debug signing, and APK SHA-256 `2d6ec0eb8fd96bcc167d2d1ea490075604f6927183e35434b001fd1f6c1a8c7c`.
  - **Next: P8.5-L — Balance/diversity/regression gate.**

- [x] **P8.5-L Balance/diversity/regression gate** — added one authoritative Gear 2.0 release gate that proves five Rail items can serve distinct projectile-flight, recoil/control, thermal/recovery, armor-work, and projectile-transformer goals using actual `deriveCombatBuild` output instead of a synthetic gear score.
  - The gate verifies all 15 current affixes alter runtime combat state, all 57 registered stats connect through at least two semantic build systems, illegal base/rarity/duplicate/conflict combinations remain rejected, Refined and Singular Reconstruction boundaries remain enforced, and a G5/Q20 Refined Hypervelocity Rail beats a deliberately poor G1 Prototype for the projectile-flight/reach build goal.
  - Production build ownership now explicitly binds loot generation, the P8.5-L diversity gate, Singular runtime-hook audit, v1→v2 save migration/recovery, build-link/touch UI regression, and the Android APK workflow so future regressions cannot bypass the closure gate.
  - Verified on main `e1a8c68e175ef9dd4898f9398346d47b890cf720`: Browser E2E `35679284960` passed desktop + mobile-landscape, Level 15 beta smoke `35679284967` passed, and Android beta.246 `35679284995` passed package/version/SDK/signature checks plus class-selection layout, mobile menu, skill hierarchy, class kit/assets, balanced render tier, touch controls, runtime, lifecycle resume, authored-content verification, and Chapter 3 touch playthrough.
  - Gate output: `GEAR_BALANCE_DIVERSITY_PASS railGoals=5 affixRuntime=15 statConnectivity=57 refinedSpecialist=true release=android+touch+save+singular`; the same build also reported `GEAR_SINGULAR_AUDIT_PASS singulars=60 traits=54 categories=8` and `SAVE_DATA_MIGRATION_PASS legacy=v1->v2 gearSchema=1 recovery=preserved`.
  - Android artifact `10674990855` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.246`, debug signing, and APK SHA-256 `5f39de7be68f5b30308e0f3f0f7f5f7746d979505d555cd098d350c7f518972a`.
  - **Next: P9-A — Graph architecture.**

- [x] **P9-A Graph architecture** — replaced the flat progression architecture with a versioned Deep Operator Network graph while preserving the current 18 passive mechanics as migrated legacy nodes. The verified foundation now has three zero-cost class origins, explicit graph edges, prerequisites, node hierarchy metadata, allocation costs, path previews, and a six-link shared outer ring for cross-sector routing.
  - Added `src/game/operatorNetwork.ts` with Operator Network Schema 1, canonical node/edge registries, Vanguard/Vector/Systems class starts, connectivity-aware allocation, prerequisite enforcement, shortest legal route + point-cost preview, and legacy mirrors for existing UI/runtime consumers.
  - Profile persistence now stores canonical `operatorNetwork` state while maintaining `progressionPoints` / `allocatedNodes` compatibility. Atomic game saves moved to v3 and migrate both v1 and v2 saves safely into Network Schema 1 without deleting valid allocations; level-earned points missing from invalid legacy nodes are refunded by normalization.
  - Added `tests/operator-network-architecture.ts` and wired `test:operator-network` into the production build. The gate verifies unique nodes, valid edges, three starts, shared outer routing, path cost, allocation prerequisites/connectivity, class-start movement, public allocation compatibility, and migration/refund behavior.
  - PR verification initially caught a Chapter 3 browser QA seeder that only accepted atomic save v1/v2. The harness was updated to accept v3 while keeping the exact Chapter 3 journey assertions intact; the rerun passed desktop and mobile-landscape before merge.
  - Verified on main `365e16170cf0a32285afb976affdb0489a13a396`: Browser E2E `35680844787`, Level 15 beta smoke `35680844866`, and Android beta.247 `35680844822` all passed. Production output included `OPERATOR_NETWORK_ARCHITECTURE_PASS schema=1 nodes=21 edges=24 outer=6 starts=3` and `SAVE_DATA_MIGRATION_PASS legacy=v1/v2->v3 gearSchema=1 networkSchema=1 recovery=preserved`.
  - Android verification passed package/version/SDK/signature checks, class-selection/mobile-menu/skill hierarchy, touch controls, authored runtime content, lifecycle resume, and the full Chapter 3 touch playthrough. Artifact `10674272900` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.247`, debug signing, and APK SHA-256 `7796b02fba8638b24ba0d84c5d60a46edfce492fb5d0646147c5fc4ad3e80b37`.
  - **Next: P9-B — Core node wave.**


- [x] **P9-B Core node wave** — expanded the Deep Operator Network from 21 to 69 authored nodes while preserving Network Schema 1 and the P9-A routing/save contracts. The wave adds 36 shared core-cluster nodes across Ballistics, Mobility, Systems, Survival, Engineering, and Awareness plus 12 class-owned weapon-sector nodes for Breacher, Rail Lance, and Carbine.
  - Every P9-B node carries explicit runtime stat effects rather than presentation-only text. Shared clusters cover offense, defense, resource flow, handling, thermal management, and class-skill support; class sectors remain hard-owned by Vanguard/Breacher, Vector/Rail Lance, and Systems/Carbine.
  - Graph routing now prevents off-class weapon sectors from acting as traversal shortcuts and returns a dedicated wrong-arsenal allocation result. Total topology is 69 nodes / 75 edges with the original six-link shared outer ring unchanged.
  - Progression UI now reads the canonical graph for adjacency/path cost, identifies Travel and Notable nodes, exposes route distance and point cost, distinguishes owned class-weapon sectors, disables off-class sectors, and adds a compact authored/allocated/notable/weapon-sector summary that remains mobile-safe.
  - Runtime integration applies data-driven Operator Network effects through `deriveCombatBuild`; regression coverage verifies node/edge counts, class ownership, legal/illegal routing, allocation gates, migration compatibility, shared-cluster effects, family-specific Breacher effects, and class-skill source attribution.
  - Verified on main `b00883375c3bab17131d1baf471d4d2271b4db2d`: Browser E2E `35681851238` passed desktop + mobile-landscape, Level 15 beta smoke `35681851321` passed, and Android beta.248 `35681851205` passed the full production build, package/version/SDK/signature checks, balanced render tier, touch controls, runtime route, authored refinery verification, lifecycle resume, and Chapter 3 touch playthrough.
  - Gate output: `OPERATOR_NETWORK_ARCHITECTURE_PASS schema=1 nodes=69 edges=75 outer=6 starts=3 coreWave=36 classWeapon=12`; save migration remained green with `SAVE_DATA_MIGRATION_PASS legacy=v1/v2->v3 gearSchema=1 networkSchema=1 recovery=preserved`.
  - Android artifact `10675054964` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.248`, debug signing, and APK SHA-256 `4bf448363b8c141caf8e48d5bbd3cdfd7491ebbc696ec66d4dd6ffa932754fec`.
  - **Next: P9-C — Build-defining wave.**

- [x] **P9-C Build-defining wave** — expanded the verified Deep Operator Network from 69 to 93 authored nodes without changing Network Schema 1. Added 24 major build-defining nodes across all six branches: 6 Masteries, 12 Keystones, and 6 Capstones.
  - Each branch now terminates in one Mastery, a mutually exclusive two-Keystone choice, and one Capstone reachable through either Keystone. Keystone choices carry explicit major upside/downside mechanics across damage/armor pressure, projectile handling, movement/defense, capacitor economy, thermal/reload behavior, and class-skill range/control/recovery.
  - Added data-driven Operator Network support for heat-per-shot and direct-health-damage multipliers so the new tradeoffs alter real combat output instead of existing only as copy. Runtime effects continue through `deriveCombatBuild` and the existing weapon/class-skill build model.
  - Allocation and path preview now enforce branch Keystone exclusivity with a dedicated `exclusive-choice` result. Existing class-owned weapon sectors remain non-traversable off class, existing allocations remain valid, and no save migration/schema bump was required.
  - Progression UI now labels Travel/Notable/Mastery/Keystone/Capstone roles explicitly, explains committed Keystone alternatives, and reports build-defining nodes online while preserving the existing mobile-safe branch layout.
  - Regression coverage now verifies 93 unique nodes, 105 valid edges, the 6/12/6 Mastery/Keystone/Capstone distribution, branch exclusivity, Capstone route cost, P9-B compatibility, new runtime tradeoffs, and unchanged Network Schema 1 migration behavior. Gate output: `OPERATOR_NETWORK_ARCHITECTURE_PASS schema=1 nodes=93 edges=105 outer=6 starts=3 coreWave=36 classWeapon=12 buildDefining=24`.
  - PR #160 Browser E2E `35683000757` passed full regression/production build plus desktop and mobile-landscape player journeys before merge.
  - Verified on merged main `1ad3f866b05983897ed943ab8668b2e4cc4c614a`: Browser E2E `35683161325`, Level 15 beta smoke `35683161312`, and Android beta.249 `35683161327` all passed. Android verification covered package/version/SDK/signature checks, installable APK generation, class-selection layout, mobile menu/skill hierarchy, class kit/assets, balanced render tier, touch controls, runtime combat, authored operator/enemy/weapon/refinery assets, lifecycle resume, and the Chapter 3 touch playthrough.
  - Android artifact `10675363272` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.249`, debug signing, and APK SHA-256 `30375484c164394ddc92bf9d1a6ef8ef167ddd09c0bf9c3d10e6b0cbca399f60`.
  - **Next: P9-D — Specialization integration.**

- [x] **P9-D Specialization integration** — expanded the verified Deep Operator Network from 93 to 120 authored nodes with 27 specialization-integration nodes: one LV15 entry milestone, one LV16 stage milestone, and one paid field-integration hook for each of the nine specializations.
  - Network Schema advanced to 2 while preserving legacy `allocatedNodes` / `progressionPoints` migration. LV15/LV16 milestones are contextual and zero-cost rather than persisted allocations, so existing specialization selection remains free and old builds are not silently rewritten.
  - Each specialization route anchors to an existing P9-C Mastery and gates its final one-point field node behind an authored campaign, boss, or faction milestone. Stored specialization nodes only apply while their matching specialization is active, preserving safe class/spec switching ahead of the dedicated P9-F respec pass.
  - Field-integration nodes expose real gear, crafting, faction, and Singular hooks: matching specialization gear strengthens class-skill output/recovery, matching Reconstruction work receives a 12% resource-cost reduction, active faction doctrine feeds class-skill/control economy, and class-owned Singular hardware gains an additional specialization-linked class-skill payoff.
  - Progression UI keeps the six shared branches uncluttered and surfaces the selected specialization's three-node route inside the existing specialization card flow, including LV15/LV16 state, external unlock copy, allocation cost, and locked/online status for mobile readability.
  - Regression coverage verifies 120 unique nodes, 27 specialization nodes with a 9/9/9 entry/stage/hook distribution, milestone activation, campaign/boss/faction gates, one-point hook routing, runtime effects, all four integration surfaces, inactive off-specialization stored effects, and preserved P9-A/B/C behavior.
  - Verified on main `d13e347d1090415984ea1e41a9f030517683e424`: Browser E2E `35684611813` passed desktop + mobile-landscape, Level 15 beta smoke `35684611806` passed, and Android beta.250 `35684611817` passed package/version/SDK/signature checks plus emulator runtime/touch/lifecycle and Chapter 3 playthrough QA.
  - Android artifact `10676052778` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.250`, debug signing, and APK SHA-256 `994ba1fb4b261a8dbc7b1e62b3de6c709e1cf344dab70d1a508873108d552bd4`.
  - **Next: P9-E — Planner UX.**

- [x] **P9-E Planner UX** — added a non-destructive planning layer to the verified 120-node Operator Network without changing Network Schema 2, allocation legality, or persisted save state.
  - Added class-compatible Network search across node name, description, branch, role, sector, and unlock copy, with a focused-node inspector that shows the legal path, node count, total point cost, and explicit allocation readiness before any point is spent.
  - Added canonical multi-target route planning through `operatorNetworkPlan`. Planned routes simulate the existing allocation API with an unlimited preview budget, reuse shared route nodes instead of double-counting them, preserve class arsenal/specialization/external/Keystone gates, and surface unresolved targets instead of mutating the profile.
  - Added planned-build preview math from the existing `deriveCombatBuild` path for active-weapon output, armor, movement, capacitor regeneration, class-skill power, and vacuum resistance. The planner reports total cost, current points, future-point shortfall, aggregate path nodes, and target chips while remaining session-only.
  - Progression nodes now focus/inspect on tap rather than spending immediately; allocation is an explicit `Allocate now` action when the canonical route is one node away and affordable. Planned/current-route nodes receive distinct visual treatment.
  - Mobile/controller navigation adds 48px touch navigation controls, keyboard Arrow/Home/End traversal, and Gamepad API D-pad polling for buttons 12–15. Responsive planner/search/stat layouts preserve the existing mobile-landscape Network presentation.
  - Regression coverage verifies future unaffordable route preview, shared multi-target cost deduplication, cross-class blocked targets, planner/search/before-after UI presence, responsive planned-route cues, and keyboard/Gamepad navigation. Gate output remained `OPERATOR_NETWORK_ARCHITECTURE_PASS schema=2 nodes=120 edges=132 outer=6 starts=3 coreWave=36 classWeapon=12 buildDefining=24 specialization=27` with `SAVE_DATA_MIGRATION_PASS legacy=v1/v2->v3 gearSchema=1 networkSchema=2 recovery=preserved`.
  - Verified on main `79570330e822a802b01897f9e96e5d51542af188`: Browser E2E `35711528022` passed desktop + mobile-landscape player journeys, Level 15 beta smoke `35711528019` passed the full regression/production build, and Android beta.251 `35711528052` passed package/version/SDK/signature verification plus emulator class selection, mobile menu, skill hierarchy, touch controls, runtime combat, authored assets, lifecycle resume, and Chapter 3 touch playthrough.
  - Android artifact `10687108540` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.251`, debug signing, and APK SHA-256 `f190ec39d239f87401c34c0ec346a6a051e91ff481e1022fa892b25b7dd2e91c`.
  - **Next: P9-F — Respec/migration/diversity QA.**

- [x] **P9-F Respec/migration/diversity QA** — completed the Deep Operator Network safety/experimentation pass without changing Network Schema 2 or weakening class arsenal ownership.
  - Added safe single-node refunds that refuse to orphan downstream allocations, plus full Network rebuilds that return every spent progression point. Experimentation is free through LV8; later node refunds and full rebuilds consume visible credit costs, with rebuild pricing scaling by allocated node count.
  - Added conservative save migration/repair for retired node IDs, wrong class-owned weapon sectors, incompatible specialization routes, level-invalid allocations, and duplicate exclusive choices. Removed/invalid allocation value is refunded, still-authored shared allocations remain preserved across class changes, and repaired current-version profiles are atomically rewritten after validation instead of waiting for a later autosave.
  - Added mobile-facing P9-F Recalibration controls inside the existing planner: focused-node refund, full rebuild summary, current credits, allocation count, visible rebuild cost, insufficient-credit handling, and responsive touch layout.
  - Expanded the Operator Network release gate with free-vs-high-level cost assertions, dependency-safe leaf refunds, exact full-rebuild point recovery, retired-node/current-save repair, class/spec migration refunds, and representative Vanguard/Vector/Systems runtime-build diversity. Gate output: `OPERATOR_NETWORK_ARCHITECTURE_PASS schema=2 nodes=120 edges=132 outer=6 starts=3 coreWave=36 classWeapon=12 buildDefining=24 specialization=27 p9f=respec+migration+diversity`.
  - Save migration now reports `SAVE_DATA_MIGRATION_PASS legacy=v1/v2->v3 gearSchema=1 networkSchema=2 currentNetworkRepair=refunded recovery=preserved`; UI regression verifies the P9-F recalibration controls and responsive presentation.
  - Pre-merge PR #162 Browser E2E `35714612365` passed full regression/production build plus desktop and mobile-landscape player journeys after CI caught and corrected an over-aggressive shared-allocation migration rule.
  - Verified on merged main `8675c25f896c09c7fac0a78d181499ddf715d098`: Browser E2E `35714819834`, Level 15 beta smoke `35714819857`, and Android beta.252 `35714819733` all passed. Android verification covered full production regression/build, package/version/SDK/signature checks, installable APK generation, class-selection/mobile-menu/skill hierarchy, class kit/assets, balanced render tier, touch controls, runtime combat, lifecycle resume, authored-content verification, and Chapter 3 touch playthrough.
  - Android artifact `10689023882` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.252`, debug signing, and APK SHA-256 `d177a98ce8ce20a14e2acd30760206be2ef8bf555e3fe4df82a0e0943cdab5c8`.
  - **Next: P10-A — Rules foundation.**


- [x] **P10-A Rules foundation** — completed the Crafting 2.0 legality/ownership pass on top of Gear 2.0 and the existing Reconstruction bench without adding new economy verbs yet.
  - Added a canonical crafting rules contract that owns the two modifier families (Core and Systems), the five modifier grades and their Recovery Level gates, rarity explicit-modifier budgets, Microforge grade ceilings, and base-frame legal pools.
  - Base frames now explicitly own the list of modifier candidates shown to players. Recovery Level and Microforge tier jointly determine the current grade ceiling, rarity owns the explicit-modifier count, conflicts/installed/locked states are visible, and Singular packages remain fixed-reference pools.
  - Reconstruction add/reroute/recalibrate now consume the same canonical legality function used by the Crafting UI, so player-visible outcomes and runtime candidates cannot silently diverge.
  - Added a mobile-readable **P10-A // CRAFTING CONTRACT** surface in the Crafting tab that explains Base → Pool, Rarity → Count, Recovery + Microforge → Grade, shows Core/Systems roles, and lists every frame option as ready, installed, conflicting, Recovery-locked, or fixed-package before salvage is spent.
  - Added `CRAFTING_RULES_FOUNDATION_PASS families=2 grades=5 rarity=field/refined/prototype/singular pool=base-owned compatibility=visible` plus updates to the existing stat-registry and affix-ownership architecture gates so those tests follow the new canonical module instead of requiring legacy ownership inside `reconstruction.ts`.
  - PR #164 Browser E2E `35717722624` passed full regression/production build plus desktop and mobile-landscape player journeys after CI caught and corrected two stale architecture assertions that still pointed at the pre-P10-A Reconstruction ownership path.
  - Verified on merged main `71de480d1aa46def072d37ef6555f51ac18e9f40`: Browser E2E `35717959748`, Level 15 beta smoke `35717959722`, and Android beta.253 `35717959724` all passed.
  - Android verification covered the full web regression/build, native Android project generation, installable debug APK build, package/version/SDK/signature checks, emulator runtime/touch/lifecycle smoke, authored-content checks, and the complete Chapter 3 touch playthrough. Artifact `10689668066` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.253`, debug signing, and APK SHA-256 `8f6960748754f9e07c867c432df63eaf5f500e07d56c83cf7c8e94def7c48dda`.
  - **Next: P10-B — Verbs/materials.**


## P10 — Crafting 2.0 // Reconstruction Economy

- [x] **P10-B Verbs/materials** — Reconstruction now has an explicit nine-verb contract: Improve, Add, Remove, Reroute, Replace, Lock, Elevate, Socket, and Extract.
  - Added runtime **Remove** for explicit modifiers, reopening rarity budget without refunding crafting materials; fixed Singular packages reject removal.
  - Split crafting resources into ordinary salvage (**Frame Alloy / Circuit Stock / Precision Components**) and one chase-control resource (**Quarantined Trace**) without introducing a parallel wallet or bypassing P10-A legality.
  - **Replace** now clearly represents protected same-family recalibration and consumes one Quarantined Trace at Microforge T2 while the selected family remains locked.
  - **Elevate** keeps normal lower-grade calibration on ordinary salvage, but the G4 → G5 Prime step consumes one Quarantined Trace.
  - Crafting UI exposes common-vs-chase paths plus all nine verbs on the mobile Reconstruction screen; Augment install/remove language is now explicitly Socket/Extract.
  - Deterministic regression covers the verb registry, material tiers, Prime elevation chase cost, protected Replace chase cost, runtime Remove, Singular rejection, and mobile Crafting vocabulary/layout.
  - PR #166 Browser E2E `35720177872` passed desktop and mobile-landscape on head `e1b59f8ab3b6842053d1aac0835023c8c8212680`.
  - Verified on merged gameplay source `93cacfac5073c7799ad5912da59bdfabe79c6345`: Browser E2E `35720458948`, Level 15 beta smoke `35720458990`, and Android beta.254 `35720458933` all passed.
  - Android artifact `10690709426` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.254`, debug signing, native emulator runtime/touch/lifecycle/Chapter 3 QA, and APK SHA-256 `a87141dc6711335d00f6f772e6ad1cfef1a5b3a01e901d1c0540aaaeeee096e5`.
  - **Next: P10-C — Control vs risk.**

- [x] **P10-C Control vs risk** — Reconstruction now exposes escalating deterministic control alongside optional bounded risk without weakening the P10-A legality contract or P10-B verb/material ownership.
  - Added exact-target **Precision Add** and protected same-family **Replace** choices from the visible base-owned legal pool. Premium deterministic control requires Microforge T2 and one Quarantined Trace; illegal, conflicting, installed, Recovery-locked, rarity-capped, or wrong-family targets are rejected before resources are spent.
  - Family locking remains authoritative: the selected Core or Systems family cannot be replaced, while protected replacement guarantees the named legal target in the opposite unlocked family.
  - **Elevate** now lets players choose any legal grade above the current modifier up to the lower Recovery Level / Microforge ceiling instead of only stepping one grade at a time. Any path entering G5 Prime still consumes one Quarantined Trace.
  - Added persisted per-frame **Craft Stability** with legacy-save normalization to 100. Controlled frame/elevation/protected work can recover bounded stability; optional volatile Replace/Elevate operations drain 20 stability whether they land or fail and derive a visible deterministic 60%–90% success chance from current stability.
  - Volatile control never bypasses base pools, family rules, rarity budgets, Recovery gates, Microforge gates, or the G5 Trace requirement. Volatile Replace trades its protected Trace cost for uncertainty + stability loss while preserving the chosen family lock.
  - Mobile Reconstruction UI now shows current stability, volatile success chance, premium-control explanation, exact legal Precision Add buttons, direct elevation-grade choices, and protected-vs-risk Replace targets with responsive touch layouts.
  - Added `CRAFTING_CONTROL_RISK_PASS targets=legal lock=protected elevation=choice volatile=stability save=persisted` to the production build chain, covering exact-target legality, pre-spend rejection, family protection, grade ceilings, Prime cost, volatile bounded outcomes, persistence, and mobile UI vocabulary/layout.
  - PR #168 Browser E2E `35722370046` passed desktop and mobile-landscape including full regression/production build and live player journeys on head `593e553a538c920b34d07125aaa38c296b28c968`. Earlier PR attempts correctly caught a misplaced stability normalization field and float-exact test assertions; both were fixed before the green run.
  - Verified on merged gameplay source `c9a2dcde2be6a3520f015f5397bde7de90a087e8`: Browser E2E `35722602499`, Level 15 beta smoke `35722602553`, and Android beta.255 `35722602595` all passed.
  - Android artifact `10691604398` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.255`, debug signing, package/version/SDK/signature verification, native emulator runtime/touch/lifecycle/Chapter 3 QA, and APK SHA-256 `bbc6047f49eca519daac4b78bc05e2342ebbc35b0ba831cd75ceda77191a537d`.
  - **Next: P10-D — Build integration.**

- [x] **P10-D Build integration** — connected Reconstruction legality and rewards to class-owned weapon families, specialization field recipes, Equipment Quality, Augments, and fixed Singular packages without weakening the verified P10-A/P10-B/P10-C contracts.
  - Class-family ownership is now authoritative inside the canonical crafting pool and runtime Reconstruction path. Off-class weapon families surface as class-locked, cannot spend resources on Improve/Add/Remove/Reroute/Replace/Elevate/Socket, and still permit Augment extraction so class changes never trap utility hardware.
  - Active LV16 specialization field-integration hooks now expose authored legal modifier recipes and slot-compatible Augment recommendations. Matching frames, recipe targets, and recommended Augments receive the existing 12% resource discount while still obeying base pools, rarity budgets, Recovery/Microforge gates, conflicts, and hard arsenal ownership.
  - Equipment Quality remains a frame-only axis: Improve changes inherent frame identity but does not scale explicit modifier grades or Augment strength. Compatible Augments stay independent utility hardware.
  - Singular equipment keeps its fixed authored signature/modifier package. Improve plus compatible Augment socket/extract remain legal; random or targeted explicit-package edits remain blocked.
  - Mobile Reconstruction UI now explains class-family pool ownership, specialization recipes, Quality/Augment separation, fixed Singular rules, recipe-tagged legal targets, specialization discounts, and the off-class Reconstruction lock.
  - Added the production regression gate `CRAFTING_BUILD_INTEGRATION_PASS class=owned recipes=4 augments=1 quality=frame singular=fixed`; existing crafting rules/control, save migration, and Operator Network gates remained green.
  - Verified on main gameplay source `d6f591acca0ba68d8561415c44c3e4fdb4cf6818`: Browser E2E `35725556424` passed desktop + mobile-landscape full regression/production build, Level 15 beta smoke `35725556168` passed, and Android beta.256 `35725556220` passed production build plus native install/package/version/SDK/signature, touch/runtime/lifecycle, and Chapter 3 playthrough QA.
  - Android artifact `10693009413` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.256`, debug signing, and APK SHA-256 `a7b1dab1c971f89d01377f88165ef12b20e16047a9ba6a4dd2a6399b057d6aa6`.
  - **Next: P10-E — Crafting UX/trust.**

- [x] **P10-E Crafting UX/trust** — Reconstruction now uses a confirm-first trust contract so selecting a craft never spends salvage immediately.
  - Every craft review shows the exact resource cost, affordability, guaranteed outcome, possible outcome space, legality exclusions, bounded risk, and a before/after frame-state summary before confirmation. Volatile elevation/replacement shows success and failure branches plus stability loss without disclosing the deterministic roll in advance.
  - Confirmed actions now persist a bounded 12-entry craft receipt history in the existing v3 operator save, recording item, action, exact cost, outcome, before/after state, and whether the attempt was volatile. Legacy/current saves normalize safely without a version bump.
  - Added explicit salvage-loop context to the mobile Reconstruction bench, including common stock, Quarantined Trace chase-control stock, non-refund rules, and the Deploy → bank salvage → review → confirm → iterate loop. The Reconstruction resource ribbon now includes Quarantined Trace.
  - Existing P10-A–D legality remains authoritative: base-frame pool, rarity budget, Recovery Level, Microforge tier, modifier conflicts, class-family ownership, specialization integration, fixed Singular packages, and Augment rules are unchanged and cannot be bypassed by the review layer.
  - Added the production regression gate `CRAFTING_UX_TRUST_PASS preview=confirm-first exact-cost=result-space before-after history=12 salvage-loop=visible`, covering exact-cost parity, insufficient-salvage disclosure, volatile result-space disclosure, Singular exclusions, bounded/persisted craft receipts, and mobile trust vocabulary/layout.
  - PR #171 Browser E2E `35741898004` passed the full regression/production build plus desktop and mobile-landscape player journeys before merge.
  - Verified on merged gameplay source `c442312be14a5dba6ebcccf828fe5106dbbfe15a`: Browser E2E `35742206975` passed desktop + mobile-landscape, Level 15 beta smoke `35742206821` passed, and Android beta.257 `35742206891` passed production build, native project generation, debug APK package/version/SDK/signature verification, emulator runtime/touch/lifecycle smoke, authored-content checks, and Chapter 3 touch playthrough.
  - Android artifact `10700986301` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.257`, debug signing, and APK SHA-256 `a8021c5539e263b7b233ab0f5a20125b0f58b9cf50bf67f4b60435a2ad3e8a4f`.
  - **Next: P10-F — Economy + touch QA.**


- [x] **P10-F Economy + touch QA** — closed Crafting 2.0 with a deterministic pacing/input gate instead of adding another crafting verb.
  - Added a campaign-to-endgame economy regression that follows a crafting-oriented start through deep salvage, verifies Microforge T1 after one clear and T2 after two, confirms the first eligible anomaly banks exactly one Quarantined Trace, and verifies later ordinary settlement does not repeat that chase drop.
  - Added fixed-risk T1–T12 Operation Directive simulation using the real scaling and settlement paths. Common material rewards stay non-decreasing through T12 while Quarantined Trace remains outside the ordinary Directive material multiplier.
  - Reconstruction affordability is now release-gated against a representative three-action ordinary package. Verified P10-F output was `CRAFTING_ECONOMY_TOUCH_PASS microforge=T2 campaignTrace=1 guaranteedTraceBudget=6 t1Credits=474 t12Credits=792 ordinaryPackage=288cr input=dpad+a+b touch=48px`.
  - Chase pressure is explicitly covered: the baseline guaranteed campaign supply is six deliberate Trace opportunities (one anomaly, three authored story finales, and +2 from The Black Lattice), while Precision Add, controlled G5 elevation, and protected Replace each continue to consume one Trace. Fixed-risk T1–T12 common-material clears mint zero Trace.
  - Reconstruction now has menu-level controller support matching the Network planner: D-pad directions cycle enabled craft controls, A activates the focused action, and B backs out of a pending confirm-first review without spending salvage. Native button semantics remain intact for keyboard/touch.
  - Added a compact **P10-F // TOUCH + CONTROLLER** contract to the Reconstruction surface, visible focus treatment, `touch-action: manipulation`, and 48px minimum coarse-pointer craft targets.
  - The first CI attempt correctly exposed a QA-harness assumption that rotating salvage would always remain present after rare-derelict rotation began; the harness was corrected to validate a real non-anomaly post-anomaly contract without changing gameplay/economy values.
  - Verified on main gameplay source `3849eeb3417e41523b59797708d4b5cb8f449670`: Browser E2E `35744622874` passed full regression/production build plus desktop and mobile-landscape journeys; Level 15 beta smoke `35744622858` passed; Android beta.259 `35744622900` passed production build, package/version/SDK/signature checks, native emulator runtime/touch smoke, and the Chapter 3 touch playthrough.
  - Android artifact `10702833136` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.259`, debug signing, and APK SHA-256 `8bf25f6932ba01e74e2ea5629b55c8aea347b8c0630f6a83f22da747cfcc91d2`.
  - **Next: P11-A — Architecture/migration.**

## P11 — Ship Systems 2.0

- [x] **P11-A Architecture/migration** — replaced the old hard-coded two-tier prototype contract with an explicit Ship Systems 2.0 schema covering all eight existing systems across six major tiers while preserving every live Tier 1/2 cost and gameplay effect.
  - Added schema version 2, six-tier records, per-system ownership/dependency metadata, steeply escalating resource curves, and explicit campaign/faction/boss/Operation Directive/Quarantined Trace gates. Higher tiers depend on the paired system's previous tier so the graph has no same-tier deadlocks.
  - Reactor, Vector Drive, Armor Locker, Cargo Recovery Grid, Long-Baseline Sensors, Microforge, Trauma Bay, and Support Drone Rack keep their existing IDs and paid Tier 1/2 value. Tier 3–6 blueprints are visible but implementation-locked until P11-B/P11-C so architecture work cannot grant unfinished combat power.
  - Legacy campaign and atomic saves without the ship-system schema marker normalize into schema v2, preserve valid paid Tier 1/2 levels, clamp impossible pre-schema levels back to the old ceiling, revalidate the canonical campaign, and rewrite the repaired atomic envelope without deleting player progression.
  - The Systems hub now shows Tier X/6, current installed effect, the next mapped blueprint, and unmet gate labels; future tiers are disclosed as queued rather than masquerading as purchasable upgrades.
  - Added the production regression gate `SHIP_SYSTEMS_ARCHITECTURE_PASS` plus save-migration assertions covering all eight systems, contiguous six-tier routes, escalating costs, dependency edges, campaign/faction/boss/Directive/Trace gates, exact Reactor Tier 1/2 price/effect compatibility, future-tier spend lockout, and legacy paid-tier preservation.
  - PR #172 Browser E2E `35747372577` passed desktop and mobile-landscape, including the full regression/production build and player journeys, on tested head `b5f194f044a3e9b3ef3f5e869bc1cae7c9bf537d`.
  - Verified on merged gameplay source `6b77b21207debed368242c22ebf0441f34014bd3`: Browser E2E `35747683537`, Level 15 beta smoke `35747683572`, and Android beta.260 `35747683631` all passed.
  - Android artifact `10703872967` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.260`, debug signing, package/version/SDK/signature verification, native emulator runtime/touch/lifecycle/Chapter 3 QA, and APK SHA-256 `b98802bf0476cd8aa96ad2ff333638c8a0a0fcd5dece25510845c3e8b3332453`.
  - **Next: P11-B — Engineering wave.**


- [x] **P11-B Engineering wave** — commissioned the four Engineering branches from the P11-A six-tier schema: Reactor Bus, Vector Drive, Deployment Armor Locker, and Long-Baseline Sensors now have authored Tier 3–6 combat effects while preserving the exact live Tier 1/2 values and prices.
  - Reactor scales from the legacy +24 capacitor/+20% regeneration ceiling into authored reserve/regeneration tiers, then adds controlled class-skill capacitor-cost reduction at T4–T6 rather than another generic damage multiplier.
  - Vector Drive extends movement and low-g control on a bounded curve through T6, preserving the existing T1/T2 handling values and keeping its higher route dependent on Cargo Grid progress.
  - Deployment Armor Locker grows starting armor from the legacy +20 ceiling to +80 at T6, improving deployment durability without changing health, enemy damage, or boss mechanics.
  - Long-Baseline Sensors extends projectile velocity and Sensor Spike power through T6; late tiers add modest global penetration as a readable firing-solution payoff instead of raw weapon damage.
  - Added per-system commissioning metadata so Engineering T3–T6 tiers are purchasable only when their existing P11-A gates are met, while Cargo Grid, Microforge, Trauma Bay, and Support Drone Rack T3–T6 remain implementation-locked for P11-C.
  - Systems UI copy now explicitly distinguishes commissioned Engineering payoff from the still-mapped support wave, and each next-tier card continues to expose exact effect text, remaining gates, and discounted resource cost before purchase.
  - Expanded `SHIP_SYSTEMS_ARCHITECTURE_PASS` to verify Engineering commissioning state, support-wave lockout, exact legacy compatibility, REP-discounted T3 pricing, cross-system dependencies, and concrete T2/T6 combat-build deltas for Reactor/Drive/Armor/Sensors.
  - PR #173 Browser E2E `35752092613` passed desktop + mobile-landscape on tested head `0ba7a410d185ca5220bc1e4152ecd5b84cbf96ee`.
  - Verified on merged gameplay source `ec2b554ef28cc6a3cfab63d8f8583b4b297f1e33`: Browser E2E `35755624362`, Level 15 beta smoke `35755624299`, and Android beta.261 `35755624320` all passed.
  - Android artifact `10708167462` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.261`, debug signing, package/version/SDK/signature verification, native emulator runtime/touch/lifecycle/Chapter 3 QA, and APK SHA-256 `062ec742343c74f90a849dea8a7e7bb62e716c6737c14eb6a628774609172582`.
  - **Next: P11-C — Support wave.**

- [x] **P11-C Support wave** — commissioned Cargo Recovery Grid, Microforge, Trauma Bay, and Support Drone Rack Tier 3–6 on the verified Ship Systems 2.0 graph while preserving every Tier 1/2 cost, effect, dependency, and progression gate.
  - Cargo Recovery Grid now extends the legacy +12%/+24% salvage yield into +36%, +48%, +60%, and +72% at T3–T6. The same settlement multiplier continues to apply only to ordinary salvage resources; Quarantined Trace remains outside the cargo-yield multiplier.
  - Microforge keeps the existing T1/T2 reconstruction capability ceiling intact—quality, grade, targeting, recalibration, and socket legality do not silently expand past the authored Crafting 2.0 rules. T3–T6 instead improve reconstruction credit efficiency to 26%, 32%, 38%, and 45% discounts while retaining the T2 precision controls.
  - Trauma Bay extends the preserved +8/+16 maximum-health prototype values to +24, +32, +40, and +48 maximum health at T3–T6 without changing enemy damage, boss mechanics, or armor behavior.
  - Support Drone Rack preserves the T1 relay-drone activation and T2 Arc Tap cooldown behavior, then scales relay damage and Arc Tap support through T6. T6 reaches 2.2x relay damage, 22% Arc Tap cooldown reduction, and +20% Arc Tap power.
  - The Systems hub now presents commissioned support-system field/economy payoff before purchase alongside the existing exact gates and discounted resource costs; no support tier is left behind placeholder blueprint copy.
  - Expanded `SHIP_SYSTEMS_ARCHITECTURE_PASS` to cover P11-C commissioning state, no-placeholder payoff text, REP-discounted T3 support pricing, the existing dependency graph, preserved Cargo/Microforge/Trauma/Drone T1/T2 behavior, and concrete T6 support outcomes. The first PR run correctly exposed a test-fixture setup mistake where three support systems were still seeded at Tier 0; the fixture was corrected without changing gameplay values.
  - PR #174 Browser E2E `35758926373` passed desktop + mobile-landscape, including the full regression/production build and player journeys, on tested head `846a73c8eb041ec63187d925c7c59fd656233c58`.
  - Verified on merged gameplay source `6ab973b3be6c74c5fbbfa2771d5852fb9297d686`: Browser E2E `35759216315`, Level 15 beta smoke `35759216184`, and Android beta.262 `35759216303` all passed.
  - Android artifact `10709637444` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.262`, debug signing, package/version/SDK/signature verification, native emulator runtime/touch/lifecycle/Chapter 3 QA, and APK SHA-256 `07e2aaa63c9215ba9c8d61672f7978c679ea9ae33294b8546588b6924d39eff2`.
  - **Next: P11-D — Advanced specialization.**


- [x] **P11-D Advanced specialization** — added one mutually exclusive late-game ship doctrine slot on top of the verified six-tier Engineering + Support foundation, with explicit prerequisites, exact resource costs, before-install payoff previews, save migration, and bounded bonuses that supplement rather than replace class identity.
  - Added three authored high-tier packages: Heliostat **Hot-Bus Mesh** (Reactor/Fabrication/Drone T5 route), Meridian **Continuity Bulkhead** (Armor/Medical T5 route), and Long Arc **Farline Recovery** (Drive/Cargo/Sensors T5 route). Each also requires its faction at REP 14 plus Directive Tier 6.
  - Package installation is permanent and mutually exclusive for the save. The selected package spends the exact displayed Credits/materials/Quarantined Trace cost; all other packages become visibly locked.
  - Package effects are intentionally narrow: Hot-Bus adds a small capacitor/skill-efficiency/relay layer, Continuity adds modest armor/health reserve, and Farline adds modest movement/projectile/penetration handling. None bypasses class-owned weapon families, boss mechanics, or the existing system dependency graph.
  - Advanced specialization state is persisted in ship-system schema v3. Migration preserves schema-v2 Tier 3–6 purchases from P11-C, valid specialization IDs survive normalization, and unknown IDs safely clear to an empty slot.
  - The Ship Systems screen now exposes all three package prerequisites, live satisfied/unsatisfied state, full install cost, payoff text, selected package, and mutual-exclusion lock state in a mobile-responsive package grid.
  - Expanded `SHIP_SYSTEMS_ARCHITECTURE_PASS` with schema-v2 migration preservation, package uniqueness, prerequisite/cost gating, insufficient-resource handling, exact spend, mutual exclusion, and concrete combat-build effect assertions.
  - Verified on gameplay source `318ad59bd9603a2a35d2219763bd05fa2ca236a2`: Browser E2E `35762002336` passed desktop + mobile-landscape full regression/production build and live player journeys; Level 15 beta smoke `35762002396` passed; Android beta.266 `35762002329` passed full web regression/build, native Android project generation, APK package/version/SDK/signature verification, emulator runtime/touch smoke, and the full Chapter 3 touch playthrough.
  - Android artifact `10710637296` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.266`, debug signing, and APK SHA-256 `5114c19009cf30fe9809939f793a05b17465b30d924b2ddc5be2271d2f74b5f7`.
  - **Next: P11-E — Physical payoff.**


- [x] **P11-E Physical payoff** — major ship upgrades now read as physical changes to the Quiet Signal instead of only numerical tier increases: every system has a six-state hardware identity, active machinery animation, system-specific commissioning audio, and a focused skippable upgrade ceremony.
  - Added a shared physical-presentation contract for all eight ship systems with authored ship location, hardware identity, mechanism silhouette, audio profile, and one distinct hardware state for every Tier 1–6 milestone; Tier 0 remains an explicit uncommissioned frame.
  - The Systems screen now includes a mobile-responsive **Physical Systems Bay** where Reactor, Drive, Armor, Cargo, Sensors, Microforge, Trauma Bay, and Drone Rack visibly fill out their six-stage hardware stack as the save progresses. High tiers receive bounded active-machinery motion, and reduced-motion preferences disable those animations.
  - Successful major-tier purchases trigger a short Web Audio commissioning sequence tuned per system family plus a touch-fast modal that identifies the installed hardware, ship location, new tier/state, and resulting payoff. Advanced specialization installs use the same ceremony language without adding a second persistent progression layer.
  - No new asset dependency or runtime pool was introduced: physical states are lightweight CSS/DOM presentation and synthesized audio, keeping the existing mobile render/performance budgets intact.
  - Expanded `SHIP_SYSTEMS_ARCHITECTURE_PASS` with exact eight-system presentation coverage, six unique physical states per system, stable Tier 0/Tier 1/Tier 6 resolution, future-tier clamping, and distinct mechanism silhouettes.
  - PR #175 Browser E2E `35766126871` passed desktop + mobile-landscape full regression/production build and live player journeys on tested head `3ad3d31d13132b110cb2aa397b9be5a01331876a`.
  - Verified on merged gameplay source `e2b876d95219e438f2c3ca7fb4a35e1d21c170a1`: Browser E2E `35766398218`, Level 15 beta smoke `35766398284`, and Android beta.267 `35766398195` all passed.
  - Android artifact `10711899512` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.267`, debug signing, package/version/SDK/signature verification, native emulator install/launch/runtime/touch/lifecycle/authored-asset/Chapter 3 QA, and APK SHA-256 `bea8f7d2ca76ea500bfff384d81b48dd1593e6644f621c27b74d9a482ceb66f3`.
  - **Next: P11-F — Economy/balance QA.**


- [x] **P11-F Economy/balance QA** — closed Ship Systems 2.0 with a deterministic late-game economy and power-boundary gate, and fixed the one progression blocker that gate exposed without flattening the existing six-tier costs or dependency graph.
  - Added `SHIP_SYSTEMS_ECONOMY_BALANCE_PASS` and wired it into the production build. It verifies all eight six-tier cost curves, REP12+ discounts, dependency-route Trace pressure, advanced-specialization reachability, T12 reward pacing, class-identity preservation, and unchanged boss/encounter scaling at maximum ship progression.
  - The audit confirmed the full fleet remains aspirational: Tier 4–6 system completion consumes 48 Quarantined Traces before specialization, individual Tier 6 dependency routes consume 9–10 Traces, and the advanced packages remain beyond the six guaranteed campaign Traces.
  - To prevent that authored economy from becoming impossible after campaign guarantees are exhausted, T6+ **deep Command Target Directives** now recover exactly one Quarantined Trace. Pre-T6, elite-led, and safe-extraction Directives do not; the reward is disclosed in the Directive preview before deployment and never scales into bulk currency at higher tiers.
  - Credit pacing remains bounded: one T12 deep command clear does not purchase a Tier 6 system outright, while a short sequence of endgame clears produces meaningful progress. Cargo still multiplies common salvage only; the dedicated Trace award remains outside Cargo yield scaling.
  - Maximum Ship Systems 2.0 progression still cannot grant off-family weapon damage/handling, class resonance, class specialization/overclock state, or class mechanics other than the authored relay-drone support lane. The same T12 command contract resolves identical operation tier, damage, threat, protocol, event, reserve, and encounter pressure with or without maxed ship systems.
  - The first PR run correctly exposed a QA-model assumption: Microforge and Drone Rack Tier 6 routes traverse a three-system dependency chain and therefore cost 10 route Traces instead of the 9 used by the other six routes. The gate was corrected to model the authored graph rather than flattening it.
  - PR #176 Browser E2E `35770858765` passed desktop + mobile-landscape on final tested head `ca4ae8371bc1a4fa330d32ea69b054fadea1ee4c`, including the full regression/production build and live player journeys.
  - Verified on merged gameplay source `640deaa68ec9ac3bbd6278f14d0170bb5a9517d7`: Browser E2E `35771141433`, Level 15 beta smoke `35771141431`, and Android beta.268 `35771141425` all passed.
  - Android artifact `10713994152` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.268`, debug signing, package/version/SDK/signature verification, native emulator runtime/touch/lifecycle/Chapter 3 QA, and APK SHA-256 `eea1152578dd1992c3fbfaa1b520a24fe518ec394b65ccb0befd505c147af925`.
  - **Next: P12-A — Weapon audio.**



## P12 — AAA Combat Feel

- [x] **P12-A Weapon audio** — replaced the old single-oscillator weapon cues with distinct layered synthesized signatures for the three class-owned weapon families while preserving combat timing, weapon stats, input behavior, and the hard arsenal lock.
  - **Systems / Carbine** now combines a sharp mechanical action, compact discharge/body, and short near/mid/far tails tuned for rapid repeat fire. Mid tails play every second shot and far tails every fourth shot to bound mobile audio-node pressure.
  - **Vanguard / Breacher** now uses a heavier chamber/mechanical action, low-frequency body, and full near/mid/far tails on every shot so close-range fire reads as a large physical impulse.
  - **Vector / Rail Lance** now uses a higher-frequency coil action, split electromagnetic/body discharge, and long near/mid/far tails on every shot for a precise high-energy signature.
  - Added deterministic bounded repeat variation for pitch and gain so repeated shots avoid obvious identical playback without introducing nondeterministic QA behavior.
  - Added a shared dynamics-compressor output stage and per-layer low-pass shaping. Each shot schedules at most seven lightweight Web Audio nodes; no downloadable audio asset pack or new runtime dependency was added.
  - Added production regression gate `WEAPON_AUDIO_PASS families=3 maxLayers=7 tails=near/mid/far repeat=bounded carbine=decimated`, covering layer ownership, tail ordering, mobile node budget, bounded variation, deterministic cycling, distinct family signatures, and Carbine tail decimation.
  - PR #178 Browser E2E `35777398230` passed desktop + mobile-landscape on tested head `e368fe3b3ab5d7d58efd97b37aa2d2a0d0f74c1c`.
  - Verified on merged gameplay source `50ef94af14805eb9de6bda5c0129c12556817219`: Browser E2E `35777684644`, Level 15 beta smoke `35777684666`, and Android beta.269 `35777684680` all passed.
  - Android artifact `10716801744` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.269`, debug signing, package/version/SDK/signature verification, native emulator runtime/touch/lifecycle/Chapter 3 QA, and APK SHA-256 `172ffcd4d8c92ef5a8a34badb695295f7fc78a0c9d7a61340f4e0e31af6c3cc1`.
  - **Next: P12-B — Impact/environment audio.**

- [x] **P12-B Impact/environment audio** — replaced the remaining generic combat hit feedback with material-aware impacts and a live environment acoustic model while preserving P12-A weapon identity, combat timing, damage, AI, and input behavior.
  - Added six bounded synthesized impact families: **armor**, **machinery**, **ice**, **steel**, **glass**, and **field**. Ballistic enemy hits now distinguish armored versus exposed contact, ability/system damage reads as field contact, and world collisions route from the actual struck object's material/kind plus authored location context.
  - Machinery interactions cover powered/control hardware such as conduits, coolant, controls, salvage nodes, and anchors; Ice Mine/Cryo Reserve surfaces gain brittle ice character; light structures in glass-heavy habitats/yards gain glass transients; remaining structural contact resolves to steel.
  - Added a shared live acoustic environment model driven by the player's current mission location and pressure sector. Interior spaces keep stronger room tails, open spaces shorten/reduce tails, leaking/decompressing states progressively reduce airborne gain and high-frequency detail, and vacuum heavily attenuates airborne tails/high frequencies to a residual structural/suit-conduction read.
  - The acoustic treatment applies to both the new impact families and the existing P12-A weapon mechanical/discharge/tail layers, so pressure loss changes the whole combat sound field instead of only playing a one-off vacuum cue. UI feedback remains outside the environment filter so controls stay readable.
  - Mobile cost remains bounded: each impact schedules at most three lightweight Web Audio layers, uses the existing compressor/output path, and adds no downloadable audio pack or runtime dependency.
  - Added production regression gate `IMPACT_AUDIO_PASS surfaces=6 maxLayers=3 environments=interior/open/pressure/vacuum`, covering impact-family uniqueness, layer/gain/duration budgets, material/location routing, interior/open behavior, progressive pressure attenuation/low-pass response, and vacuum tail limits.
  - PR #179 Browser E2E `35784774204` passed desktop + mobile-landscape on tested head `b64da8921cca96bd431621a24024a23d43ade859`, including `WEAPON_AUDIO_PASS` and the new `IMPACT_AUDIO_PASS` production gate.
  - Verified on merged gameplay source `6de3866c639738978913b5fa3de2c58e17c2f2a8`: Browser E2E `35784924206`, Level 15 beta smoke `35784924035`, and Android beta.270 `35784924062` all passed.
  - Android artifact `10719980945` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.270`, debug signing, package/version/SDK/signature verification, native emulator runtime/touch/lifecycle/Chapter 3 QA, and APK SHA-256 `f50a796365eaacf3ff1820799f29a7f040ee9c90b13ef34e1baa1237d49f7678`.
  - **Next: P12-C — Information mix.**

- [x] **P12-C Information mix** — expanded the existing P12-A/P12-B synthesized combat audio pipeline into a bounded priority-aware information mix without changing combat timing, damage, targeting, class ownership, or the verified pressure-acoustic model.
  - Added class-family reload and vent Foley for Systems/Carbine, Vanguard/Breacher, and Vector/Rail Lance, including distinct start/completion signatures so weapon handling reads through sound rather than a shared generic cue.
  - Added three authored skill-audio signatures per class. Vanguard skills bias toward heavy low mechanical impacts, Vector skills toward precise high-energy coil motion, and Systems skills toward compact electronic/control signatures while staying inside the same effects-volume and acoustic treatment path.
  - Added enemy, elite, boss-telegraph, and boss-phase audio tiers. Boss telegraphs/phase transitions are critical-priority events; ordinary/elite attack tells are important-priority events.
  - Added per-category Web Audio buses and short priority ducking windows. Important tells make room over weapons/impacts; critical boss information ducks them harder while leaving threat and UI confirmation at full mix gain.
  - Added deterministic mobile voice protection: 18 normal concurrent voices, a 3-voice critical reserve, and at most 5 concurrent tail voices. Weapon tails are treated as background voices so lower-value ambience yields before combat information.
  - Combat feedback now detects reload/vent start and completion, fresh hostile telegraphs, boss pattern changes, and boss phase transitions from authoritative simulation state. Class skill activation routes to the selected class's own audio family.
  - Added production regression gate `INFORMATION_AUDIO_PASS`, covering distinct weapon Foley, all nine class-skill profiles, threat priorities, layer/gain bounds, voice budgets, and important/critical mix-ducking behavior.
  - PR #180 Browser E2E `35786697567` passed desktop + mobile-landscape on tested head `ace8d6227f75511625c4c9f5994ce8f5911b8647`, including the full regression/production build.
  - Verified on merged gameplay source `744141a82507962ba9f87c827d3b93eb9f5e0e8a`: Browser E2E `35786928547`, Level 15 beta smoke `35786928506`, and Android beta.271 `35786928605` all passed.
  - Android artifact `10720707170` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.271`, debug signing, package/version/SDK/signature verification, native emulator runtime/touch/lifecycle/Chapter 3 QA, and APK SHA-256 `59a960c986cebe844e5c2236bf5f179a5e78917cd27b9f6127deb552f75244c8`.
  - **Next: P12-D — Player handling animation.**

- [x] **P12-D Player handling animation** — gave each class a distinct authored combat-handling language while preserving the verified class arsenal lock, weapon cadence, damage, heat, and simulation timing.
  - Added shared data-driven player handling profiles for **Vanguard**, **Vector**, and **Systems** with distinct upper-body stance, gait, aim lean/lift, recoil weight, thermal strain, charge posture, and dodge weight. Vanguard reads planted/heavy, Vector reads linear/precision, and Systems reads mobile/controlled.
  - The articulated operator rig now blends class stance and movement-relative aim offsets with the existing weapon handling profiles. Recoil remains synchronized to the authoritative weapon-flash/handling state, while reload motion continues to respect mag-swap, chamber-feed, and coil-index identities.
  - Added presentation-only Rail charge posture driven by held FIRE between committed shots. It does not delay or reschedule projectiles. Venting, high-heat/overheat strain, hit reaction, dodge weight, locomotion, idle, and down states remain simulation-driven and deterministic.
  - The procedural fallback now receives the same handling signals so class stance/aim/charge/thermal/dodge language does not disappear if an authored operator asset is unavailable.
  - Runtime QA telemetry now exposes the active class stance and blend channels for move, aim, recoil, reload, charge, vent, overheat, dodge, and hit. Existing authored-operator browser verification was expanded to validate those channels and the new charge/overheat states.
  - Added production regression gate `PLAYER_HANDLING_ANIMATION_PASS stances=3 charge=rail-only overheat=readable dodgeWeights=3`, covering class silhouette separation, bounded recoil/dodge/aim values, Rail-only charge, overheat response, and action blend normalization.
  - PR #181 Browser E2E `35789334050` passed desktop + mobile-landscape on final tested head `acec6aabb54f54d70a60f4867142ac9d6189d3a7`, including the full regression/production build and live authored-operator runtime verification.
  - Verified on merged gameplay source `ddc032f44124137af34bb9c56260f08d04232e58`: Browser E2E `35789553411`, Level 15 beta smoke `35789553447`, and Android beta.272 `35789553404` all passed.
  - Android artifact `10721577180` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.272`, debug signing, package/version/SDK/signature verification, native emulator runtime/touch/lifecycle/authored-content/Chapter 3 QA, and APK SHA-256 `308e014904ff88d52c696112909a865f9d158f1a748a1925b7b244c3c03974ec`.
  - **Next: P12-E — Skill/damage animation.**

- [x] **P12-E Skill/damage animation** — added authored class-skill motion language and stronger damage reactions as a presentation-only layer, preserving combat timing, damage, targeting, class ownership, and deterministic enemy state.
  - Added nine data-driven skill animation profiles across Vanguard, Vector, and Systems. Every class-owned skill now has distinct anticipation, action, recovery, cancel-window, torso, arm, hip, and weapon-socket posing tuned for mobile readability and responsiveness.
  - Soft visual cancels from dodge/reload/vent remain locked until the authored cancel window; hard hit/death reactions can interrupt immediately. These windows only control pose blending and do not delay, reschedule, or alter authoritative skill execution.
  - Added direct-hit, sustained-stagger, and armor-break reaction signals for enemies. Authored rigs receive torso/arm/socket reactions, while procedural fallbacks receive bounded body/head response so combat feedback remains readable even when an authored asset is unavailable.
  - Enemy reaction triggers are derived from already-authoritative durability, armor, stagger, and death state. No damage, AI, status, or encounter simulation rules were changed.
  - Runtime QA telemetry now exposes active skill identity/phase plus weight, action impulse, recovery, and cancel state. A follow-up fix normalized completed skill timelines back to plain `idle`, matching the runtime telemetry contract.
  - Added production regression gate `SKILL_DAMAGE_ANIMATION_PASS skills=9 phases=anticipation/action/recovery cancel=readable reactions=hit/stagger/armor-break`, covering all nine skill profiles, class silhouette separation, phase timing bounds, cancel behavior, hard-hit interruption, and hit/stagger/armor-break reaction separation.
  - PR #182 Browser E2E `35791954906` passed on gameplay head `db8fc141569de20157b88fe39056cb8ae3c045a8`. Follow-up PR #183 Browser E2E `35792852333` passed on telemetry-fix head `a90704d6248d85677cd0f165b4201269d272d012`.
  - Verified on merged gameplay source `3f9232d1181fdaba48c4305fa06126f6e6f3f03e`: Browser E2E `35793094965`, Level 15 beta smoke `35793094912`, and Android beta.274 `35793094916` all passed.
  - Android artifact `10722951806` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.274`, debug signing, package/version/SDK/signature verification, native emulator runtime/touch/lifecycle/authored-content/Chapter 3 QA, and APK SHA-256 `705fc82bd31f3c8aadaf5e2c3b938db201a2fe009f5e27fac689d550e4fc904b`.
  - **Next: P12-F — Enemy/boss animation.**

- [x] **P12-F Enemy/boss animation** — expanded enemy and boss rigs from basic locomotion/reaction posing into a deterministic authored combat-motion layer without changing AI timing, attack execution, damage, statuses, or encounter logic.
  - Added five role-specific motion profiles for assault, suppressor, technician, elite, and boss enemies, with distinct stance, gait cadence/amplitude, tell posture, execution impulse, recovery, phase-transition weight, and modifier tension.
  - Attack animation reads the authoritative simulation telegraph and a tracked telegraph-completion edge to produce anticipation → commit → recovery. It does not create new attack timers or delay projectiles.
  - Boss phase-two changes now trigger a bounded full-body transition layered with the existing phase ring/halo/signature presentation, so escalation is visible on the character silhouette instead of only through HUD/VFX.
  - Enhanced/elite/command classification, protocol pulse, T9 mutations, command-target mutations, and boss-phase mutations feed one additive modifier-motion weight. Armor breach, disruption, mark, stagger, conductive, and vacuum timers feed independent additive status motion so they do not erase attack tells.
  - Authored GLB rigs and procedural enemy fallbacks both consume the same resolved motion signals. Runtime QA telemetry exposes active enemy profile/phase plus move, tell, commit, recovery, phase, modifier, and status weights.
  - Added production regression gate `ENEMY_BOSS_ANIMATION_PASS roles=5 tell=deterministic commit=recovery phase2=authored modifiers=status-additive`, covering role separation, tell progression, execution/recovery windows, boss phase transition, anchored locomotion suppression, modifier intensity, status normalization, and death ownership.
  - Initial PR Browser E2E run `35794769532` correctly caught one stale source-pattern assertion after the animation call signature changed; follow-up commit `cd9ad2b6057b308a43ecfbd91bf0841d254e7a19` updated the integration assertion, and PR Browser E2E `35794901686` then passed desktop + mobile-landscape.
  - Verified on merged gameplay source `495f137df4c48f04947d9d994dc6d35cc549d1f0`: Browser E2E `35795084217`, Level 15 beta smoke `35795084206`, and Android beta.275 `35795084203` all passed.
  - Android artifact `10723588841` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.275`, debug signing, package/version/SDK/signature verification, native emulator runtime/touch/lifecycle/authored-content/Chapter 3 QA, and APK SHA-256 `037681ace105f4d9feeff05042144599c30edf034fd7bce437db3319b6f6ef4c`.
  - **Next: P12-G — Camera/haptics/perf.**

- [x] **P12-G Camera/haptics/perf** — closed AAA Combat Feel with one shared presentation response for weapon recoil, impacts, and player damage, synchronized haptics, accessibility scaling, and explicit 60 fps frame-budget telemetry without changing combat simulation.
  - Added `CombatCameraFeedbackRuntime` as a deterministic presentation-only layer driven by authoritative simulation time, weapon flash/handling, impact serials, and cumulative damage taken. Recoil remains weapon-family-specific, heavy/object/light impacts resolve distinct bounded impulses, player damage receives a stronger readable kick, and all transient impulses decay instead of becoming persistent camera drift.
  - Canvas fallback and the primary Three.js renderer now consume the same camera sample. The prior independent Three.js weapon-only shake path was removed so both renderers respect the same behavior and settings.
  - Existing accessibility settings remain authoritative: disabling **Screen shake** removes combat camera motion entirely; **Reduced** effect intensity scales camera motion to 42% while preserving combat tells and does not alter deterministic simulation.
  - Combat feedback dispatch now runs at render-frame cadence instead of the throttled HUD refresh cadence. Weapon/impact audio and supported-device haptics therefore observe the same fresh simulation events, while HUD React updates remain throttled.
  - Added synchronized light/heavy impact haptics plus Reduced-effects haptic scaling. Haptics remain independently controlled by the existing haptics toggle and can still fire when combat effects audio volume is muted.
  - Extended the adaptive render budget with a 60 fps target, smoothed frame cost, frame headroom, and healthy/watch/over pressure state. Runtime QA exposes `renderFrameMs`, `renderFrameBudget`, active render tier, and camera-feedback magnitude while the existing adaptive tiers continue trimming pixel ratio, shadows, secondary VFX, transparency, and detail before gameplay/readability.
  - Settings copy now explains recoil/impact/damage camera response, Reduced camera/haptic intensity, and synchronized recoil/impact haptics.
  - Added production regression gate `COMBAT_FEEL_PASS recoil+impact+damage+haptics+accessibility` and extended `RENDER_PERFORMANCE_PASS` coverage for the 60 fps target, negative over-budget headroom, pressure transitions, and runtime frame-budget telemetry.
  - The first two PR attempts correctly caught stale source-pattern assertions from earlier P7-B/P8-F coverage after the intentional haptic/camera refactor. Those tests were updated to assert the new accessibility-scaled haptic path and shared camera runtime without weakening the original rarity-feedback or weapon-family-handling contracts.
  - PR #185 Browser E2E `35796896031` passed desktop + mobile-landscape on final tested head `5bed2f76064c459245b24aee04e1908b5246f778`, including the full regression/production build and live player journeys.
  - Verified on merged gameplay source `499000258a371d35320ca761feee5880bf963a0c`: Browser E2E `35797107474`, Level 15 beta smoke `35797107513`, and Android beta.276 `35797107491` all passed.
  - Android artifact `10724222054` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.276`, debug signing, package/version/SDK/signature verification, native emulator runtime/touch/lifecycle/authored-content/Chapter 3 QA, balanced mobile render-tier verification, and APK SHA-256 `715e099f360713b50b6cd7a23d3b97b74c55e8abbf14c035ef4cc70fcd28c885`.
  - **Next: P13-A — Presentation framework.**

## 2026-09-22 — P13-A Enemy Modifier & Status Visual Language // Presentation framework

- [x] **P13-A Presentation framework**
  - Added `src/game/enemyPresentation.ts` as a presentation-only resolver that reads deterministic enemy mutation, protocol, status, attack-telegraph, boss-phase, and death state without mutating combat simulation.
  - The contract composes four independent channels — animation, material, VFX, and audio — so later P13 batches can add concrete presentation layers without replacing higher-priority combat tells or duplicating gameplay logic.
  - All six T9–T11 mutation identities now have stable presentation cue tokens, protocol presentation is family-driven with enhanced-variant identity preserved, and armor breach/disruption/mark/stagger/conductive/vacuum statuses publish the same four-channel contract.
  - Added stable priority ordering, intensity normalization, deterministic QA signatures, boss phase-two and death/powerdown layers, plus death-time audio suppression so sustained combat presentation cannot leak after an enemy is disabled.
  - Added `tests/enemy-presentation-framework.ts` and wired `test:enemy-presentation` into the full production build. Coverage verifies all four channels, composability, enhanced protocol identity, deterministic ordering across mutation storage order, status coverage, boss/death behavior, and the no-simulation-mutation boundary.
  - PR #186 Browser E2E `35799184240` passed desktop + mobile-landscape, including the full regression/production build and live player journeys.
  - Merged gameplay source `9059fc12f115e43fdd3d87f9332d39484b6f9c1c` passed Browser E2E `35799405651`, Level 15 beta smoke `35799405627`, and Android beta.277 `35799405655`.
  - Android artifact `10725795522` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.277`, debug signing, package/version/SDK/signature verification, native emulator runtime/touch/lifecycle/Chapter 3 QA, and APK SHA-256 `30f7228bafffaf2cd204437e9b5f9d6fcc83e1e69fae60a9de723e575dac6612`.
  - **Next: P13-B — T9 visuals I (Reinforced Core, Ablative Mantle, Hunter Servo).**

## 2026-09-22 — P13-B Enemy Modifier & Status Visual Language // T9 visuals I

- [x] **P13-B T9 visuals I** — gave Reinforced Core, Ablative Mantle, and Hunter Servo distinct authored/fallback animation, material, VFX, and audio reads through the P13-A presentation contract without changing mutation combat stats, AI, targeting, or encounter simulation.
  - **Reinforced Core** now reads as a load-bearing defensive package: paired external core braces, pressure/core glow, a visibly braced authored/procedural stance, and a low mechanical load-bearing hum.
  - **Ablative Mantle** now reads as sacrificial armor rather than generic durability: layered ceramic mantle plates, bounded shed-spark debris, a settling/weight animation layer, and a short ceramic-rattle audio signature.
  - **Hunter Servo** now reads as mobility/tracking hardware: rear servo housing, active tracking reticle/streaks, a forward ready/tracking pose that also shifts the fallback weapon, and a rising servo-whine signature.
  - Three.js authored rigs and procedural enemy fallbacks consume the same deterministic mutation cue identities. Canvas fallback gained equivalent brace/plate/reticle language so device/render-path fallback does not erase mutation identity.
  - Attack/status readability stays authoritative: mutation posing is damped while telegraph/commit/high-priority status reads are active, mutation material/VFX intensity is reduced when higher-priority P13-A layers lead, and Canvas draws attack telegraphs after mutation effects/silhouettes.
  - Reduced-effects mode preserves the identifying hardware while trimming secondary motion, mantle spark count, reticle rotation, and tracking streak density.
  - Added layered one-shot mutation audio on the low-priority utility path. These cues remain duckable under existing important/critical threat mix behavior and trigger only when a new P13-B mutation becomes active.
  - Added production regression gate `T9_VISUALS_I_PASS mutations=3 channels=animation+material+vfx+audio priority=tells-first authored+fallback=1` and wired `test:enemy-t9-visuals-i` into the full build. Coverage verifies distinct four-channel cue identities, tell/status priority, both renderer paths, audio priority, runtime QA telemetry, and the presentation-only simulation boundary.
  - PR #187 initial Browser E2E `35801722190` caught a stale graphics source-pattern assertion during the integration pass; the final merged source `2ec4374fc99100ba5c7d2bd6fbaa1d81707bfda2` then passed Browser E2E `35802067788`, Level 15 beta smoke `35802067844`, and Android beta.278 `35802067794`.
  - Android artifact `10726617221` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.278`, debug signing, min SDK 24 / target SDK 36 package/signature verification, native emulator runtime/touch/lifecycle/Chapter 3 QA, and APK SHA-256 `2255ea57332bd34153ca8659a8c7aced7d351b816cf5bcba21075ab1150cdb73`.
  - **Next: P13-C — T9 visuals II (Redline Bus, Countermass Rig, Relay Reflex).**

## 2026-09-22 — P13-C Enemy Modifier & Status Visual Language // T9 visuals II

- [x] **P13-C T9 visuals II** — gave Redline Bus, Countermass Rig, and Relay Reflex distinct authored/fallback animation, material, VFX, and audio reads through the P13-A presentation contract without changing mutation combat stats, AI, targeting, or encounter simulation.
  - **Redline Bus** now reads as an overdriven power package: a hot rear bus spine with paired power rails/cross-bridges, fast emissive pressure pulses, a tense forward-biased authored/procedural pose, and a rising power-bus audio signature.
  - **Countermass Rig** now reads as stabilization hardware: paired mass pods on visible support arms, a bounded mass-field/orbit read, a counter-rotating balance pose, and a low mass-thrum signature.
  - **Relay Reflex** now reads as reflex/sensor hardware: relay housing plus a three-node sensor crown, fast scan/snap VFX, high-frequency head/weapon tracking snaps, and a short relay-click signature.
  - Three.js authored rigs and procedural enemy fallbacks consume the same deterministic mutation cue identities. Canvas fallback gained equivalent redline rails, countermass pods/field, and relay node/scan language so render-path fallback preserves identity.
  - Attack/status readability remains authoritative: all P13-C motion stays additive and suppressed by higher-priority telegraph/commit/status layers; material/VFX reads are attenuated when higher-priority P13-A layers dominate; Canvas still draws attack telegraphs after mutation effects/silhouettes.
  - Reduced-effects mode preserves identifying hardware while stopping Countermass secondary orbit motion and reducing Relay snap density/secondary motion; Redline keeps a static readable bus/pulse silhouette.
  - Extended the low-priority utility mutation-audio path to all six T9 mutations. P13-C cues remain duckable under important/critical threat mix behavior and trigger only on newly active mutation identities.
  - Added production regression gate `T9_VISUALS_II_PASS mutations=3 channels=animation+material+vfx+audio priority=tells-first authored+fallback=1 reduced-effects=preserved` and wired `test:enemy-t9-visuals-ii` into the full build.
  - PR #188 Browser E2E `35803286835` passed desktop + mobile-landscape full regression/build and live player journeys. Final merged gameplay source `e2f6d03b9e410af76419d3deb721603dd9ccd977` passed Browser E2E `35803492357`, Level 15 beta smoke `35803492317`, and Android beta.279 `35803492333`.
  - Android artifact `10726844612` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.279`, debug signing, min SDK 24 / target SDK 36 package/version/signature verification, native Android emulator runtime/touch/lifecycle/Chapter 3 QA, and APK SHA-256 `ee6d00c748367a44ba7b0c6d7109a24d1842a660a15ee26d4f44ec9f5f03854a`.
  - **Next: P13-D — Protocol visuals (physical/animated tells for elite protocols + enhanced variants).**

## 2026-09-22 — P13-D Enemy Modifier & Status Visual Language // Protocol visuals

- [x] **P13-D Protocol visuals** — gave every elite protocol and named enhanced variant a distinct physical/animated combat read across authored Three.js and Canvas fallback rendering without changing protocol simulation, AI, damage, cooldowns, targeting, or encounter budgets.
  - Added a shared protocol visual-language registry covering all **18 elite protocols**. Each protocol owns a stable family palette plus a distinct combination of physical signature, node layout, mounting radius/height, motion identity, phase, and scale so PLATING, PRESSURE, VAC-ADAPT, BREACH, MAG-LOCK, ANCHOR, COUNTERMASS, ARC-LINK, REPAIR, ESCORT, SHUTTERS, GHOST, JAMMER, REDLINE, COORD, PEN-VOLLEY, INTERDICT, and DENIAL do not collapse into the previous generic protocol ring.
  - Added secondary visual identities for all **15 enhanced protocol variants**, including Ablative Bloom, Cutline Pair, Twin-Well Lock, Anchor Singularity, Wake Anchor, Cascade Grid, Overlink Mesh, Dual Rack, Cross-Shutter, Capacitor Scramble, Coolant Redline, Tech Bus Sync, Cross-Fan Volley, Mass Theft, and Hard Lock Grid.
  - Three.js enemies now mount protocol-specific hardware groups, field rings, nodes, and enhanced-marker geometry directly on the enemy root. Protocol windup and the authoritative protocol pulse drive bounded emissive/field intensity and presentation motion; multi-protocol combinations keep up to three independent hardware signatures visible at once.
  - Canvas fallback now renders matching split/crown/rail/ring/fork/clamp/grid/fan/beacon hardware language plus enhanced-variant rings/spokes so fallback devices retain the same protocol identity.
  - Attack/status priority remains authoritative: protocol materials and VFX attenuate when higher-priority P13-A layers lead, and Canvas still draws attack telegraphs after protocol + mutation presentation and silhouette.
  - Reduced-effects mode preserves identifying hardware while freezing generic protocol-ring rotation, scaling down secondary motion, and limiting enhanced marker density instead of removing the tell.
  - Runtime QA telemetry now exposes protocol presentation keys, enhanced-variant IDs, target role/variant, and dominant presentation source for deterministic browser/runtime verification.
  - Added production regression gate `PROTOCOL_VISUALS_PASS protocols=18 enhanced=15 authored+fallback=1 combos=readable priority=tells-first reduced-effects=preserved simulationMutation=0`, wired into the full production build. Coverage locks all protocol/enhanced IDs, physical signature uniqueness, family parity, multi-protocol readability, attack/status priority, reduced-effects behavior, both renderer paths, deterministic presentation identity, and the no-simulation-mutation boundary.
  - PR #189 Browser E2E `35804886161` passed desktop + mobile-landscape full regression/production build and live player journeys on tested head `5523bba9dc9afde61af90a32cf364f86d6701128`.
  - Verified on merged gameplay source `6f70d6c374c06a12bc60106c3a2fd39b8149521e`: Browser E2E `35805099892`, Level 15 beta smoke `35805100010`, and Android beta.280 `35805099886` all passed.
  - Android artifact `10727917127` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.280`, debug signing, min SDK 24 / target SDK 36 package/version/signature verification, native emulator runtime/touch/lifecycle/authored-content/Chapter 3 QA, and APK SHA-256 `091c18662157b5b8ea88852f65f3fc8040a549791e943aa09b092f4eacdb3904`.
  - **Next: P13-E — Player statuses.**

## 2026-09-22 — P13-E Enemy Modifier & Status Visual Language // Player statuses

- [x] **P13-E Player statuses** — converted status state from mostly HUD text/emissive hints into distinct authored/fallback world presentation for enemies and the operator without changing status mechanics, damage, AI, pressure simulation, weapon heat, or encounter behavior.
  - All six deterministic P13-A enemy status timers now have distinct presentation identities: **Armor Breach** uses open fracture/shed geometry, **Disrupted** uses unstable jitter + electrical snaps, **Marked** uses a tracking reticle, **Stagger** uses a heavy impact/recoil break, **Conductive / Arc-charged** uses linked electrical nodes, and **Vacuum** uses frost/vent leakage language.
  - The operator now gets physical presentation for **thermal load**, **electronic disruption**, **pressure loss/decompression**, and **vacuum exposure**, resolved only from authoritative weapon heat, player disruption, vacuum exposure, and current sector pressure state.
  - Three.js authored operators/enemies and procedural fallbacks consume the same status visual-language contract. Canvas fallback renders equivalent fracture, reticle, arc, jitter, impact, thermal, pressure-loss, and vacuum cues so render-path fallback does not erase status meaning.
  - Attack readability remains authoritative: enemy attack telegraphs still draw after status layers in Canvas, and Three.js attack-charge emissive overrides status emissive when a hostile is actively telegraphing. Status presentation remains additive with the existing P13 mutation/protocol layers rather than replacing them.
  - Reduced Effects preserves the identifying silhouette/field while trimming node/marker count, orbit/jitter motion, fracture detail, pressure streams, and secondary electrical motion.
  - Added bounded synthesized one-shot status audio on fresh activations for all six enemy status identities plus operator thermal/disruption/pressure-loss/vacuum states. High-priority disruption/stagger/vacuum information uses the existing priority mix so it can make room over lower-value combat audio without creating a new sound system.
  - Runtime QA telemetry now exposes active enemy and operator status presentation plus dominant operator status. Existing HUD status text remains intact for now; P13-G owns any redundancy reduction after mobile screenshot/video readability QA.
  - Added production regression gate `STATUS_VISUALS_PASS enemy=6 operator=thermal+disrupted+pressure+vacuum channels=animation+material+vfx+audio authored+fallback=1 priority=tells-first reduced-effects=preserved simulationMutation=0` and wired `test:status-visuals` into the full production build.
  - PR #191 Browser E2E `35806180843` passed desktop + mobile-landscape full regression/production build and live player journeys on tested head `b5fe883992847c4a44800b7fa65f72031a98730e`.
  - Verified on merged gameplay source `5c1fe36ace40f9793229d90305c466e57d2b5c0b`: Browser E2E `35806387196`, Level 15 beta smoke `35806387144`, and Android beta.281 `35806387149` all passed.
  - Android artifact `10728780020` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.281`, debug signing, min SDK 24 / target SDK 36 package/version/signature verification, native emulator runtime/touch/lifecycle/authored-content/Chapter 3 QA, and APK SHA-256 `dd2145a08e665c6acfc831c329375a1493ec416f65c217e7efe0576b09cc1113`.
  - **Next: P13-F — Boss/spawn/death language.**

## 2026-09-22 — P13-F Enemy Modifier & Status Visual Language // Boss/spawn/death language

- [x] **P13-F Boss/spawn/death language** — made hostile activation, dangerous stacked-modifier readiness, boss phase breaks, disable/death, and persistent post-disable state readable through the shared P13-A presentation contract without changing combat simulation, encounter timing, AI, damage, protocol timing, or boss mechanics.
  - Added `src/game/enemyLifecyclePresentation.ts` as a presentation-only lifecycle resolver with bounded activation, phase-transition, dangerous-readiness, disable, and persistent-disabled signals derived from deterministic enemy state plus renderer-local edge timing.
  - Hostile activation now gets a short power-up/ring/body-rise read; bosses and elites receive differentiated one-shot activation audio while ordinary hostiles use a lighter threat cue.
  - Dangerous stacked combinations now publish a high-priority readiness layer when elite/command enemies have multiple modifier systems live and a protocol/telegraph/pulse is actively winding up. This layer composes with protocol/mutation/status presentation while yielding to authoritative attack/stagger/disruption tells.
  - Boss phase two transitions now get a dedicated transition break/shock-ring/body-rise read in addition to the sustained phase-two material/halo language, so the phase change is readable without relying on HUD text.
  - Disable/death now has a transient collapse/discharge cue plus a persistent cold-hardware/residual-marker state. Canvas fallback no longer collapses dead enemies into only a generic red ellipse; it preserves role-colored disabled hardware and frozen protocol/mutation identity without secondary motion.
  - Three.js authored and procedural enemies share the same lifecycle signals and `enemy-lifecycle-presentation` hardware/VFX root. Authored animation consumes lifecycle signals while preserving the established `syncAuthoredEnemyAnimation(visual, enemy, state, motion)` integration contract.
  - Reduced Effects preserves activation/phase/readiness/disabled identity while freezing or trimming secondary ring/crown motion instead of deleting the tell.
  - Added bounded lifecycle threat audio for `enemy-spawn`, `elite-spawn`, `boss-spawn`, `danger-ready`, `enemy-disable`, and `boss-disable`; persistent disabled state never sustains audio.
  - Runtime QA telemetry now exposes active lifecycle presentation, target role/variant, and Reduced Effects preservation in both Three.js and Canvas paths.
  - Added production regression gate `ENEMY_LIFECYCLE_VISUALS_PASS spawn+phase+readiness+disable+persistent=1 channels=animation+material+vfx+audio authored+fallback=1 priority=tells-first reduced-effects=preserved simulationMutation=0` and wired `test:enemy-lifecycle-visuals` into the full production build.
  - PR #193 Browser E2E `35808188156` passed desktop + mobile-landscape full regression/production build and live player journeys after CI first caught and drove fixes for the new test-runner command and the established authored-animation source contract.
  - Verified on merged gameplay source `b2e93a3e9b838247ca30c5671478434f792c073c`: Browser E2E `35808378456`, Level 15 beta smoke `35808378476`, and Android beta.282 `35808378501` all passed.
  - Android artifact `10728758630` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.282`, debug signing, min SDK 24 / target SDK 36 package/version/signature verification, native emulator runtime/touch/lifecycle/authored-content/Chapter 3 QA, and APK SHA-256 `c98510b7df5fb0c5f410c408400a7c07bc4d3e5456fa90a128d21d8c18b79e53`.
  - **Next: P13-G — Mobile readability/HUD reduction.**


## 2026-09-22 — P13-G Enemy Modifier & Status Visual Language // Mobile readability/HUD reduction

- [x] **P13-G Mobile readability/HUD reduction** — reduced redundant enemy HUD pressure on coarse/mobile combat surfaces while preserving the authored world-space tell hierarchy and leaving desktop presentation intact.
  - Added shared `src/game/enemyMobileReadability.ts` policy consumed by both Three.js and Canvas fallback rendering. Desktop keeps full durability/status/role/class/modifier presentation; mobile LOD2 switches to a bounded priority information budget instead of applying one-off renderer exceptions.
  - Mobile durability bars now remain for bosses/elites, the focused target, armor-break urgency, or enemies at/below 50% health. Pristine untargeted common enemies no longer carry always-on durability bars.
  - Untargeted mobile role/status/modifier text stacks are removed because silhouette, attack telegraphs, protocol hardware, mutation language, status presentation, and lifecycle presentation already communicate those states in-world. Focused targets can still expose diagnostic class/modifier/status text; boss pattern text remains owned by the boss HUD/world telegraph rather than a duplicate nameplate line.
  - Critical world channels remain explicitly preserved at LOD2: **telegraph + protocol + mutation + status + lifecycle**. Reduced Effects keeps those identities while trimming secondary motion/detail instead of removing the tell.
  - Canvas fallback and authored Three.js paths consume the same policy; authored mobile hostile/operator/weapon/interactable/environment assets remain on LOD2 while desktop remains LOD1.
  - Added `tests/enemy-mobile-readability.ts` and wired `test:enemy-mobile-readability` into the production build gate. Coverage locks desktop parity, mobile priority bars, focused diagnostics, critical-tell preservation, Reduced Effects telemetry, and Canvas/Three integration.
  - Browser QA now publishes `enemyHudReadability` telemetry, seeds Reduced Effects through the atomic `ironshade-vector-state-v1` envelope, launches Chrome at the actual matrix viewport, and keeps authored-asset verifiers aligned with the matrix rather than inferring device tier from combat-canvas CSS size.
  - PR #195 final Browser E2E `35812479953` passed desktop **1280×720** and mobile-landscape **851×360** full regression/production build plus live player journeys across Asteroid Refinery, Damaged Vessel, Spin Habitat, Jovian Harvester, Ice Mine, and Solar Yard.
  - Final telemetry verified desktop `desktop|full-bars+full-tags|tells:telegraph+protocol+mutation+status+lifecycle|effects:full` and Reduced Effects mobile `mobile-lod2|priority-bars+focused-tags|tells:telegraph+protocol+mutation+status+lifecycle|reduced-effects:identity-preserved`.
  - Screenshot review of the final mobile captures confirmed redundant enemy text stacks are absent while focused/priority durability and physical threat cues remain readable in dense combat; desktop captures retain the full authored information layer.
  - Merged gameplay source `4161a2d8817d4e289e92f1743fd0e20f8989b873`; Android verifier follow-ups #196/#197 were QA-only and produced final delivery source `16a43e937438f3f21174e8294b59133aa74b5f36`.
  - Final post-merge verification passed Browser E2E `35814794239` (desktop + Reduced Effects mobile-landscape), Level 15 beta smoke `35814794287`, and Android beta.285 `35814794169`.
  - Android artifact `10731058432` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.285`, debug signing, package/version/SDK/signature verification, native Android install/launch/touch/lifecycle/authored-content/Chapter 3 QA, and APK SHA-256 `fbe2c348d331c363c51c7c572669ea439c0dc472c3addec4b358e8f21f4446e6`.
  - **Next: P14-A — Systems Carbine pair.**

## 2026-09-22 — P14-A Class Arsenal Expansion // Systems Carbine pair

- [x] **P14-A Systems Carbine pair** — authored Burst + Precision Carbine as a coherent Systems-owned same-family pair while preserving the established class arsenal lock and existing save compatibility.
  - Added `src/game/classArsenal.ts` with stable `carbine-burst` and `carbine-precision` identities, explicit stat/handling tradeoffs, deterministic equipped-frame resolution, and shared presentation tuning.
  - **M-7B Burst Carbine** commits a deterministic three-round coil packet with a compact silhouette, broader muzzle signature, larger 42-round feed, faster thermal recovery, and lower per-round penetration/precision.
  - **M-7P Precision Carbine** commits deliberate single shots with a longer silhouette, tighter muzzle signature, 42 penetration, 0.006 spread, and stronger per-round damage at the cost of a 20-round magazine and hotter individual shots.
  - Raw authored DPS remains intentionally near-parity (Burst 101.43 vs Precision 101.25) so the pair separates through cadence, ammo, thermal behavior, penetration, grouping, and handling rather than a hidden dominant damage choice.
  - Variant identity is derived into the ephemeral `CombatBuild` from the equipped Carbine frame; no profile/save schema migration was required. Deeper progression, crafting/affix, Singular, skill, and class-owned loot integration remains explicitly owned by **P14-D**.
  - `triggerFire` now supports authored rounds-per-trigger. Burst spends/emits all committed rounds with deterministic packet separation and per-round heat accounting; Precision remains one projectile/one round per fire cycle. Existing telemetry and Carbine-family trait semantics remain trigger-cycle based.
  - Canvas fallback, authored Three.js weapons, procedural Three.js weapons, and hard-sci-fi fallback geometry now expose distinct Carbine proportions, muzzle dimensions, recoil weight, aim lift, FX identity, and `weaponVariant` runtime QA telemetry.
  - Added `tests/systems-carbine-variants.ts` and production gate `test:class-arsenal`. Coverage locks exact pair ownership, deterministic Burst packets, ammo/heat accounting, same-family Systems ownership, DPS parity, Precision penetration/grouping, feed/thermal tradeoffs, and presentation separation.
  - PR #198 Browser E2E `35816472065` passed desktop + mobile-landscape full regression/production build and live player journeys on tested head `8cbdfd7c94241d44780f94d6519ce21b2b2bdef4`.
  - Merged gameplay source `961036e65bd544eef8437d8c026088b526db230a` passed post-merge Browser E2E `35816730328` and Level 15 beta smoke `35816730270`.
  - Android beta.286 run `35816730475` passed the full web regression/build, native project generation, debug APK build, package/version/min-SDK/target-SDK/signature verification, Android emulator install/cold launch, class selection/menu/skill hierarchy/class kit/mobile asset/render tier/touch combat/runtime lifecycle QA, authored operator/enemy/weapon/refinery verification, and Chapter 3 touch playthrough.
  - Android artifact `10732231158` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.286`, debug signing, min SDK 24 / target SDK 36, and APK SHA-256 `de0bca17f8b8622e478f0459247c3868d7674a9129df3b156efebbc452595d7f`.
  - **Next: P14-B — Vanguard Breacher pair (Slug + Rapid Breacher).**


## 2026-09-22 — P14-B Class Arsenal Expansion // Vanguard Breacher pair

- [x] **P14-B Vanguard Breacher pair** — authored Slug + Rapid Breacher as a coherent Vanguard-owned same-family pair while preserving the hard Breacher arsenal lock and existing save compatibility.
  - Extended `src/game/classArsenal.ts` with stable `breacher-slug` and `breacher-rapid` identities plus shared weapon-variant presentation/runtime resolution. Existing Dense-Choke frames resolve to Slug; Backblast Thruster and Cryo-Cycle frames resolve to Rapid without adding a save-schema field.
  - **B-4S Slug Breacher** converts the Breacher into one dense projectile with 56 penetration, 0.012 spread, heavier recoil/heat, a longer narrow silhouette, and stronger per-projectile armor transfer.
  - **B-4R Rapid Breacher** keeps a compact five-pellet scatter packet but doubles down on repeated breach pressure through 2.6 fire rate, a 10-round magazine, lower recoil, faster thermal recovery, a shorter silhouette, and broader muzzle language.
  - Raw authored DPS remains intentionally near-parity (Slug 69.85 vs Rapid 70.20) so the pair separates through projectile model, cadence, reach, penetration, recoil, magazine depth, thermal behavior, and handling rather than a hidden damage winner.
  - Variant identity is derived into the ephemeral `CombatBuild` from equipped Breacher frame identity. Vanguard remains locked to the Breacher family; deeper progression, crafting/affix, Singular, skill, and class-owned loot integration remains explicitly owned by **P14-D**.
  - Canvas fallback, authored Three.js weapons, procedural Three.js weapons, and hard-sci-fi fallback geometry now consume the active weapon variant presentation generically, covering Slug/Rapid silhouette, muzzle dimensions, recoil weight, aim lift, FX identity, and `weaponVariant` runtime QA telemetry alongside the P14-A Carbine variants.
  - Added `tests/vanguard-breacher-variants.ts` to the production `test:class-arsenal` gate. Coverage locks exact pair ownership, frame resolution, same-family Vanguard ownership, DPS parity, single-projectile Slug behavior, deterministic Rapid scatter, ammo/heat accounting, penetration/recoil/thermal tradeoffs, and presentation separation.
  - Browser QA caught the authored-weapon verifier still hard-coding Breacher FX as `scatter`; the verifier was updated to validate `slug-impact` / `rapid-scatter` plus the existing Carbine variant FX. PR #199 final Browser E2E `35818531057` then passed desktop + mobile-landscape full regression/production build and live player journeys on tested head `b9cff993e8a21cf2e8e09dd4d7d16144f69b487b`.
  - Merged gameplay source `3154b300c0a8ed166814bae5bd6876a3df7ea25d` passed post-merge Browser E2E `35818754105` and Level 15 beta smoke `35818754120`.
  - Android beta.287 run `35818754101` passed the full web regression/build, native project generation, debug APK build, package/version/min-SDK/target-SDK/signature verification, Android emulator install/cold launch/touch/runtime QA, authored-content verification, and Chapter 3 touch playthrough.
  - Android artifact `10732995607` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.287`, debug signing, min SDK 24 / target SDK 36, and APK SHA-256 `168902b73aa890ecb730d68e0394e4c69f08ab3df16cecbc1119c37d91df55ea`.
  - **Next: P14-C — Vector Rail pair (Charge + Repeater Rail).**

## 2026-09-23 — P14-C Class Arsenal Expansion // Vector Rail pair

- [x] **P14-C Vector Rail pair** — authored Charge + Repeater Rail as a coherent Vector-owned same-family pair while preserving the hard Rail Lance arsenal lock, existing saves, and the established Vector precision/momentum identity.
  - Extended `src/game/classArsenal.ts` with stable `rail-charge` and `rail-repeater` identities, explicit capacitor/thermal/penetration/cadence tradeoffs, deterministic equipped-frame resolution, and shared presentation tuning.
  - **Helix R-2C Charge Rail** concentrates 62 damage, 168 penetration, extreme projectile velocity, high recoil, 18 capacitor draw, and heavier per-shot heat into a deliberate four-round precision magazine with a long/narrow charge silhouette.
  - **Helix R-2R Repeater Rail** trades single-hit transfer for 1.58 fire rate, a 10-round magazine, 5 capacitor draw, faster cooling, lower recoil, and a shorter/broader accelerator presentation suited to controlled follow-up shots.
  - Raw authored DPS remains intentionally near-parity (Charge 34.72 vs Repeater 35.08) so the pair separates through discharge shape, penetration, projectile speed, capacitor pressure, heat, magazine depth, recoil, cadence, and handling rather than a hidden raw-damage winner.
  - Existing Hypervelocity and Countermass Rail frames resolve to Charge while Thermal Reference Rails resolve to Repeater. Variant identity remains ephemeral in `CombatBuild`; no save/profile schema migration was required. Deeper progression, crafting/affix, Singular, skill, and class-owned loot integration remains explicitly owned by **P14-D**.
  - Canvas/authored/procedural weapon presentation continues through the generic weapon-variant presentation contract; runtime Three.js QA now exposes explicit `charge-lance` / `repeater-lance` FX language while retaining the generic `lance` fallback.
  - Added `tests/vector-rail-variants.ts` to the production `test:class-arsenal` gate. Coverage locks exact pair ownership, frame resolution, same-family Vector ownership, DPS parity, deterministic discharge, ammo/capacitor/heat accounting, penetration/velocity/recoil/thermal tradeoffs, and silhouette/muzzle presentation separation.
  - The first PR CI pass correctly caught an older graphics regression assertion that hard-coded the pre-variant Rail FX expression. The assertion was updated to require Charge/Repeater-specific readability plus the generic fallback; PR #200 final Browser E2E `35843961110` then passed desktop + mobile-landscape full regression/production build and live player journeys on tested head `a8219d1df328d9a9b3f4163871c43a607ed47f04`.
  - Merged gameplay source `86ecc2e20a55a4d2749a31783e7dbf360cdae20f` passed post-merge Browser E2E `35844330501` and Level 15 beta smoke `35844330380`.
  - Android beta.288 run `35844330691` passed the full web regression/build, native project generation, debug APK build, package/version/min-SDK/target-SDK/signature verification, Android emulator install/cold launch, class selection/menu/skill hierarchy/class kit/mobile layout/touch combat/runtime lifecycle QA, authored operator/enemy/weapon/refinery verification, and Chapter 3 touch playthrough.
  - Android artifact `10742788131` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.288`, debug signing, min SDK 24 / target SDK 36, and APK SHA-256 `b0433b0a03211fd8e9bb3b6197ac7eb9b643f5fff807510442a62db01f3f2711`.
  - **Next: P14-D — Build integration.**

## 2026-09-23 — P14-D Class Arsenal Expansion // Build integration

- [x] **P14-D Build integration** — carried the complete six-variant Carbine/Breacher/Rail arsenal through progression, crafting/affixes, class skills, Singular interactions, and class-owned loot without creating a second progression or loot system.
  - Added one data-driven build-integration row for every variant in `src/game/classArsenal.ts`. Each row binds the variant to its existing four-node owned-family progression lane, a legal preferred-affix set, class-skill tuning, and an additional Singular-linked class-skill payoff.
  - Existing progression remains family-owned and save-safe: Burst/Precision consume the Systems Carbine lane, Slug/Rapid consume the Vanguard Breacher lane, and Charge/Repeater consume the Vector Rail lane. No Operator Network schema bump or profile migration was required.
  - Class-skill derivation now records `variant-build:<variant>` and applies pair-specific tuning so the firing package changes the active skill economy rather than existing only as weapon stat presentation. Variant-aware Singular links add a second authored payoff while preserving each Singular's fixed chase-item rules.
  - Reconstruction now exposes the active firing package and its legal preferred affixes through the existing crafting build-integration surface. Singulars remain non-editable fixed packages; ordinary weapon frames continue to use the centralized affix legality/conflict/rarity rules.
  - Class-owned ordinary recoveries now pass the active variant's preferred legal affixes into the centralized gear generator for victory, contract, and field recovery paths. Universal support slots remain unbiased, and hard class-family loot ownership remains unchanged.
  - Added `tests/class-arsenal-build-integration.ts` to the production `test:class-arsenal` gate. Coverage checks all six variants across owned-family progression, legal crafting preferences, live class-skill sources, Singular interaction, and class-owned loot routing.
  - PR #201 Browser E2E `35846424229` passed the full desktop + mobile-landscape regression/production build on tested head `eb2485de4cc41aa117dd598fa95aed34f637710a`.
  - Merged gameplay source `b005092cf4bf761640bb37b6d5d530b71bebb289` passed post-merge Browser E2E `35846732274` and Level 15 beta smoke `35846732264`.
  - Android beta.289 run `35846732260` passed the full production regression/build, native project generation, debug APK build, package/version/min-SDK/target-SDK/signature verification, Android emulator install/cold launch/touch/runtime/lifecycle QA, authored-content checks, and the Chapter 3 touch playthrough.
  - Android artifact `10743144568` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.289`, debug signing, min SDK 24 / target SDK 36, and APK SHA-256 `faeb0b6ee0393a1f4d6996794da76508c7edb154739f2dc21ca6d06045033c76`.
  - **Next: P14-E — Presentation/playtest.**

## 2026-09-23 — P14-E Class Arsenal Expansion // Presentation/playtest

- [x] **P14-E Presentation/playtest** — polished the complete six-variant class arsenal through variant-owned handling motion, layered weapon audio, thermal presentation, and sustained-fire QA while preserving P14-D progression/crafting/skill/Singular/loot integration and the hard class-family locks.
  - Expanded the shared weapon-variant presentation contract with independent recoil/charge/vent handling multipliers, audio pitch/direct/mechanical/tail mix tuning, and authored thermal warning/critical thresholds for Burst + Precision Carbine, Slug + Rapid Breacher, and Charge + Repeater Rail.
  - Live fire now routes the equipped variant identity into the existing feedback system. Family-level weapon audio remains the base, while each variant applies a bounded pitch/mix signature so same-family alternatives sound different without introducing a second audio path.
  - Player handling animation now consumes the active variant identity for recoil, rail charge, vent, and thermal-strain signals. Charge Rail receives the strongest spool/bracing read while Repeater Rail keeps the lighter rapid-follow-up response; the Carbine and Breacher pairs likewise retain distinct recoil/vent behavior.
  - Authored Three.js weapon thermal presentation now uses variant-specific warning/critical timing instead of a single fixed threshold, exposes a deterministic `weaponThermalCue` runtime QA state, and preserves the existing silhouette/muzzle/recoil/aim-lift separation.
  - Added `tests/class-arsenal-presentation-playtest.ts` to the production `test:class-arsenal` gate. It locks six distinct visual/handling/audio signatures, same-family separation, warning/critical semantics, and a 14-second isolated sustained-fire cycle per variant using live fire cooldowns, reloads, heat dissipation, critical cues, and vent behavior.
  - The first PR CI run `35848629637` correctly caught a test-state mistake where Rail charge was sampled while the weapon was venting; the playtest was corrected to sample charge and vent independently rather than weakening game behavior to satisfy the assertion.
  - PR #202 final Browser E2E `35848749371` passed desktop + mobile-landscape full regression/production build and live player journeys on tested head `2a1bc18ebeb0eb4f17ebc85f16fc0d420bb221eb`.
  - Merged gameplay source `a4baed89b4e5f29248022b2763ad7aa4a6f10d7d` passed post-merge Browser E2E `35849018181`, Level 15 beta smoke `35849018278`, and Android beta.290 `35849018125`.
  - Android beta.290 passed the full web regression/build, native project generation, debug APK build, package/version/min-SDK/target-SDK/signature verification, Android emulator install/cold launch/touch/runtime/lifecycle QA, authored-content checks, and the Chapter 3 touch playthrough.
  - Android artifact `10744404734` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.290`, debug signing, min SDK 24 / target SDK 36, and APK SHA-256 `b27dd144f25a0284ffc8c9dfa7d84c852709ac2e343d83121dab0500b5d6ded3`.
  - **Next: P14-F — Fourth-family gate.**

## 2026-09-23 — P14-F Class Arsenal Expansion // Fourth-family gate

- [x] **P14-F Fourth-family gate** — closed the Class Arsenal Expansion without adding a redundant fourth weapon family. The shipped class/arsenal model remains the intentional one-to-one set: Systems → Carbine, Vanguard → Breacher, Vector → Rail Lance.
  - Audited the live class/arsenal architecture: `OperatorClassId` and `OperatorWeaponFamily` each contain exactly three shipped identities, every class ability kit stays inside its owned family, and the six P14 variants already provide two distinct firing packages per family.
  - Added `tests/class-arsenal-fourth-family-gate.ts` and wired it into the production `test:class-arsenal` gate. The regression locks the three shipped classes/families, one-to-one ownership, three family-owned skills per class, exactly two variants per family, six total variant definitions, and six build-integration rows.
  - The gate deliberately requires a future explicit class or genuinely distinct combat-role decision before a fourth family can be introduced; ordinary same-role stat variation must stay inside the existing Carbine/Breacher/Rail families.
  - PR #203 Browser E2E `35850980615` passed desktop + mobile-landscape full regression/production build and live player journeys on tested head `b1a99eea4349570935b40a161e6cecd5f6280805`.
  - Merged gameplay/test source `5098b11eab9dd998d5ca30ce7bda0ecabfa8bbdb` passed post-merge Browser E2E `35851255575` and Level 15 beta smoke `35851255591`.
  - Android beta.291 run `35851255605` passed the full web regression/build, native project generation, debug APK build, package/version/min-SDK/target-SDK/signature verification, Android emulator install/cold launch/touch/runtime QA, and the Chapter 3 touch playthrough.
  - Android artifact `10745671957` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.291`, debug signing, min SDK 24 / target SDK 36, and APK SHA-256 `7d7ef186f1e2b6bc93486e44338e73a60b7aa758608c173d9bad04539e984e5f`.
  - **Next: P15-A — Design system.**

## 2026-09-23 — P15-A AAA UI / World / Cinematic Polish // Design system

- [x] **P15-A Design system** — established one shared UI foundation for the remaining P15 presentation work instead of adding another screen-specific styling layer.
  - Added `src/designSystem.css` with centralized typography, a 4px spacing rhythm, normalized icon sizing/stroke weight, shared surfaces/borders/text colors, safe-area layout variables, and responsive coarse-pointer rules.
  - Added a global visible `:focus-visible` language plus reusable `.iv-panel`, glass-panel, tooltip, stack/cluster/grid/content, and icon primitives so class selection, progression, crafting, systems, debrief, and accessibility work can converge on the same presentation grammar.
  - Bound Field / Refined / Prototype / Singular UI rarity tokens directly to the canonical Gear 2.0 contract in `src/game/rarity.ts`, preserving the existing rarity colors while adding non-color shape cues.
  - Wired the design system into the client root and moved the root font/text/background shell onto shared semantic tokens without changing gameplay behavior or save data.
  - Added `tests/design-system.ts` and wired `test:design-system` into the production build. The gate checks typography/spacing/icon/focus/panel/tooltip/responsive primitives and prevents rarity-token drift from the canonical rarity contract.
  - Added `docs/design-system.md` as the concise reuse contract for subsequent P15 batches.
  - PR #204 Browser E2E `35852741516` passed desktop + mobile-landscape full regression/production build and live player journeys on tested head `961a71ae4f355341f9f541972e5ec7998c0e769e`.
  - Merged source `4d7e38851d0112c4969a0181aa5d450ecba26ca7` passed post-merge Browser E2E `35853095774` and Level 15 beta smoke `35853095964`.
  - Android beta.292 run `35853095916` passed the full web regression/build, native project generation, debug APK build, package/version/min-SDK/target-SDK/signature verification, Android emulator install/cold launch/touch/runtime/lifecycle QA, authored-content checks, and the Chapter 3 touch playthrough.
  - Android artifact `10745978662` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.292`, debug signing, min SDK 24 / target SDK 36, and APK SHA-256 `b4f990cc478a1b0a64ee27839787fcb26979ad67b95786afb6508bc4ccf7155f`.
  - **Next: P15-B — Build/menu presentation.**

## 2026-09-23 — P15-B AAA UI / World / Cinematic Polish // Build/menu presentation

- [x] **P15-B Build/menu presentation** — brought class intake, operator Build/Crafting/Progression, and Ship Systems onto the shared P15-A presentation language while preserving mobile readability and input behavior.
  - Composed the primary menu flows with the shared `.iv-view`, `.iv-panel`, and glass-panel primitives instead of adding another screen-local foundation; feature art direction remains layered on the centralized P15-A tokens.
  - Added one shared 180 ms menu-entry transition with a reduced-motion override, plus shared border/radius/spacing use in the Build and Ship presentation bridge.
  - Added active-page semantics to Build tabs and retained the existing class `aria-pressed`, ship `aria-current`, Operator Network keyboard/controller navigation, and native touch controls. Coarse-pointer Build/Ship section tabs are held to 44 px minimum targets.
  - Kept gear inspection DOM-based after evaluation: the existing base/implicit → explicit modifiers → augments → build links → loadout-impact comparison hierarchy and Android single-scroller inspector provide more actionable inspection on phones than a new 3D viewport, without adding renderer/memory/thermal cost.
  - Added `tests/menu-presentation.ts`, wired `test:menu-presentation` into the production build, and expanded browser + Android runtime smoke to navigate Crafting, Progression, Skills, and Ship Systems with keyboard/touch while checking shared primitives, horizontal fit, and mobile target sizing.
  - PR #205 Browser E2E `35857080245` passed desktop + mobile-landscape full regression/production build and live player journeys on tested head `db2eeac2b49a75f4b4624ecc029a24ef37537615`.
  - Merged source `ae7e2ee34a31d0d8d94042c98b122a4ab81049c9` passed post-merge Browser E2E `35857457487` and Level 15 beta smoke `35857457471`.
  - Android beta.293 run `35857457403` passed the full web regression/build, native project generation, debug APK build, package/version/min-SDK/target-SDK/signature verification, Android emulator install/cold launch/touch/runtime/lifecycle QA, authored-content checks, and the Chapter 3 touch playthrough.
  - Android artifact `10748014619` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.293`, debug signing, min SDK 24 / target SDK 36, and APK SHA-256 `bef5d9d9792673ebc8f0fe75510b6fffdfa3c21a2816ff34349fdf1b16ed3392`.
  - **Next: P15-C — Mission/boss/debrief.**

## 2026-09-23 — P15-C AAA UI / World / Cinematic Polish // Mission/boss/debrief

- [x] **P15-C Mission/boss/debrief** — polished the mission presentation loop end to end without changing combat, extraction, reward, or save-state behavior.
  - Added non-blocking in-engine deployment callouts with operation tier, monster level, contract title, location, objective, and condition/director context. The presentation is pointer-transparent, safe-area-aware, coarse-pointer responsive, and reduced-motion-safe so movement, aim, fire, abilities, and touch controls remain live.
  - Added concise command-target contact and boss phase-shift callouts driven by the existing boss-active/phase state and mutation labels; transitions clear automatically and never insert a modal or pause state into combat.
  - Promoted debrief highlights for the top kept recovery, XP/progression outcome, and the next actionable unlock or newly crossed reputation milestone while preserving the existing detailed reward, expedition, loot review, telemetry, and story update surfaces.
  - Added `src/missionPresentation.css`, `tests/mission-presentation.ts`, and the `test:mission-presentation` production-build gate. Browser and Android smoke now verify the live deployment treatment is onscreen and `pointer-events: none`.
  - PR #206 Browser E2E `35860082406` passed desktop + mobile-landscape full regression/production build and live player journeys on tested head `07d131de048d1ed1db9e039b162da4f3d71d5655`.
  - Merged source `2df0fa9027be5aeff7d3ca339f85030a114a0894` passed post-merge Browser E2E `35860497636` and Level 15 beta smoke `35860497630`.
  - Android beta.294 run `35860497769` passed the full web regression/build, native project generation, debug APK build, package/version/min-SDK/target-SDK/signature verification, Android emulator install/cold launch/touch/runtime/lifecycle QA, authored-content checks, and the Chapter 3 touch playthrough.
  - Android artifact `10749689022` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.294`, debug signing, min SDK 24 / target SDK 36, and APK SHA-256 `2f4707c2b2abfa826185c0341fc10c37ed9518ac7c40b827750bd1874dc921d9`.
  - **Next: P15-D — World/material polish.**

## 2026-09-23 — P15-D AAA UI / World / Cinematic Polish // World/material polish

- [x] **P15-D World/material polish** — improved in-world interactable, hazard, pickup, material-depth, and biome-state readability through one adaptive presentation contract while preserving combat information and performance scaling.
  - Added `src/game/worldMaterialPolish.ts` as the shared presentation contract for priority interactables, hazards, material response, adaptive world quality, and derived biome world states.
  - Priority consoles/controls and salvage nodes now carry shape-coded floor/status cues in the Three.js renderer, with shared Canvas fallback cues. State changes remain distinguishable without relying on color alone.
  - Hazards now use distinct shape/footprint/motion signatures while preserving their floor-bound read; Performance mode reduces secondary motion/material depth before reducing critical interactable or hazard cue opacity.
  - Procedural world objects now use material-specific metalness/roughness response, the world floor receives subtle state-linked emissive depth, and pickup beams scale down independently from the persistent rarity/shape marker.
  - Biome/world conditions now derive explicit runtime states such as pressure-critical, Solar Yard surge, Spin Habitat imbalance, Jovian storm shear, and Ice Mine bore fracture, with coupled animation telemetry and transition audio cues that avoid duplicating same-frame environment audio.
  - Added `tests/world-material-polish.ts`, wired `test:world-material-polish` into the production build, and extended browser runtime QA to require interactable/hazard/loot readability plus material-depth and biome-state telemetry.
  - PR #207 Browser E2E `35863304853` passed desktop + mobile-landscape full regression/production build and live player journeys on tested head `7cfc06cd2c60db09bcb86522e66523137997bf63`.
  - Merged gameplay source `c5a31cb8cbe18f7ff87de679adf1aa495f439126` passed post-merge Browser E2E `35863645708` and Level 15 beta smoke `35863645735`. Android beta.295 built and passed package/version/SDK/signature verification but exposed a smoke-harness race where the transient P15-C deployment cue disappeared between two DOM reads, so P15-D remained open.
  - Follow-up main commits `e84a2c2c5349f42427ab441462dd36f5e80d6b11` and `7e0abd2e94eff09607700ec42c127d4186d1ae87` made the Android deployment-cue assertion atomic and aligned the mission-presentation regression with that verification without changing gameplay behavior.
  - Final main verification passed Browser E2E `35864833185` on desktop + mobile-landscape, Level 15 beta smoke `35864833158`, and Android beta.297 run `35864833087`.
  - Android beta.297 passed the full web regression/build, native project generation, debug APK build, package/version/min-SDK/target-SDK/signature verification, emulator install/cold launch, class/menu/skill/touch/runtime QA, authored-content checks, and Chapter 3 touch playthrough. The repaired deployment check reported `deployment=non-blocking+onscreen`.
  - Android artifact `10752462773` contains `Ironshade-Vector-Android-Beta.apk`, package `app.ironshade.vector`, version `0.0.1-beta.297`, debug signing, min SDK 24 / target SDK 36, and APK SHA-256 `adaa90a95c1365e837ff0b65328ee68a650458960d84a0b1178c83db171881ee`.
  - **Next: P15-E — Accessibility/mobile/screenshot gate.**

