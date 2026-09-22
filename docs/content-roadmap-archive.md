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

