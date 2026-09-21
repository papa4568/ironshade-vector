import type { CampaignState, Contract } from '../game/campaign';
import type { PlayerProfile } from '../game/meta';
import { directiveModifierName, directiveRewardPreview, directiveStats, prepareDirective } from '../game/operationDirectives';
import { commandTargetMutationDefinition, commandTargetMutationForecastForContract } from '../game/commandTargetMutations';

type Props = {
  profile: PlayerProfile;
  campaign: CampaignState;
  contracts: Contract[];
  onCampaignChange: (campaign: CampaignState) => void;
  onOpenContract: (id: string) => void;
};

export default function DirectivePanel({ profile, campaign, contracts, onCampaignChange, onOpenContract }: Props) {
  const state = campaign.directives;
  const prepared = state.inventory.find(item => item.id === state.preparedId) ?? null;
  const preparedContract = prepared ? contracts.find(contract => contract.directiveId === prepared.id) : null;

  if (!state.unlocked || profile.level < 10) {
    return <article className="directive-array locked">
      <span className="card-kicker">QUIET SIGNAL // DIRECTIVE ARRAY</span>
      <h2>Endgame navigation locked</h2>
      <p>Reach operator level 10 to activate recovered Operation Directives. Campaign, Story, Daily, Escalation and derelict contracts remain unchanged before then.</p>
      <div className="directive-lock">LV {profile.level}/10</div>
    </article>;
  }

  return <article className="directive-array">
    <header>
      <div>
        <span className="card-kicker">QUIET SIGNAL // DIRECTIVE ARRAY</span>
        <h2>Prepare recovered high-risk operations.</h2>
        <p>Directives are consumed only when an extraction banks. Dying, restarting, or returning to Quiet Signal leaves the prepared record intact.</p>
      </div>
      <div className="directive-summary">
        <span><small>ARRAY</small><b>{state.inventory.length}/8</b></span>
        <span><small>CLEARED</small><b>{state.completed}</b></span>
        <span><small>HIGHEST</small><b>T{state.highestTier}</b></span>
      </div>
    </header>
    <div className="directive-grid">
      {state.inventory.map(directive => {
        const selected = directive.id === state.preparedId;
        const stats = directiveStats(directive);
        const commandPackage = commandTargetMutationForecastForContract(directive)[0];
        const commandDefinition = commandPackage ? commandTargetMutationDefinition(commandPackage) : null;
        return <section key={directive.id} className={`directive-card ${selected ? 'prepared' : ''}`}>
          <div className="directive-card-top"><b>T{directive.tier} // {directive.codename}</b><span>{directive.targetClass === 'command-target' ? 'COMMAND TARGET' : 'ELITE-LED'}</span></div>
          <h3>{directive.locationName}</h3>
          <p>{directive.sourceLabel}</p>
          <div className="directive-mods">{directive.modifierIds.length ? directive.modifierIds.map(id => <span key={id}>{directiveModifierName(id)}</span>) : <span>NO ADDED COMPLICATIONS</span>}</div>
          {commandDefinition && <div className="directive-risk"><span>COMMAND PACKAGE // {commandDefinition.name}</span><span>{commandDefinition.description}</span></div>}
          <small>{directiveRewardPreview(directive, profile.level)}</small>
          <div className="directive-risk"><span>RISK {stats.riskScore}</span><span>{directive.deepTarget}</span></div>
          <button className={selected ? 'primary' : ''} onClick={() => onCampaignChange(prepareDirective(campaign, directive.id))}>{selected ? 'Prepared' : 'Prepare Directive'}</button>
        </section>;
      })}
    </div>
    <div className="directive-state-note">
      <b>{prepared ? `PREPARED // T${prepared.tier} ${prepared.codename}` : 'NO DIRECTIVE PREPARED'}</b>
      <span>{state.lastBeat}</span>
      {preparedContract && <button onClick={() => onOpenContract(preparedContract.id)}>Open prepared Directive contract</button>}
    </div>
  </article>;
}
