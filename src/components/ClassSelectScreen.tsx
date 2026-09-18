import { useMemo, useState } from 'react';
import '../classSelection.css';
import {
  gearResonanceForProfile,
  operatorClassDefinitions,
  operatorClassForProfile,
  specializationDefinitions,
  type OperatorClassId,
  type PlayerProfile,
} from '../game/meta';

type Props = {
  profile: PlayerProfile;
  onConfirm: (operatorClass: OperatorClassId) => void;
};

export default function ClassSelectScreen({ profile, onConfirm }: Props) {
  const [selectedId, setSelectedId] = useState<OperatorClassId>(() => operatorClassForProfile(profile));
  const selected = operatorClassDefinitions.find(definition => definition.id === selectedId) ?? operatorClassDefinitions[0];
  const resonance = useMemo(() => gearResonanceForProfile({ ...profile, operatorClass: selectedId }, selectedId), [profile, selectedId]);
  const specializationNames = selected.specializationIds
    .map(id => specializationDefinitions.find(definition => definition.id === id)?.name)
    .filter((name): name is string => !!name);

  return <main className="class-intake" aria-label="Operator class selection">
    <div className="class-intake-backdrop" aria-hidden="true" />
    <section className="class-intake-shell">
      <header className="class-intake-header">
        <div>
          <span>QUIET SIGNAL // OPERATOR INTAKE</span>
          <h1>Choose your field doctrine</h1>
          <p>Your class changes how you fight immediately. It guides gear synergy and later specialization, but never locks weapons, Ability Lenses, or Development Network branches.</p>
        </div>
        <aside>
          <small>LOADOUT POLICY</small>
          <b>OPEN ARSENAL</b>
          <span>Recalibrate aboard Quiet Signal whenever you want.</span>
        </aside>
      </header>

      <div className="class-choice-grid">
        {operatorClassDefinitions.map(definition => {
          const active = definition.id === selectedId;
          const preview = gearResonanceForProfile({ ...profile, operatorClass: definition.id }, definition.id);
          return <button
            key={definition.id}
            type="button"
            className={`class-choice-card class-${definition.id} ${active ? 'selected' : ''}`}
            aria-label={`Select ${definition.name} class`}
            aria-pressed={active}
            onClick={() => setSelectedId(definition.id)}
          >
            <div className="class-choice-top">
              <small>{definition.identity}</small>
              <strong>{preview.count}/6 RESONANT</strong>
            </div>
            <h2>{definition.name}</h2>
            <p>{definition.description}</p>
            <div className="class-signature">
              <small>SIGNATURE // {definition.signatureName}</small>
              <b>{definition.signatureDescription}</b>
            </div>
            <div className="class-choice-foot">
              <span>{definition.branchAffinities.join(' + ')} affinity</span>
              <span>{definition.starterPair}</span>
            </div>
          </button>;
        })}
      </div>

      <section className="class-intake-summary" aria-live="polite">
        <div className="class-summary-main">
          <small>{selected.name.toUpperCase()} COMBAT LOOP</small>
          <b>{selected.combatLoop}</b>
          <span>{selected.trait}</span>
        </div>
        <div>
          <small>STARTING RESONANCE</small>
          <b>{resonance.count}/6 · {resonance.tier >= 1 ? 'TIER I ACTIVE' : 'BUILDING'}</b>
          <span>{selected.resonanceTier1}</span>
        </div>
        <div>
          <small>LV15 PATHS</small>
          <b>{specializationNames.join(' · ')}</b>
          <span>Specializations deepen this doctrine later; class choice does not spend a progression point.</span>
        </div>
        <button className="class-confirm" type="button" onClick={() => onConfirm(selectedId)}>
          <span>Confirm {selected.name}</span>
          <small>Begin aboard Quiet Signal</small>
        </button>
      </section>
    </section>
  </main>;
}
