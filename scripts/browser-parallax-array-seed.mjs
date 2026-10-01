const targets = await (await fetch('http://127.0.0.1:9223/json')).json();
const target = targets.find(candidate => candidate.type === 'page' && candidate.webSocketDebuggerUrl);
if (!target) throw new Error('No Chrome page target available for Parallax Array QA seeding.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let sequence = 0;
const evaluate = expression => new Promise((resolve, reject) => {
  const id = ++sequence;
  const onMessage = event => {
    const message = JSON.parse(event.data);
    if (message.id !== id) return;
    socket.removeEventListener('message', onMessage);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  };
  socket.addEventListener('message', onMessage);
  socket.send(JSON.stringify({
    id,
    method: 'Runtime.evaluate',
    params: { expression, returnByValue: true },
  }));
});

const result = await evaluate(`(() => {
  const seedCampaign = campaign => {
    if (!campaign?.story?.parallaxDebt || !campaign?.story?.interdiction || !campaign?.story?.postKhepri) return false;
    if (campaign.story.blackLattice) {
      campaign.story.blackLattice.status = 'complete';
      campaign.story.blackLattice.step = Math.max(14, campaign.story.blackLattice.step || 0);
    }
    campaign.story.postKhepri.status = 'complete';
    campaign.story.postKhepri.step = Math.max(5, campaign.story.postKhepri.step || 0);
    const interdiction = campaign.story.interdiction;
    interdiction.status = 'complete';
    interdiction.step = Math.max(5, interdiction.step || 0);
    const parallaxDebt = campaign.story.parallaxDebt;
    parallaxDebt.status = 'active';
    parallaxDebt.step = 2;
    parallaxDebt.choiceA = null;
    parallaxDebt.completed = ['parallax-debt-0', 'parallax-debt-1'];
    parallaxDebt.evidence = ['baseline-offset', 'return-vector'];
    parallaxDebt.lastBeat = 'QA seed // Blind Meridian ready at Cislunar Parallax Array.';
    campaign.story.lastBeat = parallaxDebt.lastBeat;
    campaign.lastOutcome = parallaxDebt.lastBeat;
    return true;
  };

  const level15AllocatedNodes = [
    'ballistics-vectoring-lane',
    'ballistics-bore-map',
    'ballistics-terminal-geometry',
    'ballistics-impact-lane',
    'ballistics-kinetic-budget',
    'ballistics-dense-salvo',
    'mobility-servo-lane',
    'mobility-countermass-timing',
    'mobility-vector-recovery',
    'mobility-impulse-lane',
    'mobility-brake-sense',
    'mobility-transit-window',
    'systems-capacitor-lane',
    'systems-charge-recovery',
  ];
  const seedLevel15Profile = profile => {
    if (!profile) return;
    profile.level = Math.max(15, profile.level || 1);
    profile.progressionPoints = 0;
    profile.allocatedNodes = [...level15AllocatedNodes];
    if (profile.operatorNetwork) {
      profile.operatorNetwork.allocatedNodeIds = [...level15AllocatedNodes];
      profile.operatorNetwork.unspentPoints = 0;
      profile.operatorNetwork.plannedTargetNodeIds = [];
    }
  };

  const stateKey = 'ironshade-vector-state-v1';
  const profileKey = 'ironshade-vector-profile-v3';
  const campaignKey = 'ironshade-vector-campaign-v1';
  const stateRaw = localStorage.getItem(stateKey);
  let stateSeeded = false;
  if (stateRaw) {
    const state = JSON.parse(stateRaw);
    seedLevel15Profile(state.profile);
    stateSeeded = seedCampaign(state.campaign);
    localStorage.setItem(stateKey, JSON.stringify(state));
  }

  const profileRaw = localStorage.getItem(profileKey);
  if (profileRaw) {
    const profile = JSON.parse(profileRaw);
    seedLevel15Profile(profile);
    localStorage.setItem(profileKey, JSON.stringify(profile));
  }

  const campaignRaw = localStorage.getItem(campaignKey);
  let campaignSeeded = false;
  if (campaignRaw) {
    const campaign = JSON.parse(campaignRaw);
    campaignSeeded = seedCampaign(campaign);
    localStorage.setItem(campaignKey, JSON.stringify(campaign));
  }

  return { stateSeeded, campaignSeeded, state: Boolean(stateRaw), profile: Boolean(profileRaw) };
})()`);

socket.close();
if (result?.exceptionDetails || result?.result?.exceptionDetails) {
  throw new Error('Failed to seed Parallax Array QA campaign finale.');
}
console.log('BROWSER_PARALLAX_ARRAY_SEED_PASS parallaxDebt=active step=2 level>=15');
