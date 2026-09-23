import { useMemo, useState } from 'react';
import '../classSelection.css';
import { classAbilityKits } from '../game/classSkills';
import { classSkillIconAssets, operatorClassIconAssets } from '../game/mobileUiAssets';
import {
  gearResonanceForProfile,
  operatorClassDefinitions,
  operatorClassForProfile,
  operatorClassOnboardingRecovery,
  specializationDefinitions,
  type OperatorClassId,
  type PlayerProfile,
} from '../game/meta';

type Props = {
  profile: PlayerProfile;
  onConfirm: (operatorClass: OperatorClassId) => void;
};

type IntakeCopy = {
  role: string;
  learning: string;
  range: string;
  pitch: string;
  summary: string;
  strengths: [string, string, string];
  firstFight: string;
  watchFor: string;
};

const classIntakeCopy: Record<OperatorClassId, IntakeCopy> = {
  vanguard: {
    role: 'Frontline',
    learning: 'Forgiving',
    range: 'Close range',
    pitch: 'Get in close, break armor, and stay standing.',
    summary: 'Vanguard is the most direct starting role. You create space by charging into a lane, opening armor, and using Guard when enemies collapse on you.',
    strengths: ['High survivability', 'Armor breaking', 'Close-range control'],
    firstFight: 'RUSH into range → BREAK the toughest target → GUARD when pressure spikes.',
    watchFor: 'You are strongest near enemies, so ranged threats can force you to close distance.',
  },
  vector: {
    role: 'Skirmisher',
    learning: 'Mobile',
    range: 'Mid / long range',
    pitch: 'Move first, create an angle, then land the clean shot.',
    summary: 'Vector rewards repositioning and precision. Shift or dodge to prime Slipstream, lock the important target, then fire from the new angle.',
    strengths: ['Fast repositioning', 'Precision damage', 'Strong ranged control'],
    firstFight: 'SHIFT to a new angle → LOCK a priority target → fire or SPLIT through the opening.',
    watchFor: 'Vector is less forgiving if you stand still or waste your movement windows.',
  },
  systems: {
    role: 'Controller',
    learning: 'Technical',
    range: 'Flexible range',
    pitch: 'Group enemies, spread disruption, and keep your ability loop moving.',
    summary: 'Systems plays like a combat network. You pull enemies together, hack the group, then chain Arc through the room to recycle capacitor and heat.',
    strengths: ['Crowd control', 'Ability combos', 'Resource recycling'],
    firstFight: 'WELL groups the room → HACK spreads control → CHAIN completes the loop.',
    watchFor: 'Systems gets the most value from using different abilities in sequence instead of repeating one button.',
  },
};

export default function ClassSelectScreen({ profile, onConfirm }: Props) {
  const [selectedId, setSelectedId] = useState<OperatorClassId>(() => operatorClassForProfile(profile));
  const selected = operatorClassDefinitions.find(definition => definition.id === selectedId) ?? operatorClassDefinitions[0];
  const onboarding = classIntakeCopy[selectedId];
  const resonance = useMemo(() => gearResonanceForProfile({ ...profile, operatorClass: selectedId }, selectedId), [profile, selectedId]);
  const activeKit = classAbilityKits[selectedId];
  const specializationNames = selected.specializationIds
    .map(id => specializationDefinitions.find(definition => definition.id === id)?.name)
    .filter((name): name is string => !!name);

  return <main className="class-intake iv-view" aria-label="Operator class selection">
    <div className="class-intake-backdrop" aria-hidden="true" />
    <section className="class-intake-shell">
      <header className="class-intake-header iv-panel iv-panel--glass">
        <div>
          <span>QUIET SIGNAL // OPERATOR INTAKE</span>
          <h1>Pick your combat role</h1>
          <p>Choose the way you want your first fights to feel. Your class gives you a starting skill kit, signature mechanic, and one owned weapon family; support gear stays open later.</p>
        </div>
        <aside>
          <small>GOOD TO KNOW</small>
          <b>One weapon family per class</b>
          <span>Vanguard owns Breachers, Vector owns Rail Lances, and Systems owns Carbines. Other weapons stay safely in ship storage.</span>
        </aside>
      </header>

      <section className="class-choice-section iv-panel" aria-labelledby="class-choice-heading">
        <div className="class-choice-section-head">
          <div>
            <small>STEP 1</small>
            <h2 id="class-choice-heading">Choose the role that sounds fun</h2>
          </div>
          <span>All three are fully viable. Pick the combat loop you want to learn first.</span>
        </div>

        <div className="class-choice-grid">
          {operatorClassDefinitions.map(definition => {
            const active = definition.id === selectedId;
            const copy = classIntakeCopy[definition.id];
            const kit = classAbilityKits[definition.id];
            return <button
              key={definition.id}
              type="button"
              className={`class-choice-card iv-panel class-${definition.id} ${active ? 'selected' : ''}`}
              aria-label={`Select ${definition.name} class`}
              aria-pressed={active}
              onClick={() => setSelectedId(definition.id)}
            >
              <div className="class-choice-top">
                <div className="class-choice-role">
                  <img src={operatorClassIconAssets[definition.id]} alt="" aria-hidden="true" />
                  <span>{copy.role}</span>
                </div>
                <strong>{active ? 'SELECTED' : copy.learning}</strong>
              </div>
              <h3>{definition.name}</h3>
              <b className="class-choice-pitch">{copy.pitch}</b>
              <div className="class-choice-tags" aria-label={`${definition.name} playstyle`}>
                <span>{copy.range}</span>
                {copy.strengths.slice(0, 2).map(strength => <span key={strength}>{strength}</span>)}
              </div>
              <div className="class-card-kit" aria-label={`${definition.name} starting abilities`}>
                {kit.map((ability, index) => <span key={ability.shortName}><img src={classSkillIconAssets[definition.id][index]} alt="" aria-hidden="true" /><small>{['Q', 'E', 'F'][index]}</small><b>{ability.shortName}</b></span>)}
              </div>
            </button>;
          })}
        </div>
      </section>

      <section className={`class-selected-panel iv-panel class-${selectedId}`} aria-live="polite">
        <div className="class-selected-overview">
          <div className="class-selected-heading">
            <div className="class-selected-title">
              <img src={operatorClassIconAssets[selectedId]} alt="" aria-hidden="true" />
              <div>
                <small>STEP 2 // YOUR PICK</small>
                <h2>{selected.name}</h2>
                <b>{onboarding.pitch}</b>
              </div>
            </div>
            <span>{onboarding.learning} · {onboarding.range}</span>
          </div>

          <p className="class-selected-summary">{onboarding.summary}</p>

          <div className="class-selected-facts">
            <article>
              <small>HOW TO PLAY</small>
              <b>{onboarding.firstFight}</b>
            </article>
            <article>
              <small>STARTING LOADOUT</small>
              <b>{selected.starterPair}</b>
              <span>First recovery: {operatorClassOnboardingRecovery[selected.id][0].name}</span>
            </article>
            <article>
              <small>SIGNATURE // {selected.signatureName}</small>
              <b>{selected.signatureDescription}</b>
            </article>
          </div>

          <div className="class-new-player-note">
            <small>WATCH FOR</small>
            <span>{onboarding.watchFor}</span>
          </div>
        </div>

        <div className="class-starting-kit">
          <header>
            <div>
              <small>YOUR FIRST 3 ABILITIES</small>
              <h3>These are the buttons you start with</h3>
            </div>
            <span>{onboarding.strengths.join(' · ')}</span>
          </header>
          <div className="class-starting-kit-grid">
            {activeKit.map((ability, index) => <article key={ability.shortName}>
              <div className="class-skill-key"><img src={classSkillIconAssets[selectedId][index]} alt="" aria-hidden="true" /><span>{['Q', 'E', 'F'][index]}</span></div>
              <div>
                <small>{ability.shortName}</small>
                <b>{ability.name}</b>
                <span>{ability.description}</span>
              </div>
            </article>)}
          </div>
        </div>

        <details className="class-advanced-details">
          <summary>Build details for later</summary>
          <div>
            <article>
              <small>GEAR RESONANCE</small>
              <b>{resonance.count}/4 · {resonance.tier >= 1 ? 'TIER I ACTIVE' : 'BUILDING'}</b>
              <span>{selected.resonanceTier1}</span>
            </article>
            <article>
              <small>LEVEL 15 SPECIALIZATIONS</small>
              <b>{specializationNames.join(' · ')}</b>
              <span>Specializations deepen the role later; choosing a class does not spend a progression point.</span>
            </article>
            <article>
              <small>BUILD FREEDOM</small>
              <b>{selected.branchAffinities.join(' + ')} affinity</b>
              <span>These branches synergize naturally, and every Development Network branch remains available. Your active weapon family follows your class.</span>
            </article>
          </div>
        </details>

        <div className="class-confirm-row">
          <div>
            <small>STEP 3</small>
            <b>Ready to start as {selected.name}?</b>
            <span>You can change support gear freely later. Class recalibration in Build → Progression also changes your active weapon family without discarding stored weapons.</span>
          </div>
          <button className="class-confirm" type="button" aria-label={`Confirm ${selected.name}`} onClick={() => onConfirm(selectedId)}>
            <span>Play {selected.name}</span>
            <small>Begin aboard Quiet Signal</small>
          </button>
        </div>
      </section>
    </section>
  </main>;
}
