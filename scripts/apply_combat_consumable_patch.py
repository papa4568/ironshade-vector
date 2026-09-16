from pathlib import Path

Path('src/game/consumables.ts').write_text("""export type ConsumableId = 'medGel' | 'armorPatch' | 'capacitorCell';
export type ConsumableInventory = Record<ConsumableId, number>;

export type ConsumableDefinition = {
  id: ConsumableId;
  name: string;
  shortName: string;
  description: string;
  effect: string;
  cost: number;
  maxStock: number;
  hotkey: '4' | '5' | '6';
};

export const consumableDefinitions: ConsumableDefinition[] = [
  { id: 'medGel', name: 'Trauma Gel', shortName: 'MED', description: 'Rapid clotting and tissue-seal pack for emergency suit treatment.', effect: 'Restore 40 health.', cost: 45, maxStock: 6, hotkey: '4' },
  { id: 'armorPatch', name: 'Armor Sealant', shortName: 'PATCH', description: 'Pressure-rated plate foam and ceramic weave for field armor repair.', effect: 'Restore 35 armor.', cost: 40, maxStock: 6, hotkey: '5' },
  { id: 'capacitorCell', name: 'Capacitor Cell', shortName: 'CELL', description: 'Disposable high-density cell with a thermal sink coupling.', effect: 'Restore 45 capacitor and vent 24% weapon heat.', cost: 35, maxStock: 6, hotkey: '6' },
];

export function defaultConsumables(): ConsumableInventory {
  return { medGel: 1, armorPatch: 0, capacitorCell: 0 };
}

export function consumableDefinition(id: ConsumableId) {
  return consumableDefinitions.find(item => item.id === id) ?? consumableDefinitions[0];
}
""")

# Campaign persistence and Credits shop.
p = Path('src/game/campaign.ts')
text = p.read_text()
anchor = "import type { CombatBuild } from './sim';\n"
if anchor not in text:
    raise SystemExit('campaign import anchor missing')
text = text.replace(anchor, anchor + "import { consumableDefinition, defaultConsumables, type ConsumableId, type ConsumableInventory } from './consumables';\n", 1)
anchor = "export type CampaignState = { version: 1; cycle: number; contractsCompleted: number; resources: SalvageWallet; reputation:"
if anchor not in text:
    raise SystemExit('CampaignState anchor missing')
text = text.replace(anchor, "export type CampaignState = { version: 1; cycle: number; contractsCompleted: number; resources: SalvageWallet; consumables: ConsumableInventory; reputation:", 1)
anchor = "resources: { credits: 120, alloys: 1, electronics: 1, medstock: 1, components: 0, rareTech: 0 }, reputation:"
if anchor not in text:
    raise SystemExit('campaign default anchor missing')
text = text.replace(anchor, "resources: { credits: 120, alloys: 1, electronics: 1, medstock: 1, components: 0, rareTech: 0 }, consumables: defaultConsumables(), reputation:", 1)
anchor = "resources: { ...defaults.resources, ...parsed.resources },\n      reputation:"
if anchor not in text:
    raise SystemExit('campaign load anchor missing')
text = text.replace(anchor, "resources: { ...defaults.resources, ...parsed.resources },\n      consumables: { ...defaults.consumables, ...parsed.consumables },\n      reputation:", 1)
save_anchor = "export function saveCampaign(campaign: CampaignState) { if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(campaign)); }\n"
if save_anchor not in text:
    raise SystemExit('campaign save anchor missing')
shop = """
export function buyConsumable(campaign: CampaignState, id: ConsumableId) {
  const definition = consumableDefinition(id);
  const current = campaign.consumables[id] ?? 0;
  if (current >= definition.maxStock) return { campaign, message: `${definition.name} stock is full (${definition.maxStock}).` };
  if (campaign.resources.credits < definition.cost) return { campaign, message: `Need ${definition.cost} Credits for ${definition.name}.` };
  return {
    campaign: {
      ...campaign,
      resources: { ...campaign.resources, credits: campaign.resources.credits - definition.cost },
      consumables: { ...campaign.consumables, [id]: current + 1 },
    },
    message: `${definition.name} purchased // ${current + 1}/${definition.maxStock} stocked // ${definition.cost} Credits spent.`,
  };
}
"""
text = text.replace(save_anchor, save_anchor + shop, 1)
p.write_text(text)

# Simulation: assisted-aim interpolation, 1-HP lethal semantics, field supplies.
p = Path('src/game/sim.ts')
text = p.read_text()
anchor = "import type { EnemyCombatClass, EnemyProtocolInstance } from './eliteProtocols';\n"
if anchor not in text:
    raise SystemExit('sim import anchor missing')
text = text.replace(anchor, anchor + "import type { ConsumableId } from './consumables';\n", 1)
anchor = "dodgeTime: number; invulnerable: number; weaponHeat:"
if anchor not in text:
    raise SystemExit('Player cooldown anchor missing')
text = text.replace(anchor, "dodgeTime: number; invulnerable: number; consumableCooldown: number; weaponHeat:", 1)
norm_anchor = "function norm(v: Vec2): Vec2 { const l = len(v); return l > 0.0001 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 }; }\n"
if norm_anchor not in text:
    raise SystemExit('norm anchor missing')
rotate_helper = """function rotateAimToward(current: Vec2, desired: Vec2, maxRadians: number): Vec2 {
  const target = norm(desired);
  if (len(target) < 0.1) return current;
  const currentAngle = Math.atan2(current.y, current.x);
  const targetAngle = Math.atan2(target.y, target.x);
  const delta = Math.atan2(Math.sin(targetAngle - currentAngle), Math.cos(targetAngle - currentAngle));
  if (Math.abs(delta) <= maxRadians) return target;
  const next = currentAngle + Math.sign(delta) * maxRadians;
  return { x: Math.cos(next), y: Math.sin(next) };
}
"""
text = text.replace(norm_anchor, norm_anchor + rotate_helper, 1)
old_damage = """function damagePlayer(state: SimState, amount: number, armorPierce = 0) {
  const p = state.player; if (p.invulnerable > 0 || p.dead) return;
  const bypass = clamp(armorPierce, 0, 1);
  const directHealthDamage = amount * bypass;
  const blockableDamage = Math.max(0, amount - directHealthDamage);
  const armorTake = Math.min(p.armor, blockableDamage);
  p.armor -= armorTake;
  const healthDamage = directHealthDamage + Math.max(0, blockableDamage - armorTake);
  const appliedHealthDamage = Math.min(p.hp, Math.max(0, healthDamage));
  p.hp -= appliedHealthDamage;
  state.telemetry.damageTaken += armorTake + appliedHealthDamage;
  if (p.hp <= 0) { p.hp = 0; p.dead = true; p.vx *= 0.25; p.vy *= 0.25; state.telemetry.deaths += 1; }
}
"""
new_damage = """export function applyPlayerDamage(state: SimState, amount: number, armorPierce = 0) {
  const p = state.player; if (p.invulnerable > 0 || p.dead || amount <= 0) return;
  const wasCritical = p.hp <= 1;
  const bypass = clamp(armorPierce, 0, 1);
  const directHealthDamage = amount * bypass;
  const blockableDamage = Math.max(0, amount - directHealthDamage);
  const armorTake = Math.min(p.armor, blockableDamage);
  p.armor -= armorTake;
  const healthDamage = directHealthDamage + Math.max(0, blockableDamage - armorTake);
  const appliedHealthDamage = Math.min(p.hp, Math.max(0, healthDamage));
  p.hp = Math.max(0, p.hp - appliedHealthDamage);
  state.telemetry.damageTaken += armorTake + appliedHealthDamage;
  if (p.hp <= 0 || wasCritical) { p.hp = 0; p.dead = true; p.vx *= 0.25; p.vy *= 0.25; state.telemetry.deaths += 1; }
}
"""
if old_damage not in text:
    raise SystemExit('damage function anchor missing')
text = text.replace(old_damage, new_damage, 1)
text = text.replace('damagePlayer(state', 'applyPlayerDamage(state')
anchor = "dodgeCooldown: 0, dodgeTime: 0, invulnerable: 0, weaponHeat:"
if anchor not in text:
    raise SystemExit('player init anchor missing')
text = text.replace(anchor, "dodgeCooldown: 0, dodgeTime: 0, invulnerable: 0, consumableCooldown: 0, weaponHeat:", 1)
anchor = "p.dodgeTime = Math.max(0, p.dodgeTime - dt); p.invulnerable = Math.max(0, p.invulnerable - dt); p.disrupted = Math.max(0, p.disrupted - dt);"
if anchor not in text:
    raise SystemExit('step player cooldown anchor missing')
text = text.replace(anchor, "p.dodgeTime = Math.max(0, p.dodgeTime - dt); p.invulnerable = Math.max(0, p.invulnerable - dt); p.consumableCooldown = Math.max(0, p.consumableCooldown - dt); p.disrupted = Math.max(0, p.disrupted - dt);", 1)
anchor = "p.aim = scored.direction;\n      return preferred.id;"
if anchor not in text:
    raise SystemExit('preferred aim anchor missing')
text = text.replace(anchor, "p.aim = rotateAimToward(p.aim, scored.direction, mode === 'balanced' ? 0.14 : 0.18);\n      return preferred.id;", 1)
anchor = "p.aim = best.direction;\n  return best.enemy.id;"
if anchor not in text:
    raise SystemExit('best aim anchor missing')
text = text.replace(anchor, "p.aim = rotateAimToward(p.aim, best.direction, mode === 'balanced' ? 0.14 : 0.18);\n  return best.enemy.id;", 1)
vent_index = text.find("export function triggerVent(state: SimState)")
fire_index = text.find("\nexport function triggerFire(state: SimState)", vent_index)
if vent_index < 0 or fire_index < 0:
    raise SystemExit('consumable insertion anchor missing')
consumable_fn = """

export function triggerConsumable(state: SimState, id: ConsumableId) {
  const p = state.player;
  if (p.dead || state.complete || p.consumableCooldown > 0) return false;
  if (id === 'medGel') {
    if (p.hp >= p.maxHp) return false;
    p.hp = Math.min(p.maxHp, p.hp + 40);
    pushEvent(state, 'TRAUMA GEL // +40 HEALTH', 1.2);
  } else if (id === 'armorPatch') {
    if (p.armor >= p.maxArmor) return false;
    p.armor = Math.min(p.maxArmor, p.armor + 35);
    pushEvent(state, 'ARMOR SEALANT // +35 ARMOR', 1.2);
  } else {
    const hot = (['carbine', 'breacher', 'rail'] as WeaponId[]).some(weapon => p.weaponHeat[weapon] > 0.02);
    if (p.capacitor >= p.maxCapacitor && !hot) return false;
    p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 45);
    for (const weapon of ['carbine', 'breacher', 'rail'] as WeaponId[]) p.weaponHeat[weapon] = Math.max(0, p.weaponHeat[weapon] - 0.24);
    pushEvent(state, 'CAPACITOR CELL // +45 CAP // THERMAL SINK', 1.2);
  }
  p.consumableCooldown = 1.25;
  return true;
}
"""
text = text[:fire_index] + consumable_fn + text[fire_index:]
p.write_text(text)

# GameCanvas state, controls, and combat HUD.
p = Path('src/components/GameCanvas.tsx')
text = p.read_text()
anchor = "import type { ProfileSettings } from '../game/meta';\n"
if anchor not in text:
    raise SystemExit('GameCanvas consumable import anchor missing')
text = text.replace(anchor, anchor + "import { consumableDefinitions, type ConsumableId, type ConsumableInventory } from '../game/consumables';\n", 1)
anchor = "triggerReload, triggerVent, weaponConfigs"
if anchor not in text:
    raise SystemExit('GameCanvas sim import anchor missing')
text = text.replace(anchor, "triggerReload, triggerVent, triggerConsumable, weaponConfigs", 1)
anchor = "type Props = { build: CombatBuild; mission: Contract; profileSettings: ProfileSettings;"
if anchor not in text:
    raise SystemExit('GameCanvas props anchor missing')
text = text.replace(anchor, "type Props = { build: CombatBuild; mission: Contract; profileSettings: ProfileSettings; consumables: ConsumableInventory;", 1)
anchor = "onProfileSettingsChange: (settings: Partial<ProfileSettings>) => void; onMissionResolve:"
if anchor not in text:
    raise SystemExit('GameCanvas callback anchor missing')
text = text.replace(anchor, "onProfileSettingsChange: (settings: Partial<ProfileSettings>) => void; onConsumablesChange: (consumables: ConsumableInventory) => void; onMissionResolve:", 1)
anchor = "vacuumExposure: number; disrupted: number; damageDealt:"
if anchor not in text:
    raise SystemExit('HudState anchor missing')
text = text.replace(anchor, "vacuumExposure: number; disrupted: number; consumableCooldown: number; damageDealt:", 1)
anchor = "vacuumExposure: p.vacuumExposure, disrupted: p.disrupted, damageDealt:"
if anchor not in text:
    raise SystemExit('hudFrom anchor missing')
text = text.replace(anchor, "vacuumExposure: p.vacuumExposure, disrupted: p.disrupted, consumableCooldown: p.consumableCooldown, damageDealt:", 1)
old_sig = "export default function GameCanvas({ build, mission, profileSettings, buildLabel, operatorFaction, onProfileSettingsChange, onMissionResolve, onAttemptFailed, onReturnToHub }: Props)"
new_sig = "export default function GameCanvas({ build, mission, profileSettings, consumables, buildLabel, operatorFaction, onProfileSettingsChange, onConsumablesChange, onMissionResolve, onAttemptFailed, onReturnToHub }: Props)"
if old_sig not in text:
    raise SystemExit('GameCanvas signature anchor missing')
text = text.replace(old_sig, new_sig, 1)
anchor = "  const restart = useCallback(() =>"
if anchor not in text:
    raise SystemExit('GameCanvas stock state anchor missing')
stock_block = """  const consumableStockRef = useRef<ConsumableInventory>({ ...consumables });
  const [consumableStock, setConsumableStock] = useState<ConsumableInventory>(() => ({ ...consumables }));
  useEffect(() => {
    consumableStockRef.current = { ...consumables };
    setConsumableStock({ ...consumables });
  }, [consumables]);
"""
text = text.replace(anchor, stock_block + anchor, 1)
interact_anchor = "  const useInteract = useCallback(() => { feedback.unlock(); if (triggerInteract(stateRef.current)) advanceTutorial(4); }, [advanceTutorial]);\n"
if interact_anchor not in text:
    raise SystemExit('GameCanvas action anchor missing')
use_cons = """  const useConsumable = useCallback((id: ConsumableId) => {
    feedback.unlock();
    const current = consumableStockRef.current;
    if ((current[id] ?? 0) <= 0) return false;
    if (!triggerConsumable(stateRef.current, id)) return false;
    const next = { ...current, [id]: current[id] - 1 };
    consumableStockRef.current = next;
    setConsumableStock(next);
    onConsumablesChange(next);
    feedback.cue('ability');
    return true;
  }, [onConsumablesChange]);
"""
text = text.replace(interact_anchor, interact_anchor + use_cons, 1)
anchor = "if (event.code === 'Digit3') selectWeapon(stateRef.current, 'rail');"
if anchor not in text:
    raise SystemExit('keyboard consumable anchor missing')
text = text.replace(anchor, anchor + " if (event.code === 'Digit4') useConsumable('medGel'); if (event.code === 'Digit5') useConsumable('armorPatch'); if (event.code === 'Digit6') useConsumable('capacitorCell');", 1)
anchor = "[advanceTutorial, useAbility, useDodge, useInteract]);"
if anchor not in text:
    raise SystemExit('keyboard dependency anchor missing')
text = text.replace(anchor, "[advanceTutorial, useAbility, useDodge, useInteract, useConsumable]);", 1)
anchor = "const dodgeReady = hud.dodge <= 0; const statusItems"
if anchor not in text:
    raise SystemExit('consumable ready anchor missing')
text = text.replace(anchor, "const dodgeReady = hud.dodge <= 0; const consumableReady = hud.consumableCooldown <= 0 && !hud.dead; const statusItems", 1)
anchor = "    <div className=\"desktop-actions\">{abilityMeta.map"
if anchor not in text:
    raise SystemExit('combat consumable HUD anchor missing')
consumable_hud = """    <div className="combat-consumables" aria-label="Field consumables">{consumableDefinitions.map(item => <button key={item.id} aria-label={item.name} disabled={!consumableReady || consumableStock[item.id] <= 0} onClick={() => useConsumable(item.id)}><small>{item.hotkey}</small><b>{item.shortName}</b><span>x{consumableStock[item.id]}</span></button>)}</div>
"""
text = text.replace(anchor, consumable_hud + anchor, 1)
p.write_text(text)

# App data flow and styles.
p = Path('src/App.tsx')
text = p.read_text()
anchor = "import './equipmentBay.css';\n"
if anchor not in text:
    raise SystemExit('App CSS anchor missing')
text = text.replace(anchor, anchor + "import './consumables.css';\n", 1)
old_game = "<GameCanvas key={selectedContract.id} build={combatBuild} mission={selectedContract} profileSettings={profile.settings} buildLabel={buildIdentity(profile)} operatorFaction={dominantEquipmentFaction(profile)} onProfileSettingsChange={changeProfileSettings} onMissionResolve={finishMission}"
new_game = "<GameCanvas key={selectedContract.id} build={combatBuild} mission={selectedContract} profileSettings={profile.settings} consumables={campaign.consumables} buildLabel={buildIdentity(profile)} operatorFaction={dominantEquipmentFaction(profile)} onProfileSettingsChange={changeProfileSettings} onConsumablesChange={consumables => setCampaign(current => ({ ...current, consumables }))} onMissionResolve={finishMission}"
if old_game not in text:
    raise SystemExit('App GameCanvas wiring anchor missing')
text = text.replace(old_game, new_game, 1)
p.write_text(text)

# Ship cargo store.
p = Path('src/components/ShipHub.tsx')
text = p.read_text()
anchor = "  buyShipUpgrade,\n"
if anchor not in text:
    raise SystemExit('ShipHub campaign import anchor missing')
text = text.replace(anchor, anchor + "  buyConsumable,\n", 1)
anchor = "import { bossSingularNames, buildIdentity, locationSingularNames, namedSingularCount, type PlayerProfile } from '../game/meta';\n"
if anchor not in text:
    raise SystemExit('ShipHub consumable import anchor missing')
text = text.replace(anchor, anchor + "import { consumableDefinitions, type ConsumableId } from '../game/consumables';\n", 1)
anchor = "  const inspectTrace = async (id: string) => {\n"
if anchor not in text:
    raise SystemExit('ShipHub buy function anchor missing')
buy_supply = """  const buySupply = (id: ConsumableId) => {
    const result = buyConsumable(campaign, id);
    onCampaignChange(result.campaign);
    setMessage(result.message);
  };
"""
text = text.replace(anchor, buy_supply + anchor, 1)
cargo_anchor = "{tab === 'cargo' && <section className=\"cargo-panel\"><article className=\"cargo-ledger\"><span className=\"card-kicker\">CARGO / SALVAGE LEDGER</span>"
if cargo_anchor not in text:
    raise SystemExit('ShipHub cargo store anchor missing')
store = """{tab === 'cargo' && <section className="cargo-panel"><article className="consumable-store"><span className="card-kicker">FIELD CONSUMABLES // SHIP STORE</span><h2>Spend Credits on deployment supplies</h2><p>Credits are the field currency. Supplies persist in Quiet Signal storage and are only consumed when an effect successfully activates in combat.</p><div className="consumable-credit-balance"><small>AVAILABLE CREDITS</small><b>{campaign.resources.credits}</b></div><div className="consumable-shop-grid">{consumableDefinitions.map(item => { const stock = campaign.consumables[item.id]; const full = stock >= item.maxStock; const affordable = campaign.resources.credits >= item.cost; return <div key={item.id} className="consumable-shop-card"><header><div><small>{item.hotkey} // {item.shortName}</small><b>{item.name}</b></div><strong>{stock}/{item.maxStock}</strong></header><p>{item.description}</p><span>{item.effect}</span><button disabled={full || !affordable} onClick={() => buySupply(item.id)}>{full ? 'Stock full' : `Buy // ${item.cost} Credits`}</button></div>; })}</div></article><article className="cargo-ledger"><span className="card-kicker">CARGO / SALVAGE LEDGER</span>"""
text = text.replace(cargo_anchor, store, 1)
p.write_text(text)

Path('src/consumables.css').write_text(""".consumable-store {
  grid-column: 1 / -1;
  border: 1px solid rgba(133, 184, 169, .26);
  background: linear-gradient(145deg, rgba(18, 31, 30, .96), rgba(9, 16, 17, .98));
  padding: 18px;
}
.consumable-store h2 { margin: 6px 0 4px; }
.consumable-store > p { margin: 0 0 14px; color: rgba(213, 229, 222, .72); max-width: 760px; }
.consumable-credit-balance { display: inline-flex; gap: 10px; align-items: baseline; padding: 8px 12px; border: 1px solid rgba(213, 178, 96, .32); background: rgba(213, 178, 96, .07); margin-bottom: 14px; }
.consumable-credit-balance small { letter-spacing: .09em; }
.consumable-credit-balance b { font-size: 1.3rem; }
.consumable-shop-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.consumable-shop-card { border: 1px solid rgba(133, 184, 169, .2); background: rgba(5, 11, 12, .58); padding: 12px; display: grid; gap: 9px; }
.consumable-shop-card header { display: flex; justify-content: space-between; gap: 12px; }
.consumable-shop-card header div { display: grid; gap: 2px; }
.consumable-shop-card header small { color: rgba(174, 211, 200, .68); letter-spacing: .08em; }
.consumable-shop-card header strong { font-size: 1.05rem; }
.consumable-shop-card p, .consumable-shop-card span { margin: 0; color: rgba(215, 229, 224, .72); }
.consumable-shop-card span { color: rgba(197, 225, 162, .88); font-weight: 700; }
.consumable-shop-card button { min-height: 42px; }
.combat-consumables { position: absolute; z-index: 24; right: 14px; top: 152px; display: flex; gap: 6px; pointer-events: auto; }
.combat-consumables button { min-width: 64px; min-height: 50px; padding: 6px 8px; border: 1px solid rgba(171, 218, 196, .28); background: rgba(8, 15, 16, .88); color: #d8e8e1; display: grid; grid-template-columns: auto auto; grid-template-areas: 'key count' 'name name'; gap: 2px 7px; align-items: center; }
.combat-consumables button small { grid-area: key; opacity: .65; }
.combat-consumables button b { grid-area: name; font-size: .72rem; letter-spacing: .08em; }
.combat-consumables button span { grid-area: count; justify-self: end; font-weight: 800; color: #c5e1a2; }
.combat-consumables button:disabled { opacity: .36; }
@media (max-width: 900px), (pointer: coarse) {
  .consumable-shop-grid { grid-template-columns: 1fr; }
  .combat-consumables { top: 58px; right: 8px; gap: 4px; }
  .combat-consumables button { min-width: 54px; min-height: 42px; padding: 4px 6px; }
  .combat-consumables button small { display: none; }
}
""")

Path('tests/gameplay-regressions.ts').write_text("""import assert from 'node:assert/strict';
import { buyConsumable, createDefaultCampaign, loadCampaign, saveCampaign } from '../src/game/campaign';
import { aimAtMobileTarget, applyPlayerDamage, createSimulation, triggerConsumable } from '../src/game/sim';

const storage = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, String(value)); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
};
(globalThis as unknown as { window: { localStorage: typeof localStorage } }).window = { localStorage };

const migratedSource = createDefaultCampaign();
const { consumables: _oldConsumables, ...legacyCampaign } = migratedSource;
localStorage.setItem('ironshade-vector-campaign-v1', JSON.stringify(legacyCampaign));
const migrated = loadCampaign();
assert.deepEqual(migrated.consumables, { medGel: 1, armorPatch: 0, capacitorCell: 0 }, 'existing saves should receive compatible default consumable storage');

let campaign = createDefaultCampaign();
const creditsBefore = campaign.resources.credits;
const stockBefore = campaign.consumables.medGel;
const purchase = buyConsumable(campaign, 'medGel');
campaign = purchase.campaign;
assert.equal(campaign.resources.credits, creditsBefore - 45, 'Trauma Gel should cost Credits');
assert.equal(campaign.consumables.medGel, stockBefore + 1, 'purchase should increase persistent stock');
saveCampaign(campaign);
assert.equal(loadCampaign().consumables.medGel, stockBefore + 1, 'consumable stock should round-trip through campaign save');

const healState = createSimulation();
healState.player.hp = 25;
assert.equal(triggerConsumable(healState, 'medGel'), true);
assert.equal(healState.player.hp, 65);
assert.equal(triggerConsumable(healState, 'medGel'), false, 'consumables should respect the shared use cooldown');
healState.player.consumableCooldown = 0;
healState.player.armor = 10;
assert.equal(triggerConsumable(healState, 'armorPatch'), true);
assert.equal(healState.player.armor, 45);
healState.player.consumableCooldown = 0;
healState.player.capacitor = 20;
healState.player.weaponHeat.carbine = 0.8;
assert.equal(triggerConsumable(healState, 'capacitorCell'), true);
assert.equal(healState.player.capacitor, 65);
assert.ok(Math.abs(healState.player.weaponHeat.carbine - 0.56) < 0.0001);

const deathState = createSimulation();
deathState.player.hp = 1;
deathState.player.armor = deathState.player.maxArmor;
applyPlayerDamage(deathState, 5, 0);
assert.equal(deathState.player.dead, true, 'a real damaging hit at displayed 1 HP must be lethal');
assert.equal(deathState.player.hp, 0);
assert.equal(deathState.telemetry.deaths, 1);

const aimState = createSimulation();
aimState.player.x = 1000;
aimState.player.y = 500;
aimState.player.aim = { x: 1, y: 0 };
for (const enemy of aimState.enemies) enemy.active = false;
const target = aimState.enemies.find(enemy => enemy.id === 1)!;
target.active = true;
target.dead = false;
target.x = 700;
target.y = 500;
assert.equal(aimAtMobileTarget(aimState, 'balanced', target.id), target.id);
assert.ok(aimState.player.aim.x > 0.95, 'first target-switch frame should turn toward the new target instead of snapping 180 degrees');
for (let i = 0; i < 30; i += 1) aimAtMobileTarget(aimState, 'balanced', target.id);
assert.ok(aimState.player.aim.x < -0.95, 'assisted aim should still converge fully on the target');

console.log(`GAMEPLAY_REGRESSIONS_PASS credits=${campaign.resources.credits} med=${campaign.consumables.medGel} hp=${deathState.player.hp} aim=${aimState.player.aim.x.toFixed(3)}`);
""")

p = Path('package.json')
text = p.read_text()
old = '"test:beta": "tsc --noEmit && vite build --ssr tests/beta-level15.ts --outDir .beta-dist && node .beta-dist/beta-level15.js",\n    "build": "npm run test:beta && vite build"'
new = '"test:beta": "tsc --noEmit && vite build --ssr tests/beta-level15.ts --outDir .beta-dist && node .beta-dist/beta-level15.js",\n    "test:gameplay": "vite build --ssr tests/gameplay-regressions.ts --outDir .gameplay-dist && node .gameplay-dist/gameplay-regressions.js",\n    "build": "npm run test:beta && npm run test:gameplay && vite build"'
if old not in text:
    raise SystemExit('package script anchor missing')
p.write_text(text.replace(old, new, 1))
