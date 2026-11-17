// The story of Portside Heat: six missions that take Danny "Rook" Reyes
// from a fresh arrival to the King of Portside. Each mission is a list of
// steps — go somewhere, steal a car, collect, fight, survive — and the
// mission runner tracks them one at a time, paying out when the last one
// lands.

export const MISSIONS = [
  {
    id: 'fresh-meat',
    title: 'Fresh Meat',
    briefing: 'Mara Voss runs this city from her office downtown. Go introduce yourself — on foot or in a car, your call.',
    reward: 100,
    steps: [
      { type: 'goto', shop: 'mara-office', radius: 70, text: 'Go to Mara\'s Office downtown' },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    briefing: 'Mara needs a fast car and she does not pay for cars. Steal the red sports car parked near the marina and bring it to the garage in the port.',
    reward: 250,
    steps: [
      { type: 'steal', kind: 'sports', text: 'Steal a sports car (press E next to one)' },
      { type: 'deliver', shop: 'garage', radius: 80, text: 'Deliver it to the Garage in the port' },
    ],
  },
  {
    id: 'street-tax',
    title: 'Street Tax',
    briefing: 'The Vipers left four cash bags stashed around the port. Collect them all. The port is their turf — keep your eyes open.',
    reward: 300,
    steps: [
      { type: 'collect', shop: 'garage', count: 4, radius: 420, text: 'Collect the cash bags around the port (0/4)' },
    ],
  },
  {
    id: 'payback',
    title: 'Payback',
    briefing: 'The Vipers jumped one of Mara\'s couriers at the marina. Go make it right: five of them, and make it loud.',
    reward: 450,
    steps: [
      { type: 'kill', shop: 'marina', count: 5, text: 'Take out the Vipers at the marina (0/5)' },
    ],
  },
  {
    id: 'getaway',
    title: 'The Getaway',
    briefing: 'Mara is at the docks and the cops are already rolling. Pick her up, then lose a two-star wanted level and bring her home to the safehouse.',
    reward: 600,
    steps: [
      { type: 'goto', shop: 'docks', radius: 70, text: 'Pick up Mara at the Docks' },
      { type: 'escape', stars: 2, shop: 'safehouse', radius: 80, text: 'Lose the heat, then reach the Safehouse' },
    ],
  },
  {
    id: 'king',
    title: 'King of Portside',
    briefing: 'Rico Vane runs the Vipers and he wants you gone. Survive the heat at four stars, then put Rico down. Do this and Portside is yours.',
    reward: 1000,
    steps: [
      { type: 'survive', seconds: 60, stars: 4, text: 'Survive the heat at 4 stars (0:60)' },
      { type: 'boss', shop: 'marina', text: 'Take down Rico Vane at the marina' },
    ],
  },
];

export function createMissionRunner() {
  return {
    activeIndex: -1,
    stepIndex: 0,
    stepState: null,
    completed: 0,
    available: 0,
    done: false,
  };
}

export function missionTitle(runner) {
  if (runner.activeIndex < 0) return null;
  return MISSIONS[runner.activeIndex].title;
}

export function currentStep(runner) {
  if (runner.activeIndex < 0) return null;
  const mission = MISSIONS[runner.activeIndex];
  return mission.steps[runner.stepIndex] ?? null;
}

export function startMission(runner, index) {
  runner.activeIndex = index;
  runner.stepIndex = 0;
  runner.stepState = freshStepState(MISSIONS[index].steps[0]);
}

export function freshStepState(step) {
  if (!step) return null;
  if (step.type === 'collect') return { collected: 0, bags: null };
  if (step.type === 'kill') return { killed: 0, spawned: false };
  if (step.type === 'survive') return { elapsed: 0 };
  if (step.type === 'boss') return { spawned: false };
  if (step.type === 'escape') return { pickedUp: false, hadHeat: false };
  return {};
}

export function advanceStep(runner) {
  runner.stepIndex += 1;
  const mission = MISSIONS[runner.activeIndex];
  if (runner.stepIndex >= mission.steps.length) {
    return 'mission-complete';
  }
  runner.stepState = freshStepState(mission.steps[runner.stepIndex]);
  return 'step-complete';
}

export function completeMission(runner) {
  const mission = MISSIONS[runner.activeIndex];
  runner.completed += 1;
  runner.activeIndex = -1;
  runner.stepIndex = 0;
  runner.stepState = null;
  runner.available = Math.min(MISSIONS.length, runner.completed + 1);
  if (runner.completed >= MISSIONS.length) runner.done = true;
  return mission;
}

export function failMission(runner) {
  runner.activeIndex = -1;
  runner.stepIndex = 0;
  runner.stepState = null;
}

// Where a mission step points on the map: a shop, or a bag, or the player.
export function stepTarget(step, city, state) {
  if (!step) return null;
  if (step.shop) {
    const shop = city.shop(step.shop);
    if (shop) return { x: shop.x, y: shop.y, label: shop.label };
  }
  if (step.type === 'collect' && state.collectBags && state.collectBags.length > 0) {
    const bag = state.collectBags[0];
    return { x: bag.x, y: bag.y, label: 'Cash bag' };
  }
  if (step.type === 'kill' && state.enemies.length > 0) {
    const e = state.enemies[0];
    return { x: e.x, y: e.y, label: 'Viper' };
  }
  if (step.type === 'boss' && state.enemies.length > 0) {
    const e = state.enemies.find((n) => n.kind === 'boss') ?? state.enemies[0];
    return { x: e.x, y: e.y, label: 'Rico Vane' };
  }
  return null;
}

export function stepText(step, runner) {
  if (!step) return '';
  const s = runner.stepState;
  if (step.type === 'collect' && s) {
    return `Collect the cash bags around the port (${s.collected}/${step.count})`;
  }
  if (step.type === 'kill' && s) {
    return `Take out the Vipers at the marina (${s.killed}/${step.count})`;
  }
  if (step.type === 'survive' && s) {
    const left = Math.max(0, Math.ceil(step.seconds - s.elapsed));
    return `Survive the heat at ${step.stars} stars (${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')})`;
  }
  return step.text;
}
